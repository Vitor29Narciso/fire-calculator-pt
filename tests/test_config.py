from dataclasses import replace
from pathlib import Path

from fire_calculator.config import load_inputs
from fire_calculator.constants import default_inputs


def test_load_inputs_uses_defaults_when_file_missing(tmp_path: Path) -> None:
    inputs = load_inputs(tmp_path / "missing.toml")

    assert inputs == default_inputs()


def test_load_inputs_overrides_from_toml(tmp_path: Path) -> None:
    config = tmp_path / "fire.toml"
    config.write_text(
        "\n".join(
            [
                "current_age = 30",
                "monthly_contribution = 1500.0",
                "annual_roi = 0.07",
            ]
        )
    )

    inputs = load_inputs(config)
    expected = replace(
        default_inputs(),
        current_age=30,
        monthly_contribution=1500.0,
        annual_roi=0.07,
    )

    assert inputs == expected
