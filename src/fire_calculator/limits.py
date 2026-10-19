"""Single source of truth for input bounds and slider steps.

The web form, FastAPI request model, and ``FireInputs`` all read from
``FIELD_LIMITS``. Change a range here and every surface picks it up.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class FieldLimit:
    minimum: float
    maximum: float
    step: float
    integer: bool = False

    def as_dict(self) -> dict[str, float | bool]:
        return {
            "min": self.minimum,
            "max": self.maximum,
            "step": self.step,
            "integer": self.integer,
        }


FIELD_LABELS: dict[str, str] = {
    "current_age": "Current Age",
    "life_expectancy": "Life Expectancy",
    "monthly_contribution": "Monthly Contribution",
    "initial_balance": "Initial Balance",
    "desired_monthly_net_income": "Monthly Retirement Spending",
    "contribution_growth_rate": "Annual Contribution Raise",
    "annual_roi": "Annual ROI",
    "inflation_rate": "Inflation Rate",
    "management_fee_rate": "Other Fees",
    "gains_tax_rate": "Gains Tax",
    "withdrawal_rate": "Withdrawal Rate",
    "ss_retirement_age": "Retirement Age",
    "annual_volatility": "Annual Volatility",
    "success_probability": "Target Success Probability",
    "simulation_count": "Simulation Count",
    "simulation_seed": "Simulation Seed",
    "pension_mode": "Pension Mode",
    "pension_start_age": "Pension Start Age",
    "pension_monthly_net": "Net Pension per Payment",
    "pension_payments_per_year": "Pension Payments per Year",
    "current_gross_monthly_salary": "Current Gross Monthly Salary",
    "career_average_monthly_salary": "Career Average Monthly Salary",
    "contribution_years": "Contribution Years to Date",
    "pension_tax_rate": "Effective Pension Tax Rate",
}

FIELD_LIMITS: dict[str, FieldLimit] = {
    "current_age": FieldLimit(1, 80, 1, integer=True),
    "life_expectancy": FieldLimit(50, 120, 1, integer=True),
    "monthly_contribution": FieldLimit(0, 100_000, 50, integer=True),
    "initial_balance": FieldLimit(0, 20_000_000, 1_000, integer=True),
    "desired_monthly_net_income": FieldLimit(1, 100_000, 50, integer=True),
    "contribution_growth_rate": FieldLimit(0, 0.10, 0.005),
    "annual_roi": FieldLimit(0, 0.15, 0.005),
    "inflation_rate": FieldLimit(0, 0.10, 0.005),
    "management_fee_rate": FieldLimit(0, 0.02, 0.0001),
    "gains_tax_rate": FieldLimit(0, 0.40, 0.001),
    "annual_volatility": FieldLimit(0, 0.60, 0.01),
    "success_probability": FieldLimit(0.50, 0.99, 0.01),
    "simulation_count": FieldLimit(100, 2000, 100, integer=True),
    "simulation_seed": FieldLimit(0, 2_147_483_647, 1, integer=True),
    "pension_mode": FieldLimit(0, 2, 1, integer=True),
    "pension_start_age": FieldLimit(55, 80, 0.25),
    "pension_monthly_net": FieldLimit(0, 100_000, 50, integer=True),
    "pension_payments_per_year": FieldLimit(12, 14, 1, integer=True),
    "current_gross_monthly_salary": FieldLimit(0, 100_000, 50, integer=True),
    "career_average_monthly_salary": FieldLimit(0, 100_000, 50, integer=True),
    "contribution_years": FieldLimit(0, 64, 1, integer=True),
    "pension_tax_rate": FieldLimit(0, 0.60, 0.01),
}

COMPARE_LIMITS: dict[str, FieldLimit] = {
    "withdrawal_rate": FieldLimit(0.01, 0.05, 0.005),
    "ss_retirement_age": FieldLimit(55, 75, 0.25),
}


def limits_payload() -> dict[str, dict[str, float | bool]]:
    return {
        name: limit.as_dict()
        for name, limit in {**FIELD_LIMITS, **COMPARE_LIMITS}.items()
    }


def format_bound(name: str, value: float) -> str:
    limit = FIELD_LIMITS[name]
    if limit.integer:
        return str(int(value))
    if name in {"pension_start_age"}:
        return f"{value:g}"
    return f"{value * 100:g}%"


def check_field_limits(**values: float) -> None:
    for name, value in values.items():
        limit = FIELD_LIMITS[name]
        label = FIELD_LABELS[name]
        if not isfinite(value):
            raise ValueError(f"{label} must be finite")
        if limit.integer and float(value) != int(value):
            raise ValueError(f"{label} must be a whole number")
        if value < limit.minimum or value > limit.maximum:
            raise ValueError(
                f"{label} must be between {format_bound(name, limit.minimum)} "
                f"and {format_bound(name, limit.maximum)}"
            )
