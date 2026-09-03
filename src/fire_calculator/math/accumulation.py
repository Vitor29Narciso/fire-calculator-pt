from __future__ import annotations

from dataclasses import dataclass

from fire_calculator.math.drawdown import monthly_return
from fire_calculator.math.lots import Portfolio
from fire_calculator.types import AccumulationPoint, FireInputs


@dataclass(frozen=True)
class AccumulationResult:
    curve: tuple[AccumulationPoint, ...]
    portfolios_by_age: dict[int, Portfolio]


def simulate_accumulation(inputs: FireInputs) -> AccumulationResult:
    """Project portfolio growth with monthly contributions and FIFO lots."""
    portfolio = Portfolio.from_lump_sum(inputs.initial_balance)
    monthly_rate = monthly_return(inputs.real_annual_return)
    contributed = 0.0

    curve: list[AccumulationPoint] = []
    portfolios_by_age: dict[int, Portfolio] = {}

    total_months = (inputs.life_expectancy - inputs.current_age) * 12

    for month in range(total_months + 1):
        age = inputs.current_age + month / 12
        curve.append(
            AccumulationPoint(
                age=age,
                portfolio=portfolio.value,
                contributed=contributed,
            )
        )
        if month % 12 == 0:
            portfolios_by_age[inputs.current_age + month // 12] = portfolio.copy()

        if month == total_months:
            break

        portfolio.add_contribution(inputs.monthly_contribution)
        contributed += inputs.monthly_contribution
        portfolio.apply_monthly_return(monthly_rate)

    return AccumulationResult(
        curve=tuple(curve),
        portfolios_by_age=portfolios_by_age,
    )


def project_accumulation(inputs: FireInputs) -> tuple[AccumulationPoint, ...]:
    """Return the accumulation curve from current age to life expectancy."""
    return simulate_accumulation(inputs).curve


def portfolio_at_age(inputs: FireInputs, age: int) -> Portfolio:
    """Return portfolio state at the start of a given age."""
    if age < inputs.current_age or age > inputs.life_expectancy:
        msg = (
            f"age {age} must be between current_age ({inputs.current_age}) "
            f"and life_expectancy ({inputs.life_expectancy})"
        )
        raise ValueError(msg)

    return simulate_accumulation(inputs).portfolios_by_age[age].copy()
