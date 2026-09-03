from __future__ import annotations

from fire_calculator.constants import FOUR_PERCENT_MULTIPLIER
from fire_calculator.math.accumulation import AccumulationResult, simulate_accumulation
from fire_calculator.math.drawdown import required_portfolio_value
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
    """Required capital at each birthday, using that age's accumulated FIFO lots."""
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

        points.append(RequirementPoint(age=float(age), required_capital=required_capital))

    return tuple(points)


def interpolate_required(
    requirement: tuple[RequirementPoint, ...],
    age: float,
) -> float:
    if not requirement:
        return 0.0
    if age <= requirement[0].age:
        return requirement[0].required_capital
    if age >= requirement[-1].age:
        return requirement[-1].required_capital

    for earlier, later in zip(requirement, requirement[1:], strict=False):
        if earlier.age <= age <= later.age:
            span = later.age - earlier.age
            if span <= 0:
                return later.required_capital
            weight = (age - earlier.age) / span
            return earlier.required_capital + weight * (
                later.required_capital - earlier.required_capital
            )

    return requirement[-1].required_capital


def _split_age(age: float) -> tuple[int, int]:
    total_months = round(age * 12)
    return total_months // 12, total_months % 12


def find_fire_age(
    accumulation: AccumulationResult,
    requirement: tuple[RequirementPoint, ...],
    inputs: FireInputs,
) -> tuple[float | None, float | None]:
    """First month where the portfolio meets required capital."""
    for point in accumulation.curve:
        if point.age >= inputs.life_expectancy:
            break
        required = interpolate_required(requirement, point.age)
        if point.portfolio >= required:
            return point.age, point.portfolio

    return None, None


def calculate_fire(inputs: FireInputs) -> FireResult:
    """Run the full FIRE calculation and return age, curves, and reference targets."""
    accumulation = simulate_accumulation(inputs)
    requirement = project_requirement_curve(inputs, accumulation)
    fire_age, portfolio_at_fire = find_fire_age(accumulation, requirement, inputs)

    if fire_age is None:
        fire_age_years = years_until_fire = months_until_fire = None
    else:
        fire_age_years, _extra_months = _split_age(fire_age)
        years_until_fire, months_until_fire = _split_age(fire_age - inputs.current_age)

    return FireResult(
        fire_age=fire_age_years,
        years_until_fire=years_until_fire,
        months_until_fire=months_until_fire,
        portfolio_at_fire=portfolio_at_fire,
        four_percent_rule=compute_four_percent_rule(inputs),
        accumulation_curve=accumulation.curve,
        requirement_curve=requirement,
    )
