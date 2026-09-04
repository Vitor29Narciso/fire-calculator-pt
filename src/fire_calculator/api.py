from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from fire_calculator.constants import SS_RETIREMENT_AGE, default_inputs
from fire_calculator.math.fire_age import calculate_fire, interpolate_required
from fire_calculator.types import FireInputs, FireResult

WEB_DIR = Path(__file__).resolve().parents[2] / "web"


class CalculateRequest(BaseModel):
    current_age: int = Field(ge=10, le=80)
    life_expectancy: int = Field(ge=50, le=120)
    monthly_contribution: float = Field(ge=0)
    initial_balance: float = Field(ge=0)
    annual_roi: float = Field(ge=0, lt=1)
    inflation_rate: float = Field(ge=0, lt=1)
    management_fee_rate: float = Field(ge=0, lt=1)
    desired_monthly_net_income: float = Field(gt=0)
    gains_tax_rate: float = Field(ge=0, lt=1)


def _is_birthday(age: float) -> bool:
    return abs(age - round(age)) <= 1e-9


def serialize_result(inputs: FireInputs, result: FireResult) -> dict:
    fire_at = result.fire_age_exact
    chart_ages: list[float] = []
    chart_contributed: list[float] = []
    chart_portfolio: list[float] = []
    chart_required: list[float] = []

    for point in result.accumulation_curve:
        required = interpolate_required(result.requirement_curve, point.age)
        chart_required.append(round(required, 2))
        chart_ages.append(round(point.age, 4))
        if fire_at is None or point.age <= fire_at + 1e-9:
            chart_contributed.append(round(point.contributed, 2))
            chart_portfolio.append(round(point.portfolio, 2))

    table = []
    fire_row_added = False
    for point in result.accumulation_curve:
        is_birthday = _is_birthday(point.age)
        is_fire_month = fire_at is not None and abs(point.age - fire_at) <= 1e-9
        if not is_birthday and not is_fire_month:
            continue

        age_years = int(point.age)
        table.append(
            {
                "year": age_years - inputs.current_age,
                "age": age_years,
                "age_months": round((point.age - age_years) * 12),
                "contributed": round(point.contributed, 2),
                "portfolio": round(point.portfolio, 2),
                "required": round(
                    interpolate_required(result.requirement_curve, point.age), 2
                ),
                "is_fire": is_fire_month and not fire_row_added,
            }
        )
        if is_fire_month:
            fire_row_added = True

    months_ahead_of_ss = (
        None if fire_at is None else round((SS_RETIREMENT_AGE - fire_at) * 12)
    )

    return {
        "summary": {
            "fire_age": result.fire_age,
            "years_until_fire": result.years_until_fire,
            "months_until_fire": result.months_until_fire,
            "portfolio_at_fire": (
                None
                if result.portfolio_at_fire is None
                else round(result.portfolio_at_fire, 2)
            ),
            "real_annual_return": round(inputs.real_annual_return, 4),
            "ss_retirement_age": SS_RETIREMENT_AGE,
            "months_ahead_of_ss": months_ahead_of_ss,
        },
        "four_percent_rule": {
            "annual_net_income": round(result.four_percent_rule.annual_net_income, 2),
            "annual_gross_income": round(result.four_percent_rule.annual_gross_income, 2),
            "target_portfolio": round(result.four_percent_rule.target_portfolio, 2),
        },
        "chart": {
            "ages": chart_ages,
            "contributed": chart_contributed,
            "portfolio": chart_portfolio,
            "required": chart_required,
            "fire_age_exact": fire_at,
            "ss_retirement_age": SS_RETIREMENT_AGE,
        },
        "table": table,
    }


app = FastAPI(title="FIRE Calculator PT")
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(
        WEB_DIR / "index.html",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/defaults")
def defaults() -> dict:
    inputs = default_inputs()
    return inputs.__dict__


@app.post("/api/calculate")
def calculate(payload: CalculateRequest) -> dict:
    try:
        inputs = FireInputs(**payload.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return serialize_result(inputs, calculate_fire(inputs))


def serve() -> None:
    """Dev server entry point. Override with HOST and PORT env vars."""
    import uvicorn

    uvicorn.run(
        "fire_calculator.api:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        reload=True,
    )
