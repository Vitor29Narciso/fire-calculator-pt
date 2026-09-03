from __future__ import annotations

from fire_calculator.math.fire_age import interpolate_required
from fire_calculator.types import FireResult

_YEARS_AFTER_FIRE = 0


def _fire_age_exact(result: FireResult) -> float | None:
    if result.fire_age is None or result.months_until_fire is None:
        return None
    return result.fire_age + result.months_until_fire / 12


def plot_fire(result: FireResult, *, show: bool = True) -> None:
    import matplotlib.pyplot as plt

    last_age = result.accumulation_curve[-1].age
    fire_at = _fire_age_exact(result)
    if fire_at is not None:
        last_age = min(last_age, fire_at + _YEARS_AFTER_FIRE)

    accumulation = [point for point in result.accumulation_curve if point.age <= last_age + 1e-9]

    ages = [point.age for point in accumulation]
    contributed = [point.contributed for point in accumulation]
    portfolio = [point.portfolio for point in accumulation]
    required_ages = [point.age for point in result.accumulation_curve]
    required = [
        interpolate_required(result.requirement_curve, point.age)
        for point in result.accumulation_curve
    ]

    figure, axes = plt.subplots(figsize=(10, 6))
    axes.plot(ages, contributed, color="#3b82f6", label="Contributions")
    axes.plot(ages, portfolio, color="#ef4444", label="Portfolio")
    axes.plot(required_ages, required, color="#eab308", label="Required to Retire")

    if fire_at is not None and result.portfolio_at_fire is not None:
        axes.axvline(fire_at, color="#6b7280", linestyle="--", linewidth=1)
        axes.scatter(
            [fire_at],
            [result.portfolio_at_fire],
            color="#111827",
            zorder=5,
        )
        axes.annotate(
            f"FIRE {result.fire_age}",
            xy=(fire_at, result.portfolio_at_fire),
            xytext=(8, 8),
            textcoords="offset points",
        )

    axes.set_title("FIRE projection")
    axes.set_xlabel("Age")
    axes.set_ylabel("Today's euros")
    if required:
        axes.set_ylim(0, max(required) * 1.08)
    axes.grid(True, alpha=0.3)
    axes.legend()
    figure.tight_layout()

    if show:
        plt.show()
