from __future__ import annotations

from fire_calculator.constants import FOUR_PERCENT_MULTIPLIER
from fire_calculator.math.accumulation import AccumulationResult, simulate_accumulation
from fire_calculator.math.drawdown import required_portfolio_value, simulate_drawdown
from fire_calculator.types import (
    FireInputs,
    FireResult,
    FourPercentRuleTarget,
    RequirementPoint,
)


def compute_four_percent_rule(inputs: FireInputs) -> FourPercentRuleTarget:
    """Reference target from the 4% rule of thumb (not the main FIRE logic)."""
    annual_net = inputs.desired_monthly_net_income * 12
    annual_gross = annual_net / (1 - inputs.gains_tax_rate)
    target_portfolio = annual_gross * FOUR_PERCENT_MULTIPLIER

    return FourPercentRuleTarget(
        annual_net_income=annual_net,
        annual_gross_income=annual_gross,
        target_portfolio=target_portfolio,
    )


def project_requirement_curve(
    inputs: FireInputs,
    accumulation: AccumulationResult,
) -> tuple[RequirementPoint, ...]:
    """Required capital at each age, using that age's accumulated FIFO lots."""
    points: list[RequirementPoint] = []
    guess: float | None = None

    for age in range(inputs.current_age, inputs.life_expectancy + 1):
        if age == inputs.life_expectancy:
            required_capital = 0.0
        else:
            required_capital = required_portfolio_value(
                accumulation.portfolios_by_age[age],
                inputs,
                retirement_age=age,
                initial_guess=guess,
            )
            guess = required_capital

        points.append(RequirementPoint(age=age, required_capital=required_capital))

    return tuple(points)


def find_fire_age(
    accumulation: AccumulationResult,
    inputs: FireInputs,
) -> tuple[int | None, float | None]:
    """First age whose actual FIFO portfolio funds retirement until life expectancy."""
    ages = [point.age for point in accumulation.curve if point.age < inputs.life_expectancy]
    if not ages:
        return None, None

    def survives(age: int) -> bool:
        portfolio = accumulation.portfolios_by_age[age]
        if portfolio.value <= 0:
            return False
        return simulate_drawdown(portfolio.compacted(), inputs, age).success

    low = 0
    high = len(ages) - 1
    found: int | None = None

    while low <= high:
        mid = (low + high) // 2
        age = ages[mid]
        if survives(age):
            found = age
            high = mid - 1
        else:
            low = mid + 1

    if found is None:
        return None, None

    portfolio = next(point.portfolio for point in accumulation.curve if point.age == found)
    return found, portfolio


def calculate_fire(inputs: FireInputs) -> FireResult:
    """Run the full FIRE calculation and return age, curves, and reference targets."""
    accumulation = simulate_accumulation(inputs)
    requirement = project_requirement_curve(inputs, accumulation)
    fire_age, portfolio_at_fire = find_fire_age(accumulation, inputs)

    return FireResult(
        fire_age=fire_age,
        portfolio_at_fire=portfolio_at_fire,
        four_percent_rule=compute_four_percent_rule(inputs),
        accumulation_curve=accumulation.curve,
        requirement_curve=requirement,
    )
