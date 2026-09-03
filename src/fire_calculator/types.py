from dataclasses import dataclass


@dataclass(frozen=True)
class FireInputs:
    """Calculator inputs. All monetary values are in today's euros (real terms)."""

    current_age: int
    life_expectancy: int
    monthly_contribution: float
    annual_roi: float
    inflation_rate: float
    management_fee_rate: float
    desired_monthly_net_income: float
    gains_tax_rate: float
    initial_balance: float = 0.0

    def __post_init__(self) -> None:
        if self.current_age >= self.life_expectancy:
            raise ValueError("current_age must be less than life_expectancy")
        if self.monthly_contribution < 0:
            raise ValueError("monthly_contribution must be non-negative")
        if self.initial_balance < 0:
            raise ValueError("initial_balance must be non-negative")
        if self.desired_monthly_net_income <= 0:
            raise ValueError("desired_monthly_net_income must be positive")
        for name, rate in (
            ("annual_roi", self.annual_roi),
            ("inflation_rate", self.inflation_rate),
            ("management_fee_rate", self.management_fee_rate),
            ("gains_tax_rate", self.gains_tax_rate),
        ):
            if not 0 <= rate < 1:
                raise ValueError(f"{name} must be between 0 and 1 (exclusive of 1)")

    @property
    def real_annual_return(self) -> float:
        """Real return used for projections in today's purchasing power."""
        return self.annual_roi - self.inflation_rate - self.management_fee_rate


@dataclass(frozen=True)
class AccumulationPoint:
    age: int
    portfolio: float
    contributed: float


@dataclass(frozen=True)
class RequirementPoint:
    age: int
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
    portfolio_at_fire: float | None
    four_percent_rule: FourPercentRuleTarget
    accumulation_curve: tuple[AccumulationPoint, ...]
    requirement_curve: tuple[RequirementPoint, ...]
