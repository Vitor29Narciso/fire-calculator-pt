import pytest
from dataclasses import replace

from fire_calculator import calculate_fire
from fire_calculator.constants import FOUR_PERCENT_MULTIPLIER, default_inputs
from fire_calculator.math.accumulation import simulate_accumulation
from fire_calculator.math.drawdown import required_portfolio_value
from fire_calculator.math.fire_age import compute_four_percent_rule, project_requirement_curve
from fire_calculator.math.lots import Portfolio


def test_calculate_fire_returns_complete_result() -> None:
    result = calculate_fire(default_inputs())

    assert result.fire_age is not None
    assert result.portfolio_at_fire is not None
    assert len(result.accumulation_curve) > 0
    assert len(result.requirement_curve) > 0
    assert result.four_percent_rule.target_portfolio > 0


def test_requirement_curve_falls_as_retirement_shortens() -> None:
    inputs = default_inputs()
    accumulation = simulate_accumulation(inputs)
    requirement = project_requirement_curve(inputs, accumulation)
    by_age = {point.age: point.required_capital for point in requirement}

    assert by_age[inputs.current_age + 5] > by_age[60]
    assert by_age[60] > by_age[80]
    assert by_age[inputs.life_expectancy] == 0.0


def test_real_lots_need_more_capital_than_a_zero_gain_lump_sum() -> None:
    inputs = default_inputs()
    accumulation = simulate_accumulation(inputs)
    age = 50
    real_lots = required_portfolio_value(
        accumulation.portfolios_by_age[age],
        inputs,
        retirement_age=age,
    )
    lump_sum = required_portfolio_value(
        Portfolio.from_lump_sum(1.0),
        inputs,
        retirement_age=age,
    )

    assert real_lots > lump_sum


def test_fire_age_is_first_intersection() -> None:
    result = calculate_fire(default_inputs())
    assert result.fire_age is not None

    for point in result.accumulation_curve:
        required = next(req for req in result.requirement_curve if req.age == point.age)
        if point.age < result.fire_age:
            assert point.portfolio < required.required_capital
        elif point.age == result.fire_age:
            assert point.portfolio >= required.required_capital


def test_four_percent_rule_reference() -> None:
    inputs = default_inputs()
    reference = compute_four_percent_rule(inputs)

    annual_net = inputs.desired_monthly_net_income * 12
    annual_gross = annual_net / (1 - inputs.gains_tax_rate)

    assert reference.annual_net_income == annual_net
    assert reference.annual_gross_income == pytest.approx(annual_gross)
    assert reference.target_portfolio == pytest.approx(annual_gross * FOUR_PERCENT_MULTIPLIER)


def test_initial_balance_lowers_fire_age() -> None:
    baseline = calculate_fire(default_inputs())
    with_head_start = calculate_fire(replace(default_inputs(), initial_balance=100_000.0))

    assert with_head_start.fire_age is not None
    assert baseline.fire_age is not None
    assert with_head_start.fire_age <= baseline.fire_age


def test_default_inputs_fire_age_is_plausible() -> None:
    result = calculate_fire(default_inputs())

    assert result.fire_age is not None
    assert 45 <= result.fire_age <= 65
