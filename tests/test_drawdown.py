import pytest

from fire_calculator.constants import default_inputs
from fire_calculator.math.drawdown import (
    find_gross_for_target_net,
    required_portfolio_value,
    simulate_drawdown,
)
from fire_calculator.math.lots import Lot, Portfolio


def test_fifo_uses_oldest_lot_first() -> None:
    portfolio = Portfolio(
        lots=[
            Lot(units=100.0, cost_per_unit=1.0),
            Lot(units=100.0, cost_per_unit=2.0),
        ],
        unit_price=2.0,
    )

    taxable_gain = portfolio.taxable_gain_for_gross_withdrawal(200.0)

    assert taxable_gain == pytest.approx(100.0)


def test_fifo_taxes_recent_lot_with_lower_gain() -> None:
    portfolio = Portfolio(
        lots=[
            Lot(units=100.0, cost_per_unit=1.0),
            Lot(units=100.0, cost_per_unit=2.5),
        ],
        unit_price=3.0,
    )

    gain_first_lot_only = portfolio.taxable_gain_for_gross_withdrawal(300.0)
    gain_both_lots = portfolio.taxable_gain_for_gross_withdrawal(600.0)

    assert gain_first_lot_only == pytest.approx(200.0)
    assert gain_both_lots == pytest.approx(250.0)


def test_withdraw_for_net_uses_fifo_lots() -> None:
    portfolio = Portfolio(
        lots=[
            Lot(units=100.0, cost_per_unit=1.0),
            Lot(units=100.0, cost_per_unit=2.5),
        ],
        unit_price=3.0,
    )

    result = portfolio.withdraw_for_net(260.8, tax_rate=0.196)
    assert result is not None
    tax, net = result

    assert net == pytest.approx(260.8)
    assert tax == pytest.approx(39.2)
    assert len([lot for lot in portfolio.lots if lot.units > 1e-9]) == 1


def test_find_gross_for_target_net() -> None:
    portfolio = Portfolio.from_lump_sum(10_000.0)
    portfolio.unit_price = 2.0

    gross = find_gross_for_target_net(portfolio, 1_000.0, tax_rate=0.196)
    assert gross is not None

    tax, net = portfolio.copy().withdraw_gross(gross, tax_rate=0.196)
    assert net == pytest.approx(1_000.0, rel=1e-4)
    assert tax == pytest.approx(gross / 2 * 0.196, rel=1e-4)


def test_simulate_drawdown_depletes_lump_sum_portfolio() -> None:
    inputs = default_inputs()
    required = required_portfolio_value(
        Portfolio.from_lump_sum(1.0),
        inputs,
        retirement_age=60,
    )
    portfolio = Portfolio.from_lump_sum(required)

    result = simulate_drawdown(portfolio, inputs, retirement_age=60)

    assert result.success is True
    assert result.ending_value == pytest.approx(0.0, abs=5_000.0)


def test_required_portfolio_value_decreases_with_later_retirement() -> None:
    inputs = default_inputs()
    template = Portfolio.from_lump_sum(1.0)

    required_at_45 = required_portfolio_value(template, inputs, retirement_age=45)
    required_at_60 = required_portfolio_value(template, inputs, retirement_age=60)

    assert required_at_45 > required_at_60


def test_insufficient_portfolio_fails_drawdown() -> None:
    inputs = default_inputs()
    portfolio = Portfolio.from_lump_sum(50_000.0)

    result = simulate_drawdown(portfolio, inputs, retirement_age=60)

    assert result.success is False
    assert result.months_completed < (inputs.life_expectancy - 60) * 12
