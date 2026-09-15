"""Persist shared calculator simulations in SQLite."""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
from dataclasses import asdict
from pathlib import Path

from fire_calculator.types import FireInputs

SIMULATION_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
SIMULATION_ID_LENGTH = 8


def simulation_db_path() -> Path:
    raw = os.environ.get("FIRE_SIMULATION_DB")
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "data" / "simulations.db"


def valid_simulation_id(simulation_id: str) -> bool:
    return len(simulation_id) == SIMULATION_ID_LENGTH and all(
        character in SIMULATION_ID_ALPHABET for character in simulation_id
    )


def _connect() -> sqlite3.Connection:
    path = simulation_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(path)


def init_db() -> None:
    with _connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS simulations (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )


def new_simulation_id() -> str:
    return "".join(secrets.choice(SIMULATION_ID_ALPHABET) for _ in range(SIMULATION_ID_LENGTH))


def save_simulation(inputs: FireInputs) -> str:
    payload = json.dumps(asdict(inputs))
    init_db()
    for _ in range(8):
        simulation_id = new_simulation_id()
        try:
            with _connect() as connection:
                connection.execute(
                    "INSERT INTO simulations (id, payload) VALUES (?, ?)",
                    (simulation_id, payload),
                )
            return simulation_id
        except sqlite3.IntegrityError:
            continue
    raise RuntimeError("could not allocate a unique simulation id")


def load_simulation(simulation_id: str) -> dict[str, float | int] | None:
    if not valid_simulation_id(simulation_id):
        return None
    init_db()
    with _connect() as connection:
        row = connection.execute(
            "SELECT payload FROM simulations WHERE id = ?",
            (simulation_id,),
        ).fetchone()
    if row is None:
        return None
    return json.loads(row[0])
