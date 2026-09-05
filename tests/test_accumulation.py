import pytest
from dataclasses import replace

from fire_calculator.constants import default_inputs
from fire_calculator.math.accumulation import (
    portfolio_at_age,
    project_accumulation,
    simulate_accumulation,
)


def test_accumulation_starts_with_initial_balance() -> None:
    inputs = default_inputs()
    curve = project_accumulation(inputs)

    assert curve[0].age == inputs.current_age
    assert curve[0].portfolio == inputs.initial_balance
    assert curve[0].contributed == 0.0


def test_initial_balance_accelerates_fire_trajectory() -> None:
    baseline = default_inputs()
    with_head_start = replace(baseline, initial_balance=50_000.0)

    baseline_curve = project_accumulation(baseline)
    head_start_curve = project_accumulation(with_head_start)

    assert head_start_curve[0].portfolio == 50_000.0
    assert head_start_curve[5].portfolio > baseline_curve[5].portfolio


def test_flat_nominal_contributions_deflate_in_real_terms() -> None:
    inputs = default_inputs()
    curve = project_accumulation(inputs)
    years = 30 - inputs.current_age
    expected = sum(
        inputs.real_monthly_contribution(year) * 12 for year in range(years)
    )
    age_30 = next(point for point in curve if point.age == 30)

    assert age_30.contributed == pytest.approx(expected)
    assert age_30.contributed < inputs.monthly_contribution * 12 * years
    assert age_30.monthly_contribution == pytest.approx(inputs.monthly_contribution)


def test_contribution_raise_steps_up_each_birthday() -> None:
    inputs = replace(default_inputs(), contribution_growth_rate=0.05)
    curve = project_accumulation(inputs)
    age_24 = next(point for point in curve if point.age == 24)
    age_25 = next(point for point in curve if point.age == 25)

    assert age_24.monthly_contribution == pytest.approx(1_000.0)
    assert age_25.monthly_contribution == pytest.approx(1_050.0)


def test_portfolio_exceeds_contributions_when_returns_are_positive() -> None:
    inputs = default_inputs()
    curve = project_accumulation(inputs)

    age_40 = next(point for point in curve if point.age == 40)

    assert age_40.portfolio > age_40.contributed


def test_portfolio_at_age_matches_curve() -> None:
    inputs = default_inputs()
    result = simulate_accumulation(inputs)
    age = 50

    assert portfolio_at_age(inputs, age).value == pytest.approx(
        result.portfolios_by_age[age].value
    )
    assert result.portfolios_by_age[age].value == pytest.approx(
        next(point for point in result.curve if point.age == age).portfolio
    )


def test_accumulation_builds_one_lot_per_contribution_month() -> None:
    inputs = default_inputs()
    portfolio = portfolio_at_age(inputs, inputs.current_age + 5)
    months = (inputs.current_age + 5 - inputs.current_age) * 12

    assert len(portfolio.lots) == months


def test_initial_balance_creates_starting_lot() -> None:
    baseline = default_inputs()
    with_head_start = replace(baseline, initial_balance=25_000.0)
    portfolio = portfolio_at_age(with_head_start, with_head_start.current_age + 5)
    months = 5 * 12

    assert len(portfolio.lots) == months + 1


def test_curve_includes_life_expectancy() -> None:
    inputs = default_inputs()
    curve = project_accumulation(inputs)

    assert curve[-1].age == inputs.life_expectancy
