from dataclasses import replace
from math import exp

import pytest

from fire_calculator.constants import default_inputs
from fire_calculator.math.monte_carlo import (
    _cash_needs, _Path, _retirement_path, _return_parameters, calculate_monte_carlo,
)


def inputs(**changes):
    values = dict(current_age=60, life_expectancy=70, simulation_count=100,
                  annual_volatility=0.15, pension_mode=0)
    values.update(changes)
    return replace(default_inputs(), **values)


def test_lognormal_parameters_match_arithmetic_mean_and_variance():
    mu, sigma = _return_parameters(0.08, 0.15)
    assert exp(mu + sigma * sigma / 2) == pytest.approx(1.08)
    variance = (exp(sigma * sigma) - 1) * exp(2 * mu + sigma * sigma)
    assert variance == pytest.approx(0.15**2)


def test_seeded_result_reproducible_and_has_real_spread():
    scenario = inputs(initial_balance=500_000)
    first = calculate_monte_carlo(scenario)
    calculate_monte_carlo.cache_clear()
    assert calculate_monte_carlo(scenario) == first
    assert any(p.portfolio_p10 < p.portfolio_p90 for p in first.points[1:])
    assert calculate_monte_carlo(replace(scenario, simulation_seed=41)).points != first.points


def test_retirement_draws_down_and_stops_contributions():
    result = calculate_monte_carlo(inputs(initial_balance=1_000_000, annual_volatility=0,
        annual_roi=0, inflation_rate=0, management_fee_rate=0))
    assert result.fire_age_exact == 60
    assert all(p.monthly_contribution == 0 and p.contributed == 0 for p in result.points)
    assert result.points[-1].portfolio == pytest.approx(640_000)


def test_no_savings_or_income_never_reaches_fire():
    result = calculate_monte_carlo(inputs(initial_balance=0, monthly_contribution=0))
    assert result.fire_age is None and result.success_probability == 0
    assert all(p.portfolio == 0 for p in result.points)


def test_zero_volatility_percentiles_collapse_and_success_is_binary():
    result = calculate_monte_carlo(inputs(annual_volatility=0))
    assert result.success_probability in (0, 1)
    assert all(p.portfolio_p10 == p.portfolio == p.portfolio_p90 for p in result.points)


def test_pension_can_fund_retirement_without_portfolio():
    result = calculate_monte_carlo(inputs(initial_balance=0, monthly_contribution=0,
        pension_mode=1, pension_start_age=60, pension_monthly_net=4000))
    assert result.fire_age_exact == 60 and result.success_probability == 1
    assert all(p.portfolio == 0 for p in result.points)


def test_fractional_pension_start_only_offsets_payable_fraction():
    scenario = inputs(pension_mode=1, pension_start_age=60.125,
        pension_monthly_net=1200, pension_payments_per_year=12,
        desired_monthly_net_income=1200, inflation_rate=0)
    needs = _cash_needs(scenario, 0, (1.0,) * 121)
    assert needs[:3] == pytest.approx((1200, 600, 0))


def test_later_pension_cannot_undo_bankruptcy():
    scenario = inputs(initial_balance=0, monthly_contribution=0,
        pension_mode=1, pension_start_age=60.25, pension_monthly_net=4000)
    path = _Path((1.0,) * 121, (0.0,) * 121)
    needs = _cash_needs(scenario, 0, (1.0,) * 121)
    success, trace = _retirement_path(path, scenario, 0, needs, (0.0,) * 120, (1.0,) * 121, record=True)
    assert not success and trace == [0.0] * 121


def test_fifo_tax_is_on_nominal_gains_including_inflation():
    scenario = inputs(initial_balance=100, gains_tax_rate=0.4)
    path = _Path((1.0, 2.0), (100.0, 100.0))
    success, trace = _retirement_path(path, scenario, 0, (160.0,), (0.0,), (1.0, 2.0), record=True)
    assert success and trace[-1] == pytest.approx(0)
    assert not _retirement_path(path, scenario, 0, (161.0,), (0.0,), (1.0, 2.0))[0]


def test_common_paths_choose_earliest_passing_month():
    result = calculate_monte_carlo(inputs(initial_balance=0))
    probabilities = [p.success_probability for p in result.candidates]
    assert probabilities == sorted(probabilities)
    if result.fire_age_exact is not None:
        assert result.success_probability >= result.target_success_probability
        earlier = [p for p in result.candidates if p.age < result.fire_age_exact]
        assert all(p.success_probability < result.target_success_probability for p in earlier)


def test_negative_real_returns_are_supported():
    result = calculate_monte_carlo(inputs(initial_balance=1_000_000, annual_volatility=0,
        annual_roi=0, inflation_rate=0.1, management_fee_rate=0.02))
    assert result.fire_age_exact is not None
    assert all(p.portfolio >= 0 for p in result.points)
