import pytest
import uvicorn

from fire_calculator.api import WEB_DIR, index, serialize_result, serve
from fire_calculator.constants import default_inputs
from fire_calculator.math.fire_age import calculate_fire


def test_serialize_result_has_year_zero_and_fire_row() -> None:
    inputs = default_inputs()
    payload = serialize_result(inputs, calculate_fire(inputs))

    assert payload["table"][0]["year"] == 0
    assert payload["table"][0]["age"] == inputs.current_age
    assert payload["table"][0]["monthly_contribution"] == pytest.approx(inputs.monthly_contribution)
    assert payload["summary"]["fire_age"] is not None
    fire_rows = [row for row in payload["table"] if row["is_fire"]]
    assert len(fire_rows) == 1
    assert fire_rows[0]["portfolio"] >= fire_rows[0]["required"]
    assert fire_rows[0]["age"] == payload["summary"]["fire_age"]
    assert len(payload["chart"]["ages"]) == len(payload["chart"]["required"])
    assert len(payload["chart"]["portfolio"]) <= len(payload["chart"]["ages"])
    assert payload["summary"]["current_age"] == inputs.current_age
    assert payload["summary"]["inflation_rate"] == pytest.approx(inputs.inflation_rate)
    assert payload["summary"]["ss_retirement_age"] == pytest.approx(66.75)
    assert payload["summary"]["months_ahead_of_ss"] is not None
    assert payload["chart"]["ss_retirement_age"] == pytest.approx(66.75)


def _captured_serve(monkeypatch) -> dict:
    captured: dict = {}
    monkeypatch.setattr(uvicorn, "run", lambda app, **kwargs: captured.update(kwargs, app=app))
    serve()
    return captured


def test_serve_defaults_to_localhost_8000(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HOST", raising=False)
    monkeypatch.delenv("PORT", raising=False)

    captured = _captured_serve(monkeypatch)

    assert captured["app"] == "fire_calculator.api:app"
    assert captured["host"] == "127.0.0.1"
    assert captured["port"] == 8000
    assert captured["reload"] is True


def test_index_busts_static_asset_cache() -> None:
    response = index()
    html = response.body.decode()

    assert response.headers["cache-control"] == "no-store"
    assert "/static/app.js?v=" in html
    assert "/static/styles.css?v=" in html
    assert "/static/favicon.svg?v=" in html
    assert 'id="plan-warning"' in html


def test_web_script_keeps_errors_out_of_fire_in() -> None:
    script = (WEB_DIR / "app.js").read_text(encoding="utf-8")

    assert "showWarning" in script
    assert "rejectNonDigitKey" in script
    assert "fireIn.textContent = await readError" not in script


def test_serve_reads_host_and_port_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.setenv("PORT", "3000")

    captured = _captured_serve(monkeypatch)

    assert captured["host"] == "0.0.0.0"
    assert captured["port"] == 3000
