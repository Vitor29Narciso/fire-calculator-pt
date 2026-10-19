from dataclasses import asdict, replace

import pytest
from fastapi.testclient import TestClient

from fire_calculator.api import app
from fire_calculator.constants import default_inputs


def _request(**overrides):
    inputs = replace(default_inputs(), simulation_count=100, **overrides)
    response = TestClient(app).post("/api/calculate", json=asdict(inputs))
    assert response.status_code == 200, response.text
    return response.json()


def test_monte_carlo_is_default_reproducible_and_has_complete_retirement_paths():
    first = _request()
    assert _request() == first
    summary, chart = first["summary"], first["chart"]
    assert summary["method"] == "monte_carlo"
    assert summary["success_probability"] >= summary["target_success_probability"]
    assert chart["fire_age_exact"] is not None
    for key in ("portfolio", "contributed", "portfolio_p10", "portfolio_p90", "required"):
        assert len(chart[key]) == len(chart["ages"])
    for low, mid, high in zip(chart["portfolio_p10"], chart["portfolio"], chart["portfolio_p90"]):
        assert 0 <= low <= mid <= high
    retired = [row for row in first["table"] if row["age"] + row["age_months"] / 12 >= chart["fire_age_exact"] - 1e-6]
    assert all(row["monthly_contribution"] == 0 for row in retired)
    assert len({row["contributed"] for row in retired}) == 1
    assert sum(row["is_fire"] for row in first["table"]) == 1


def test_pension_cashflow_starts_at_selected_age():
    result = _request(
        current_age=60, life_expectancy=80, initial_balance=2_000_000,
        pension_mode=1, pension_start_age=67, pension_monthly_net=700,
    )
    assert result["summary"]["fire_age"] == 60
    assert result["summary"]["projected_annual_net_pension"] == 9800
    assert result["summary"]["annual_net_pension_at_fire"] == 0
    assert all(row["annual_net_pension"] == 0 for row in result["table"] if row["age"] < 67)
    assert all(row["annual_net_pension"] == 9800 for row in result["table"] if row["age"] >= 67)


def test_old_saved_inputs_still_calculate_with_new_defaults():
    payload = asdict(default_inputs())
    original_fields = {
        "current_age", "life_expectancy", "monthly_contribution", "initial_balance",
        "annual_roi", "inflation_rate", "management_fee_rate",
        "desired_monthly_net_income", "gains_tax_rate", "contribution_growth_rate",
    }
    response = TestClient(app).post("/api/calculate", json={k: v for k, v in payload.items() if k in original_fields})
    assert response.status_code == 200
    assert response.json()["summary"]["simulation_count"] == 500


def test_no_fire_is_reported_without_probability_claim():
    result = _request(monthly_contribution=0, initial_balance=0)
    assert result["summary"]["fire_age"] is None
    assert result["summary"]["success_probability"] is None
    assert not any(row["is_fire"] for row in result["table"])


@pytest.mark.parametrize("field,value", [
    ("simulation_count", 2001), ("simulation_seed", -1),
    ("annual_volatility", 0.61), ("pension_mode", 3),
])
def test_risk_and_pension_limits_are_enforced(field, value):
    payload = asdict(default_inputs()) | {field: value}
    assert TestClient(app).post("/api/calculate", json=payload).status_code == 422


def test_estimate_does_not_silently_grant_an_unreduced_early_pension():
    payload = asdict(default_inputs()) | {"pension_mode": 2, "pension_start_age": 60}
    response = TestClient(app).post("/api/calculate", json=payload)
    assert response.status_code == 400
    assert "early or special" in response.json()["detail"]
