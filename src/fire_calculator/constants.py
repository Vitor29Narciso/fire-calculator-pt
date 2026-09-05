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
DEFAULT_CONTRIBUTION_GROWTH_RATE = 0.0

FOUR_PERCENT_WITHDRAWAL_RATE = 0.04
FOUR_PERCENT_MULTIPLIER = 25

# Portugal legal retirement age in 2026 (Portaria n.º 358/2024/1).
# Comparison marker only — SS income is not in the model.
SS_RETIREMENT_AGE_YEARS = 66
SS_RETIREMENT_AGE_MONTHS = 9
SS_RETIREMENT_AGE = SS_RETIREMENT_AGE_YEARS + SS_RETIREMENT_AGE_MONTHS / 12


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
        contribution_growth_rate=DEFAULT_CONTRIBUTION_GROWTH_RATE,
    )
