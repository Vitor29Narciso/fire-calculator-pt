from dataclasses import dataclass

from fire_calculator.limits import check_field_limits


@dataclass(frozen=True)
class FireInputs:
    """Calculator inputs.

    ``monthly_contribution`` is this year's standing order (today's paycheck
    euros). It is raised nominally each birthday by ``contribution_growth_rate``.
    The engine then deflates that schedule by inflation so portfolio math stays
    in today's purchasing power. Retirement spending is already in today's euros.
    """

    current_age: int
    life_expectancy: int
    monthly_contribution: float
    annual_roi: float
    inflation_rate: float
    management_fee_rate: float
    desired_monthly_net_income: float
    gains_tax_rate: float
    initial_balance: float = 0.0
    contribution_growth_rate: float = 0.0

    def __post_init__(self) -> None:
        check_field_limits(
            current_age=self.current_age,
            life_expectancy=self.life_expectancy,
            monthly_contribution=self.monthly_contribution,
            initial_balance=self.initial_balance,
            desired_monthly_net_income=self.desired_monthly_net_income,
            annual_roi=self.annual_roi,
            inflation_rate=self.inflation_rate,
            management_fee_rate=self.management_fee_rate,
            gains_tax_rate=self.gains_tax_rate,
            contribution_growth_rate=self.contribution_growth_rate,
        )
        if self.current_age >= self.life_expectancy:
            raise ValueError("Current age must be less than life expectancy")

    def nominal_monthly_contribution(self, year_index: int) -> float:
        """Standing order in that year's euros after ``year_index`` raises."""
        return self.monthly_contribution * (1 + self.contribution_growth_rate) ** year_index

    def real_monthly_contribution(self, year_index: int) -> float:
        """Standing order in today's purchasing power after ``year_index`` years."""
        return self.nominal_monthly_contribution(year_index) / (
            (1 + self.inflation_rate) ** year_index
        )

    @property
    def real_annual_return(self) -> float:
        """Fisher real return in today's purchasing power.

        ``(1 + roi) / (1 + inflation) / (1 + fee) - 1``, so inflation and the
        management fee compound against the nominal return rather than being
        subtracted as independent percentage points.
        """
        return (1 + self.annual_roi) / (1 + self.inflation_rate) / (1 + self.management_fee_rate) - 1


@dataclass(frozen=True)
class AccumulationPoint:
    age: float
    portfolio: float
    contributed: float
    monthly_contribution: float


@dataclass(frozen=True)
class RequirementPoint:
    age: float
    required_capital: float


@dataclass(frozen=True)
class FourPercentRuleTarget:
    """Reference target from the 4% rule of thumb (not the main FIRE logic)."""

    annual_net_income: float
    annual_gross_income: float
    target_portfolio: float


@dataclass(frozen=True)
class FireResult:
    fire_age: int | None
    years_until_fire: int | None
    months_until_fire: int | None
    portfolio_at_fire: float | None
    four_percent_rule: FourPercentRuleTarget
    accumulation_curve: tuple[AccumulationPoint, ...]
    requirement_curve: tuple[RequirementPoint, ...]

    @property
    def fire_age_exact(self) -> float | None:
        """FIRE age including the month offset, or None if FIRE is never reached."""
        if self.fire_age is None or self.months_until_fire is None:
            return None
        return self.fire_age + self.months_until_fire / 12
