from __future__ import annotations

import tomllib
from dataclasses import fields
from pathlib import Path

from fire_calculator.constants import default_inputs
from fire_calculator.types import FireInputs

DEFAULT_CONFIG_PATH = Path("fire.toml")
_INPUT_FIELDS = {field.name for field in fields(FireInputs)}


def load_inputs(path: Path | str | None = None) -> FireInputs:
    """Load FireInputs from a TOML file, falling back to built-in defaults."""
    config_path = Path(path) if path is not None else DEFAULT_CONFIG_PATH
    if not config_path.exists():
        return default_inputs()

    with config_path.open("rb") as handle:
        data = tomllib.load(handle)

    unknown = set(data) - _INPUT_FIELDS
    if unknown:
        names = ", ".join(sorted(unknown))
        raise ValueError(f"Unknown config keys: {names}")

    return FireInputs(**{**default_inputs().__dict__, **data})
