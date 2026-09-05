from __future__ import annotations

from fire_calculator import calculate_fire, load_inputs
from fire_calculator.math.fire_age import interpolate_required
from fire_calculator.plot import plot_fire


def _euro(value: float) -> str:
    return f"{value:,.2f}€"


def _format_duration(years: int, months: int) -> str:
    year_label = "year" if years == 1 else "years"
    month_label = "month" if months == 1 else "months"
    return f"{years} {year_label} and {months} {month_label}"


def main() -> None:
    inputs = load_inputs()
    result = calculate_fire(inputs)

    print("Inputs")
    print(f"  age                    {inputs.current_age} → {inputs.life_expectancy}")
    print(f"  monthly contribution   {_euro(inputs.monthly_contribution)}")
    print(f"  contribution raise     {inputs.contribution_growth_rate:.2%}/year")
    print(f"  initial balance        {_euro(inputs.initial_balance)}")
    print(f"  ROI / inflation / fee  {inputs.annual_roi:.2%} / {inputs.inflation_rate:.2%} / {inputs.management_fee_rate:.2%}")
    print(f"  real return            {inputs.real_annual_return:.2%}")
    print(f"  desired net / month    {_euro(inputs.desired_monthly_net_income)}")
    print(f"  gains tax              {inputs.gains_tax_rate:.2%}")
    print()

    print("4% rule (reference only)")
    print(f"  annual net             {_euro(result.four_percent_rule.annual_net_income)}")
    print(f"  annual gross           {_euro(result.four_percent_rule.annual_gross_income)}")
    print(f"  target                 {_euro(result.four_percent_rule.target_portfolio)}")
    print()

    if result.fire_age is None:
        print("FIRE age                 not reached")
    else:
        print(f"FIRE age                 {result.fire_age}")
        print(
            f"FIRE in                  {_format_duration(result.years_until_fire or 0, result.months_until_fire or 0)}"
        )
        print(f"portfolio at FIRE        {_euro(result.portfolio_at_fire or 0.0)}")
    print()

    print("age   contribution     invested     portfolio      required")
    for point in result.accumulation_curve:
        if abs(point.age - round(point.age)) > 1e-9:
            continue
        required = interpolate_required(result.requirement_curve, point.age)
        is_fire_year = result.fire_age is not None and round(point.age) == result.fire_age
        marker = "  <-- FIRE" if is_fire_year else ""
        print(
            f"{point.age:>3.0f}   {_euro(point.monthly_contribution):>13}  "
            f"{_euro(point.contributed):>13}  "
            f"{_euro(point.portfolio):>13}  {_euro(required):>13}{marker}"
        )

    plot_fire(result)


if __name__ == "__main__":
    main()
