from fire_calculator.types import FireInputs

DEFAULT_CURRENT_AGE = 24
DEFAULT_LIFE_EXPECTANCY = 90
DEFAULT_MONTHLY_CONTRIBUTION = 1_000.0
DEFAULT_ANNUAL_ROI = 0.08
DEFAULT_INFLATION_RATE = 0.03
DEFAULT_MANAGEMENT_FEE_RATE = 0.0023
DEFAULT_DESIRED_MONTHLY_NET_INCOME = 3_000.0
DEFAULT_GAINS_TAX_RATE = 0.196
DEFAULT_INITIAL_BALANCE = 0.0

FOUR_PERCENT_WITHDRAWAL_RATE = 0.04
FOUR_PERCENT_MULTIPLIER = 25


def default_inputs() -> FireInputs:
    """Defaults aligned with the Google Sheets prototype."""
    return FireInputs(
        current_age=DEFAULT_CURRENT_AGE,
        life_expectancy=DEFAULT_LIFE_EXPECTANCY,
        monthly_contribution=DEFAULT_MONTHLY_CONTRIBUTION,
        annual_roi=DEFAULT_ANNUAL_ROI,
        inflation_rate=DEFAULT_INFLATION_RATE,
        management_fee_rate=DEFAULT_MANAGEMENT_FEE_RATE,
        desired_monthly_net_income=DEFAULT_DESIRED_MONTHLY_NET_INCOME,
        gains_tax_rate=DEFAULT_GAINS_TAX_RATE,
        initial_balance=DEFAULT_INITIAL_BALANCE,
    )
