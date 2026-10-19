"""Portuguese pension cash flows in today's euros.

The estimator implements the post-2002 general-regime accrual formula, using
2026 IAS. It is an approximation, not a Segurança Social entitlement calculation.
Pre-2002 careers require a mixed formula; manual net input is preferable.
Sources: DL 187/2007 arts 28–33; Portaria 480-A/2025/1 (IAS).
"""

from __future__ import annotations

from math import floor

from fire_calculator.types import FireInputs

IAS_2026 = 537.13
MIN_CONTRIBUTION_YEARS = 15
MAX_CONTRIBUTION_YEARS = 40


def estimated_monthly_gross_pension(inputs: FireInputs, retirement_age: float) -> float:
    """Estimate one of 14 payments; service and earnings stop at FIRE.

    Future earnings stay constant in real terms. Past pay is assumed already
    revalued into today's euros. No blank years are added after stopping work.
    Whole service years are used as a deliberately simple calendar-year proxy.
    """
    past_years = min(MAX_CONTRIBUTION_YEARS, inputs.contribution_years)
    future_years = min(
        MAX_CONTRIBUTION_YEARS - past_years,
        max(0, floor(retirement_age - inputs.current_age + 1e-9)),
    ) if inputs.current_gross_monthly_salary > 0 else 0
    years = past_years + future_years
    if years < MIN_CONTRIBUTION_YEARS:
        return 0.0
    reference_salary = (
        inputs.career_average_monthly_salary * past_years
        + inputs.current_gross_monthly_salary * future_years
    ) / years
    if years <= 20:
        return reference_salary * 0.02 * years

    remaining = reference_salary
    accrual = 0.0
    previous = 0.0
    for boundary, rate in (
        (1.1 * IAS_2026, 0.023),
        (2 * IAS_2026, 0.0225),
        (4 * IAS_2026, 0.022),
        (8 * IAS_2026, 0.021),
        (float("inf"), 0.02),
    ):
        amount = min(remaining, boundary - previous)
        accrual += amount * rate
        remaining -= amount
        if remaining <= 0:
            break
        previous = boundary
    return accrual * years


def annual_net_pension(inputs: FireInputs, retirement_age: float) -> float:
    """Annual real pension after separately assumed pension income tax.

    Manual amounts are net per payment and may use 12–14 payments. The salary
    estimate always uses Portugal's 14 payments. Capital gains tax is unrelated.
    """
    if inputs.pension_mode == 1:
        return inputs.pension_monthly_net * inputs.pension_payments_per_year
    if inputs.pension_mode == 2:
        gross = estimated_monthly_gross_pension(inputs, retirement_age)
        return gross * 14 * (1 - inputs.pension_tax_rate)
    return 0.0


def pension_for_period(
    inputs: FireInputs,
    retirement_age: float,
    period_start_age: float,
    period_end_age: float,
) -> float:
    """Prorate annual income from the chosen start age over a period.

    Payments are smoothed monthly, including the two extra pension payments.
    Surplus pension covers spending only; the calculator does not reinvest it.
    """
    start = max(retirement_age, inputs.pension_start_age, period_start_age)
    years = max(0.0, period_end_age - start)
    return annual_net_pension(inputs, retirement_age) * years
