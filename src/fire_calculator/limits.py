"""Single source of truth for input bounds and slider steps.

The web form, FastAPI request model, and ``FireInputs`` all read from
``FIELD_LIMITS``. Change a range here and every surface picks it up.
"""

from __future__ import annotations

from dataclasses import dataclass


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
    "current_age": "Current age",
    "life_expectancy": "Life expectancy",
    "monthly_contribution": "Monthly contribution",
    "initial_balance": "Initial balance",
    "desired_monthly_net_income": "Desired net / month",
    "contribution_growth_rate": "Yearly contribution raise",
    "annual_roi": "Annual ROI",
    "inflation_rate": "Inflation",
    "management_fee_rate": "Management fee",
    "gains_tax_rate": "Gains tax",
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
}


def limits_payload() -> dict[str, dict[str, float | bool]]:
    return {name: limit.as_dict() for name, limit in FIELD_LIMITS.items()}


def format_bound(name: str, value: float) -> str:
    limit = FIELD_LIMITS[name]
    if limit.integer:
        return str(int(value))
    return f"{value * 100:g}%"


def check_field_limits(**values: float) -> None:
    for name, value in values.items():
        limit = FIELD_LIMITS[name]
        label = FIELD_LABELS[name]
        if limit.integer and float(value) != int(value):
            raise ValueError(f"{label} must be a whole number")
        if value < limit.minimum or value > limit.maximum:
            raise ValueError(
                f"{label} must be between {format_bound(name, limit.minimum)} "
                f"and {format_bound(name, limit.maximum)}"
            )
