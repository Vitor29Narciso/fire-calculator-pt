import pytest

from fire_calculator.constants import (
    DEFAULT_ANNUAL_ROI,
    DEFAULT_CONTRIBUTION_GROWTH_RATE,
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
from fire_calculator.math.fire_age import calculate_fire
from fire_calculator.types import FireInputs, FireResult, FourPercentRuleTarget


def _result(
    fire_age: int | None,
    months_until_fire: int | None,
) -> FireResult:
    return FireResult(
        fire_age=fire_age,
        years_until_fire=None,
        months_until_fire=months_until_fire,
        portfolio_at_fire=None,
        four_percent_rule=FourPercentRuleTarget(0.0, 0.0, 0.0),
        accumulation_curve=(),
        requirement_curve=(),
    )


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
    assert inputs.contribution_growth_rate == DEFAULT_CONTRIBUTION_GROWTH_RATE


def test_flat_nominal_contribution_shrinks_in_real_terms() -> None:
    inputs = default_inputs()

    assert inputs.nominal_monthly_contribution(0) == pytest.approx(1_000.0)
    assert inputs.nominal_monthly_contribution(1) == pytest.approx(1_000.0)
    assert inputs.real_monthly_contribution(1) == pytest.approx(1_000.0 / 1.03)


def test_contribution_raise_grows_the_nominal_schedule() -> None:
    inputs = FireInputs(
        current_age=24,
        life_expectancy=90,
        monthly_contribution=1_000.0,
        annual_roi=0.08,
        inflation_rate=0.03,
        management_fee_rate=0.0023,
        desired_monthly_net_income=3_000.0,
        gains_tax_rate=0.196,
        contribution_growth_rate=0.05,
    )

    assert inputs.nominal_monthly_contribution(1) == pytest.approx(1_050.0)
    assert inputs.real_monthly_contribution(1) == pytest.approx(1_050.0 / 1.03)


def test_real_annual_return() -> None:
    inputs = default_inputs()
    expected = (1 + DEFAULT_ANNUAL_ROI) / (1 + DEFAULT_INFLATION_RATE) / (1 + DEFAULT_MANAGEMENT_FEE_RATE) - 1
    subtractive = (DEFAULT_ANNUAL_ROI - DEFAULT_INFLATION_RATE - DEFAULT_MANAGEMENT_FEE_RATE)

    assert inputs.real_annual_return == pytest.approx(expected)
    assert inputs.real_annual_return < subtractive


def test_four_percent_reference_math() -> None:
    inputs = default_inputs()
    annual_net = inputs.desired_monthly_net_income * 12
    annual_gross = annual_net / (1 - inputs.gains_tax_rate)
    target = annual_gross * FOUR_PERCENT_MULTIPLIER

    assert annual_net == DEFAULT_DESIRED_MONTHLY_NET_INCOME * 12
    assert annual_gross == pytest.approx(annual_net / (1 - DEFAULT_GAINS_TAX_RATE))
    assert target == pytest.approx(annual_gross * FOUR_PERCENT_MULTIPLIER)


def test_fire_age_exact_adds_month_offset() -> None:
    assert _result(52, 9).fire_age_exact == pytest.approx(52.75)
    assert _result(41, 0).fire_age_exact == pytest.approx(41.0)


def test_fire_age_exact_is_none_when_fire_not_reached() -> None:
    assert _result(None, None).fire_age_exact is None
    assert _result(52, None).fire_age_exact is None
    assert _result(None, 9).fire_age_exact is None


def test_fire_age_exact_matches_calculated_result() -> None:
    result = calculate_fire(default_inputs())
    assert result.fire_age is not None
    assert result.months_until_fire is not None

    expected = result.fire_age + result.months_until_fire / 12
    assert result.fire_age_exact == pytest.approx(expected)


def test_invalid_age_raises() -> None:
    with pytest.raises(ValueError, match="less than life expectancy"):
        FireInputs(
            current_age=60,
            life_expectancy=50,
            monthly_contribution=1_000.0,
            annual_roi=0.07,
            inflation_rate=0.03,
            management_fee_rate=0.0023,
            desired_monthly_net_income=3_000.0,
            gains_tax_rate=0.20,
        )
