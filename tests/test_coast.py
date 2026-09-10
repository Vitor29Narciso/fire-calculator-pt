from dataclasses import replace

from fire_calculator.constants import SS_RETIREMENT_AGE, default_inputs
from fire_calculator.math.accumulation import simulate_accumulation
from fire_calculator.math.drawdown import monthly_return
from fire_calculator.math.fire_age import (
    calculate_fire,
    find_coast_age,
    interpolate_required,
    project_requirement_curve,
)


def _coast(inputs, ss_age=SS_RETIREMENT_AGE):
    accumulation = simulate_accumulation(inputs)
    requirement = project_requirement_curve(inputs, accumulation)
    coast_age, portfolio = find_coast_age(accumulation, requirement, inputs, ss_age)
    return accumulation, requirement, coast_age, portfolio


def test_coast_is_before_fire_when_ss_is_later() -> None:
    inputs = default_inputs()
    result = calculate_fire(inputs)
    _accumulation, requirement, coast_age, portfolio = _coast(inputs)

    assert result.fire_age_exact is not None
    assert coast_age is not None
    assert portfolio is not None
    assert coast_age < result.fire_age_exact

    monthly = monthly_return(inputs.real_annual_return)
    months = round((SS_RETIREMENT_AGE - coast_age) * 12)
    future = portfolio * (1 + monthly) ** months
    assert future >= interpolate_required(requirement, SS_RETIREMENT_AGE)


def test_month_before_coast_misses_the_ss_stake() -> None:
    inputs = default_inputs()
    accumulation, requirement, coast_age, _portfolio = _coast(inputs)
    assert coast_age is not None
    assert coast_age > inputs.current_age

    monthly = monthly_return(inputs.real_annual_return)
    target = interpolate_required(requirement, SS_RETIREMENT_AGE)
    previous = next(
        point for point in reversed(accumulation.curve) if point.age < coast_age - 1e-9
    )
    months = round((SS_RETIREMENT_AGE - previous.age) * 12)
    future = previous.portfolio * (1 + monthly) ** months
    assert future < target


def test_later_ss_age_makes_coast_earlier() -> None:
    inputs = default_inputs()
    _acc, _req, earlier_ss, _ = _coast(inputs, ss_age=60)
    _acc, _req, later_ss, _ = _coast(inputs, ss_age=75)

    assert earlier_ss is not None
    assert later_ss is not None
    assert later_ss < earlier_ss


def test_zero_saving_never_coasts() -> None:
    inputs = replace(default_inputs(), monthly_contribution=0, initial_balance=0)
    _acc, _req, coast_age, portfolio = _coast(inputs)
    assert coast_age is None
    assert portfolio is None


def test_large_balance_is_already_at_coast() -> None:
    inputs = replace(default_inputs(), initial_balance=2_000_000)
    _acc, _req, coast_age, _portfolio = _coast(inputs)
    assert coast_age == float(inputs.current_age)
