from dataclasses import asdict

import pytest
from fastapi.testclient import TestClient

from fire_calculator.api import app
from fire_calculator.constants import default_inputs
from fire_calculator.simulations import (
    SIMULATION_ID_LENGTH,
    load_simulation,
    save_simulation,
    valid_simulation_id,
)


@pytest.fixture
def simulation_db(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "simulations.db"
    monkeypatch.setenv("FIRE_SIMULATION_DB", str(db_path))


def test_valid_simulation_id() -> None:
    assert valid_simulation_id("aB3xY9zQ")
    assert not valid_simulation_id("short")
    assert not valid_simulation_id("bad-chars!")
    assert not valid_simulation_id("123456789")


def test_save_and_load_simulation(simulation_db) -> None:
    inputs = default_inputs()
    simulation_id = save_simulation(inputs)

    assert len(simulation_id) == SIMULATION_ID_LENGTH
    assert valid_simulation_id(simulation_id)
    assert load_simulation(simulation_id) == asdict(inputs)


def test_load_unknown_simulation_returns_none(simulation_db) -> None:
    assert load_simulation("00000000") is None


def test_load_invalid_id_returns_none(simulation_db) -> None:
    assert load_simulation("not-valid") is None


def _payload(inputs=default_inputs()) -> dict:
    return asdict(inputs)


def test_create_and_fetch_simulation_api(simulation_db) -> None:
    client = TestClient(app)
    payload = _payload()

    created = client.post("/api/simulations", json=payload)
    assert created.status_code == 200
    body = created.json()
    assert valid_simulation_id(body["id"])
    assert body["path"] == f"/s/{body['id']}"

    fetched = client.get(f"/api/simulations/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == payload


def test_get_simulation_api_404(simulation_db) -> None:
    client = TestClient(app)

    missing = client.get("/api/simulations/00000000")
    assert missing.status_code == 404

    invalid = client.get("/api/simulations/not-valid")
    assert invalid.status_code == 404


def test_shared_simulation_route_serves_index(simulation_db) -> None:
    client = TestClient(app)
    created = client.post("/api/simulations", json=_payload()).json()

    response = client.get(created["path"])
    assert response.status_code == 200
    assert 'id="share-simulation"' in response.text


def test_shared_simulation_route_404_when_missing(simulation_db) -> None:
    client = TestClient(app)
    response = client.get("/s/00000000")
    assert response.status_code == 404


def test_create_simulation_rejects_invalid_payload(simulation_db) -> None:
    client = TestClient(app)
    payload = _payload()
    payload["current_age"] = 79
    payload["life_expectancy"] = 79

    response = client.post("/api/simulations", json=payload)
    assert response.status_code == 400
