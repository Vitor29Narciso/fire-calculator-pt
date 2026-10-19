from dataclasses import replace

import pytest

from fire_calculator.constants import default_inputs
from fire_calculator.math.pension import (
    IAS_2026,
    annual_net_pension,
    estimated_monthly_gross_pension,
    pension_for_period,
)


def test_manual_net_pension_uses_payment_count_without_capital_gains_tax():
    inputs = replace(default_inputs(), pension_mode=1, pension_monthly_net=700)
    assert annual_net_pension(inputs, 50) == 9800
    assert annual_net_pension(replace(inputs, gains_tax_rate=0.4), 50) == 9800
    assert annual_net_pension(replace(inputs, pension_payments_per_year=12), 50) == 8400


def test_pension_prorates_fractional_start_age_and_does_not_start_at_fire():
    inputs = replace(default_inputs(), pension_mode=1, pension_monthly_net=1000)
    assert pension_for_period(inputs, 50, 65, 66) == 0
    assert pension_for_period(inputs, 50, 66, 67) == pytest.approx(3500)
    assert pension_for_period(inputs, 50, 67, 68) == 14000


def test_contributions_stop_at_fire_and_minimum_service_is_required():
    inputs = replace(default_inputs(), current_age=30, pension_mode=2, contribution_years=10)
    assert annual_net_pension(inputs, 34) == 0
    assert estimated_monthly_gross_pension(inputs, 35) == pytest.approx(2000 * 0.02 * 15)
    assert estimated_monthly_gross_pension(inputs, 40) == pytest.approx(2000 * 0.02 * 20)


def test_progressive_accrual_uses_marginal_salary_slices():
    inputs = replace(
        default_inputs(), current_age=40, pension_mode=2, contribution_years=21,
        career_average_monthly_salary=round(2 * IAS_2026),
    )
    salary = inputs.career_average_monthly_salary
    accrual = 1.1 * IAS_2026 * 0.023 + (salary - 1.1 * IAS_2026) * 0.0225
    assert estimated_monthly_gross_pension(inputs, 40) == pytest.approx(accrual * 21)


def test_salary_history_is_weighted_without_zero_salary_years_after_fire():
    inputs = replace(
        default_inputs(), current_age=40, pension_mode=2, contribution_years=10,
        career_average_monthly_salary=1000, current_gross_monthly_salary=3000,
    )
    assert estimated_monthly_gross_pension(inputs, 50) == pytest.approx(2000 * 0.02 * 20)
    assert annual_net_pension(inputs, 50) == pytest.approx(800 * 14 * 0.85)


def test_estimate_caps_service_at_40_years():
    inputs = replace(default_inputs(), current_age=60, pension_mode=2, contribution_years=40)
    assert annual_net_pension(inputs, 60) == annual_net_pension(inputs, 80)


def test_low_future_salary_never_reduces_accrued_pension_across_service_bands():
    inputs = replace(
        default_inputs(), current_age=40, pension_mode=2, contribution_years=20,
        career_average_monthly_salary=10_000, current_gross_monthly_salary=1,
    )
    pensions = [annual_net_pension(inputs, age) for age in range(40, 81)]
    assert all(later + 1e-8 >= earlier for earlier, later in zip(pensions, pensions[1:]))


def test_disabled_pension_provides_no_income():
    inputs = replace(default_inputs(), pension_mode=0, pension_monthly_net=1000)
    assert annual_net_pension(inputs, 50) == 0


def test_zero_future_salary_does_not_create_pension_eligibility():
    inputs = replace(
        default_inputs(), current_age=40, pension_mode=2, contribution_years=14,
        current_gross_monthly_salary=0,
    )
    assert annual_net_pension(inputs, 60) == 0


def test_pension_covering_all_spending_requires_no_portfolio():
    from fire_calculator.math.drawdown import required_portfolio_value, simulate_drawdown
    from fire_calculator.math.lots import Portfolio

    inputs = replace(
        default_inputs(), current_age=67, pension_mode=1,
        pension_start_age=67, pension_monthly_net=3000,
    )
    empty = Portfolio.from_lump_sum(0)
    assert required_portfolio_value(empty, inputs, retirement_age=67) == 0
    assert simulate_drawdown(empty, inputs, retirement_age=67).success


@pytest.mark.parametrize("field", ["annual_volatility", "annual_roi", "pension_start_age"])
def test_non_finite_input_is_rejected(field):
    with pytest.raises(ValueError, match="finite"):
        replace(default_inputs(), **{field: float("nan")})


def test_impossible_contribution_history_is_rejected():
    with pytest.raises(ValueError, match="since age 16"):
        replace(default_inputs(), current_age=30, pension_mode=2, contribution_years=20)


def test_inactive_salary_history_does_not_block_other_pension_modes():
    assert replace(default_inputs(), pension_mode=0, contribution_years=40)
    assert replace(default_inputs(), pension_mode=1, contribution_years=40)
