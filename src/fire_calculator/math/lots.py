from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Lot:
    units: float
    cost_per_unit: float


@dataclass
class Portfolio:
    lots: list[Lot]
    unit_price: float = 1.0
    _head: int = 0
    _units: float = field(init=False)

    def __post_init__(self) -> None:
        self._units = sum(lot.units for lot in self.lots[self._head :])

    @property
    def total_units(self) -> float:
        return self._units

    @property
    def value(self) -> float:
        return self._units * self.unit_price

    @property
    def cost_basis(self) -> float:
        return sum(lot.units * lot.cost_per_unit for lot in self.lots[self._head :])

    @property
    def gain_ratio(self) -> float:
        if self.value <= 0:
            return 0.0
        return max(0.0, 1.0 - self.cost_basis / self.value)

    @property
    def is_single_lot(self) -> bool:
        return (len(self.lots) - self._head) == 1

    def copy(self) -> Portfolio:
        return Portfolio(
            lots=[Lot(lot.units, lot.cost_per_unit) for lot in self.lots[self._head :]],
            unit_price=self.unit_price,
        )

    @classmethod
    def from_lump_sum(cls, amount: float) -> Portfolio:
        """Single lot with no embedded gains at the time of investment."""
        if amount <= 0:
            return cls(lots=[])
        return cls(lots=[Lot(units=amount, cost_per_unit=1.0)], unit_price=1.0)

    def scaled(self, factor: float) -> Portfolio:
        return Portfolio(
            lots=[Lot(lot.units * factor, lot.cost_per_unit) for lot in self.lots[self._head :]],
            unit_price=self.unit_price,
        )

    def compacted(self, group_size: int = 12) -> Portfolio:
        """Merge consecutive lots (e.g. monthly buys into yearly lots). FIFO order stays."""
        remaining = self.lots[self._head :]
        if len(remaining) <= group_size:
            return self.copy()

        merged: list[Lot] = []
        for start in range(0, len(remaining), group_size):
            group = remaining[start : start + group_size]
            units = sum(lot.units for lot in group)
            if units <= 1e-12:
                continue
            cost = sum(lot.units * lot.cost_per_unit for lot in group) / units
            merged.append(Lot(units=units, cost_per_unit=cost))

        return Portfolio(lots=merged, unit_price=self.unit_price)

    def apply_return(self, rate: float) -> None:
        self.unit_price *= 1 + rate

    def apply_monthly_return(self, monthly_rate: float) -> None:
        self.apply_return(monthly_rate)

    def add_contribution(self, amount: float) -> None:
        if amount <= 0:
            return
        units = amount / self.unit_price
        self.lots.append(Lot(units=units, cost_per_unit=self.unit_price))
        self._units += units

    def taxable_gain_for_gross_withdrawal(self, gross: float) -> float:
        remaining = gross
        taxable_gain = 0.0
        price = self.unit_price

        for lot in self.lots[self._head :]:
            if remaining <= 1e-9:
                break

            lot_value = lot.units * price
            if lot_value <= 1e-9:
                continue

            taken = min(remaining, lot_value)
            units_sold = taken / price
            gain = units_sold * (price - lot.cost_per_unit)
            if gain > 0:
                taxable_gain += gain
            remaining -= taken

        if remaining > 1e-6:
            msg = f"Cannot withdraw {gross:.2f}; portfolio value is {self.value:.2f}"
            raise ValueError(msg)

        return taxable_gain

    def withdraw_gross(self, gross: float, tax_rate: float) -> tuple[float, float]:
        """Withdraw gross amount using FIFO. Returns (tax, net)."""
        remaining = gross
        taxable_gain = 0.0
        price = self.unit_price
        index = self._head

        while remaining > 1e-9 and index < len(self.lots):
            lot = self.lots[index]
            lot_value = lot.units * price
            if lot_value <= 1e-12:
                index += 1
                continue

            taken = min(remaining, lot_value)
            units_sold = taken / price
            gain = units_sold * (price - lot.cost_per_unit)
            if gain > 0:
                taxable_gain += gain
            lot.units -= units_sold
            self._units -= units_sold
            remaining -= taken
            if lot.units <= 1e-12:
                lot.units = 0.0
                index += 1

        if remaining > 1e-6:
            msg = f"Cannot withdraw {gross:.2f}; portfolio value is {self.value:.2f}"
            raise ValueError(msg)

        self._head = index
        tax = taxable_gain * tax_rate
        return tax, gross - tax

    def withdraw_for_net(self, target_net: float, tax_rate: float) -> tuple[float, float] | None:
        """Sell oldest lots first until target_net remains after tax. Returns (tax, net)."""
        if self.value <= 0:
            return None

        remaining_net = target_net
        total_tax = 0.0
        price = self.unit_price
        index = self._head

        while remaining_net > 1e-9 and index < len(self.lots):
            lot = self.lots[index]
            if lot.units <= 1e-12:
                index += 1
                continue

            gain_per_euro = max(0.0, 1.0 - lot.cost_per_unit / price)
            net_per_euro = 1.0 - gain_per_euro * tax_rate
            if net_per_euro <= 1e-12:
                return None

            lot_value = lot.units * price
            net_available = lot_value * net_per_euro

            if net_available <= remaining_net + 1e-9:
                tax = lot_value - net_available
                total_tax += tax
                remaining_net -= net_available
                self._units -= lot.units
                lot.units = 0.0
                index += 1
            else:
                gross_needed = remaining_net / net_per_euro
                units_sold = gross_needed / price
                tax = gross_needed * gain_per_euro * tax_rate
                total_tax += tax
                lot.units -= units_sold
                self._units -= units_sold
                remaining_net = 0.0

        self._head = index
        if remaining_net > 1e-6:
            return None
        return total_tax, target_net
