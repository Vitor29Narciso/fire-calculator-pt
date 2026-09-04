import pytest

from fire_calculator.api import serialize_result
from fire_calculator.constants import default_inputs
from fire_calculator.math.fire_age import calculate_fire


def test_serialize_result_has_year_zero_and_fire_row() -> None:
    inputs = default_inputs()
    payload = serialize_result(inputs, calculate_fire(inputs))

    assert payload["table"][0]["year"] == 0
    assert payload["table"][0]["age"] == inputs.current_age
    assert payload["summary"]["fire_age"] is not None
    fire_rows = [row for row in payload["table"] if row["is_fire"]]
    assert len(fire_rows) == 1
    assert fire_rows[0]["portfolio"] >= fire_rows[0]["required"]
    assert fire_rows[0]["age"] == payload["summary"]["fire_age"]
    assert len(payload["chart"]["ages"]) == len(payload["chart"]["required"])
    assert len(payload["chart"]["portfolio"]) <= len(payload["chart"]["ages"])
    assert payload["summary"]["ss_retirement_age"] == pytest.approx(66.75)
    assert payload["summary"]["months_ahead_of_ss"] is not None
    assert payload["chart"]["ss_retirement_age"] == pytest.approx(66.75)
