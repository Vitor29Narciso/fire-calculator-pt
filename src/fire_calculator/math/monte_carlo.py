"""Seeded Monte Carlo with monthly cash flows and nominal FIFO gains tax."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from math import exp, log, sqrt
from random import Random

from fire_calculator.math.fire_age import compute_four_percent_rule
from fire_calculator.math.pension import annual_net_pension, pension_for_period
from fire_calculator.types import FireInputs, FourPercentRuleTarget


@dataclass(frozen=True)
class MonteCarloPoint:
    age: float
    portfolio: float
    portfolio_p10: float
    portfolio_p90: float
    contributed: float
    monthly_contribution: float
    annual_pension: float


@dataclass(frozen=True)
class CandidateResult:
    age: float
    success_probability: float


@dataclass(frozen=True)
class MonteCarloResult:
    fire_age: int | None
    years_until_fire: int | None
    months_until_fire: int | None
    portfolio_at_fire: float | None
    success_probability: float
    target_success_probability: float
    simulations: int
    seed: int
    annual_volatility: float
    four_percent_rule: FourPercentRuleTarget
    points: tuple[MonteCarloPoint, ...]
    candidates: tuple[CandidateResult, ...]
    terminal_portfolio_p10: float
    terminal_portfolio_median: float
    terminal_portfolio_p90: float

    @property
    def fire_age_exact(self) -> float | None:
        if self.fire_age is None or self.months_until_fire is None:
            return None
        return self.fire_age + self.months_until_fire / 12

    @property
    def accumulation_curve(self) -> tuple[MonteCarloPoint, ...]:
        return self.points


@dataclass(frozen=True)
class _Path:
    prices: tuple[float, ...]
    shares: tuple[float, ...]


def _return_parameters(expected_return: float, volatility: float) -> tuple[float, float]:
    """Match arithmetic mean and standard deviation of annual nominal returns."""
    gross_mean = 1 + expected_return
    sigma_squared = log(1 + (volatility / gross_mean) ** 2)
    return log(gross_mean) - sigma_squared / 2, sqrt(sigma_squared)


def _percentile(ordered: list[float], fraction: float) -> float:
    index = (len(ordered) - 1) * fraction
    lower = int(index)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def _build_paths(inputs: FireInputs, contributions: tuple[float, ...]) -> tuple[_Path, ...]:
    """Precompute nominal prices and purchases; candidates use a purchase prefix.

    Contributions are at the beginning of each month and spending at its end.
    A sampled annual factor is distributed evenly over that year's months.
    """
    rng = Random(inputs.simulation_seed)
    mu, sigma = _return_parameters(inputs.annual_roi, inputs.annual_volatility)
    months = len(contributions)
    count = inputs.simulation_count if inputs.annual_volatility else 1
    paths = []
    for _ in range(count):
        prices = [1.0]
        shares = [inputs.initial_balance]
        price = 1.0
        units = inputs.initial_balance
        for year_start in range(0, months, 12):
            annual_factor = exp(mu + sigma * rng.gauss(0.0, 1.0))
            monthly_factor = (annual_factor / (1 + inputs.management_fee_rate)) ** (1 / 12)
            for month in range(year_start, min(year_start + 12, months)):
                units += contributions[month] / price
                price *= monthly_factor
                prices.append(price)
                shares.append(units)
        paths.append(_Path(tuple(prices), tuple(shares)))
    return tuple(paths)


def _cash_needs(inputs: FireInputs, retirement_month: int, inflation: tuple[float, ...]) -> tuple[float, ...]:
    """Nominal end-of-month spending after precisely prorated real pension."""
    retirement_age = inputs.current_age + retirement_month / 12
    needs = []
    for month in range(retirement_month, len(inflation) - 1):
        start_age = inputs.current_age + month / 12
        pension = pension_for_period(inputs, retirement_age, start_age, start_age + 1 / 12)
        real_need = max(0.0, inputs.desired_monthly_net_income - pension)
        needs.append(real_need * inflation[month + 1])
    return tuple(needs)


def _retirement_path(
    path: _Path, inputs: FireInputs, retirement_month: int,
    needs: tuple[float, ...], contributions: tuple[float, ...],
    inflation: tuple[float, ...], *, record: bool = False,
) -> tuple[bool, list[float] | None]:
    """Sell immutable purchase lots using a scalar FIFO cursor.

    A failed month permanently fails the path. A later pension cannot undo
    earlier unfunded spending. Zero spending needs no portfolio.
    """
    prices = path.prices
    units = path.shares[retirement_month]
    head = 0
    lot_units = inputs.initial_balance
    tax_rate = inputs.gains_tax_rate
    trace = [units * prices[retirement_month] / inflation[retirement_month]] if record else None
    for offset, target_net in enumerate(needs):
        month = retirement_month + offset
        price = prices[month + 1]
        remaining = target_net
        while remaining > 1e-7 and head <= retirement_month:
            if lot_units <= 1e-12:
                head += 1
                if head <= retirement_month:
                    lot_units = contributions[head - 1] / prices[head - 1]
                continue
            cost_per_unit = 1.0 if head == 0 else prices[head - 1]
            net_per_unit = price - max(0.0, price - cost_per_unit) * tax_rate
            net_available = lot_units * net_per_unit
            if net_available + 1e-7 >= remaining:
                sold_units = min(lot_units, remaining / net_per_unit)
                units -= sold_units
                lot_units -= sold_units
                remaining = 0.0
            else:
                remaining -= net_available
                units -= lot_units
                lot_units = 0.0
        if remaining > 1e-6:
            if trace is not None:
                trace.extend([0.0] * (len(needs) - offset))
            return False, trace
        if trace is not None:
            trace.append(max(0.0, units * price / inflation[month + 1]))
    return True, trace


@lru_cache(maxsize=16)
def calculate_monte_carlo(inputs: FireInputs) -> MonteCarloResult:
    """Find the earliest common FIRE month meeting the simulated success target.

    Every candidate uses the same complete market paths. Later retirement adds
    purchases, avoids spending and cannot reduce accrued pension under this
    model, allowing binary search. Percentiles follow actual retirement cash
    flows, with no contributions from the selected retirement month onward.
    """
    months = (inputs.life_expectancy - inputs.current_age) * 12
    contributions = tuple(inputs.nominal_monthly_contribution(m // 12) for m in range(months))
    inflation = tuple((1 + inputs.inflation_rate) ** (m / 12) for m in range(months + 1))
    contributed = [0.0]
    for month, amount in enumerate(contributions):
        contributed.append(contributed[-1] + amount / inflation[month])
    paths = _build_paths(inputs, contributions)
    scores: dict[int, float] = {}

    def score(retirement_month: int) -> float:
        if retirement_month not in scores:
            needs = _cash_needs(inputs, retirement_month, inflation)
            successes = sum(
                _retirement_path(
                    path, inputs, retirement_month, needs, contributions, inflation
                )[0]
                for path in paths
            )
            scores[retirement_month] = successes / len(paths)
        return scores[retirement_month]

    last_month = months - 1
    if score(last_month) + 1e-12 < inputs.success_probability:
        fire_month = None
        chosen_month = months
        achieved_probability = score(last_month)
    else:
        low, high = 0, last_month
        while low < high:
            middle = (low + high) // 2
            if score(middle) + 1e-12 >= inputs.success_probability:
                high = middle
            else:
                low = middle + 1
        fire_month = chosen_month = low
        achieved_probability = score(low)
    needs = _cash_needs(inputs, chosen_month, inflation) if fire_month is not None else ()
    trajectories = []
    for path in paths:
        if fire_month is None:
            trace = [
                shares * price / inflation[m]
                for m, (shares, price) in enumerate(
                    zip(path.shares, path.prices, strict=True)
                )
            ]
        else:
            _, retirement_trace = _retirement_path(
                path, inputs, chosen_month, needs, contributions, inflation, record=True
            )
            assert retirement_trace is not None
            trace = [
                path.shares[m] * path.prices[m] / inflation[m]
                for m in range(chosen_month)
            ] + retirement_trace
        trajectories.append(trace)
    retirement_age = inputs.current_age + chosen_month / 12
    annual_pension = annual_net_pension(inputs, retirement_age) if fire_month is not None else 0.0
    points = []
    for month in range(months + 1):
        ordered = sorted(trace[month] for trace in trajectories)
        age = inputs.current_age + month / 12
        points.append(
            MonteCarloPoint(
                age=age,
                portfolio=_percentile(ordered, 0.5),
                portfolio_p10=_percentile(ordered, 0.1),
                portfolio_p90=_percentile(ordered, 0.9),
                contributed=contributed[min(month, chosen_month)],
                monthly_contribution=(
                    contributions[month]
                    if month < chosen_month and month < months else 0.0
                ),
                annual_pension=(
                    annual_pension
                    if fire_month is not None and month >= chosen_month
                    and age + 1e-9 >= inputs.pension_start_age else 0.0
                ),
            )
        )
    terminal = points[-1]
    return MonteCarloResult(
        fire_age=None if fire_month is None else inputs.current_age + fire_month // 12,
        years_until_fire=None if fire_month is None else fire_month // 12,
        months_until_fire=None if fire_month is None else fire_month % 12,
        portfolio_at_fire=None if fire_month is None else points[fire_month].portfolio,
        success_probability=achieved_probability,
        target_success_probability=inputs.success_probability,
        simulations=inputs.simulation_count,
        seed=inputs.simulation_seed,
        annual_volatility=inputs.annual_volatility,
        four_percent_rule=compute_four_percent_rule(inputs),
        points=tuple(points),
        candidates=tuple(
            CandidateResult(inputs.current_age + m / 12, probability)
            for m, probability in sorted(scores.items())
        ),
        terminal_portfolio_p10=terminal.portfolio_p10,
        terminal_portfolio_median=terminal.portfolio,
        terminal_portfolio_p90=terminal.portfolio_p90,
    )
