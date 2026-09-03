import pytest

from fire_calculator.constants import (
    DEFAULT_ANNUAL_ROI,
    DEFAULT_DESIRED_MONTHLY_NET_INCOME,
    DEFAULT_GAINS_TAX_RATE,
    DEFAULT_INITIAL_BALANCE,
    DEFAULT_INFLATION_RATE,
    DEFAULT_LIFE_EXPECTANCY,
    DEFAULT_MANAGEMENT_FEE_RATE,
    DEFAULT_MONTHLY_CONTRIBUTION,
    FOUR_PERCENT_MULTIPLIER,
    default_inputs,
)
from fire_calculator.types import FireInputs


def test_default_inputs_match_google_sheet() -> None:
    inputs = default_inputs()

    assert inputs.current_age == 24
    assert inputs.life_expectancy == DEFAULT_LIFE_EXPECTANCY
    assert inputs.monthly_contribution == DEFAULT_MONTHLY_CONTRIBUTION
    assert inputs.annual_roi == DEFAULT_ANNUAL_ROI
    assert inputs.inflation_rate == DEFAULT_INFLATION_RATE
    assert inputs.management_fee_rate == DEFAULT_MANAGEMENT_FEE_RATE
    assert inputs.desired_monthly_net_income == DEFAULT_DESIRED_MONTHLY_NET_INCOME
    assert inputs.gains_tax_rate == DEFAULT_GAINS_TAX_RATE
    assert inputs.initial_balance == DEFAULT_INITIAL_BALANCE


def test_real_annual_return() -> None:
    inputs = default_inputs()
    expected = DEFAULT_ANNUAL_ROI - DEFAULT_INFLATION_RATE - DEFAULT_MANAGEMENT_FEE_RATE

    assert inputs.real_annual_return == pytest.approx(expected)


def test_four_percent_reference_math() -> None:
    inputs = default_inputs()
    annual_net = inputs.desired_monthly_net_income * 12
    annual_gross = annual_net / (1 - inputs.gains_tax_rate)
    target = annual_gross * FOUR_PERCENT_MULTIPLIER

    assert annual_net == DEFAULT_DESIRED_MONTHLY_NET_INCOME * 12
    assert annual_gross == pytest.approx(annual_net / (1 - DEFAULT_GAINS_TAX_RATE))
    assert target == pytest.approx(annual_gross * FOUR_PERCENT_MULTIPLIER)


def test_invalid_age_raises() -> None:
    with pytest.raises(ValueError, match="current_age"):
        FireInputs(
            current_age=90,
            life_expectancy=90,
            monthly_contribution=1_000.0,
            annual_roi=0.07,
            inflation_rate=0.03,
            management_fee_rate=0.0023,
            desired_monthly_net_income=3_000.0,
            gains_tax_rate=0.20,
        )
