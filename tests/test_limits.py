import pytest
from pydantic import ValidationError

from fire_calculator.api import CalculateRequest
from fire_calculator.constants import default_inputs
from fire_calculator.limits import FIELD_LIMITS, limits_payload
from fire_calculator.types import FireInputs


def _inputs(**overrides: object) -> FireInputs:
    values = default_inputs().__dict__ | overrides
    return FireInputs(**values)


def test_default_inputs_are_within_limits() -> None:
    inputs = default_inputs()
    for name, limit in FIELD_LIMITS.items():
        value = getattr(inputs, name)
        assert limit.minimum <= value <= limit.maximum


def test_limits_payload_exposes_min_max_step() -> None:
    payload = limits_payload()
    assert set(payload) == set(FIELD_LIMITS)
    assert payload["current_age"] == {"min": 1, "max": 80, "step": 1, "integer": True}
    assert payload["annual_roi"]["max"] == 0.15
    assert payload["annual_roi"]["step"] == 0.005
    assert payload["annual_roi"]["integer"] is False


def test_out_of_range_current_age_raises() -> None:
    with pytest.raises(ValueError, match="Current age must be between 1 and 80"):
        _inputs(current_age=81)


def test_fractional_money_raises() -> None:
    with pytest.raises(ValueError, match="Monthly contribution must be a whole number"):
        _inputs(monthly_contribution=1000.5)


def test_calculate_request_uses_shared_limits() -> None:
    data = default_inputs().__dict__
    data["current_age"] = 81
    with pytest.raises(ValidationError):
        CalculateRequest(**data)


def test_calculate_request_accepts_defaults() -> None:
    payload = CalculateRequest(**default_inputs().__dict__)
    assert payload.current_age == 24
    assert payload.monthly_contribution == 1000
