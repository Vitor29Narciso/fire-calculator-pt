from __future__ import annotations

from dataclasses import dataclass

from fire_calculator.math.lots import Portfolio
from fire_calculator.types import FireInputs

_BISECTION_STEPS = 12
_LUMP_SUM_TEMPLATE = Portfolio.from_lump_sum(1.0)


@dataclass(frozen=True)
class DrawdownResult:
    success: bool
    ending_value: float
    months_completed: int


def monthly_return(annual_rate: float) -> float:
    return (1 + annual_rate) ** (1 / 12) - 1


def find_gross_for_target_net(
    portfolio: Portfolio,
    target_net: float,
    tax_rate: float,
) -> float | None:
    """Find the gross withdrawal that yields target_net after FIFO tax on gains."""
    if portfolio.value <= 0:
        return None

    probe = portfolio.copy()
    result = probe.withdraw_for_net(target_net, tax_rate)
    if result is None:
        return None

    tax, _net = result
    return target_net + tax


def simulate_drawdown(
    portfolio: Portfolio,
    inputs: FireInputs,
    retirement_age: int,
) -> DrawdownResult:
    """Simulate retirement withdrawals from retirement_age until life expectancy."""
    years = inputs.life_expectancy - retirement_age
    if years <= 0:
        return DrawdownResult(success=True, ending_value=portfolio.value, months_completed=0)

    state = portfolio.copy()
    annual_rate = inputs.real_annual_return
    target_net = inputs.desired_monthly_net_income * 12
    tax_rate = inputs.gains_tax_rate

    for year in range(years):
        state.apply_return(annual_rate)
        withdrawn = state.withdraw_for_net(target_net, tax_rate)
        if withdrawn is None:
            return DrawdownResult(
                success=False,
                ending_value=state.value,
                months_completed=year * 12,
            )

    return DrawdownResult(
        success=True,
        ending_value=state.value,
        months_completed=years * 12,
    )


def required_portfolio_value(
    portfolio_template: Portfolio,
    inputs: FireInputs,
    retirement_age: int,
    *,
    ending_tolerance: float = 500.0,
    initial_guess: float | None = None,
) -> float:
    """
    Scale a portfolio's lot structure until drawdown depletes to ~0 at life expectancy.

    Empty portfolios (no lots yet) fall back to a single lot so we can still
    answer "how much capital would be needed at this age".
    """
    years = inputs.life_expectancy - retirement_age
    if years <= 0:
        return 0.0

    if portfolio_template.value <= 0:
        working_template = _LUMP_SUM_TEMPLATE
        base_value = 1.0
    else:
        working_template = portfolio_template.compacted()
        base_value = working_template.value

    def ending_at_capital(capital: float) -> float:
        result = simulate_drawdown(
            working_template.scaled(capital / base_value),
            inputs,
            retirement_age,
        )
        if not result.success:
            return -1.0
        return result.ending_value

    low_capital = 0.0
    high_capital = initial_guess if initial_guess and initial_guess > 0 else max(
        inputs.desired_monthly_net_income * 12 * 20,
        base_value,
    )

    while ending_at_capital(high_capital) < 0:
        high_capital *= 2
        if high_capital > 50_000_000:
            msg = "Could not find enough capital to fund retirement"
            raise ValueError(msg)

    for _ in range(_BISECTION_STEPS):
        mid_capital = (low_capital + high_capital) / 2
        ending = ending_at_capital(mid_capital)
        if ending < 0:
            low_capital = mid_capital
        elif ending > ending_tolerance:
            high_capital = mid_capital
        else:
            return mid_capital

    return high_capital
