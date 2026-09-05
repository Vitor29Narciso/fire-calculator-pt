from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from fire_calculator.constants import SS_RETIREMENT_AGE, default_inputs
from fire_calculator.limits import FIELD_LIMITS, limits_payload
from fire_calculator.math.fire_age import calculate_fire, interpolate_required
from fire_calculator.types import FireInputs, FireResult


def _bounded(name: str, default: float | None = None) -> Field:
    limit = FIELD_LIMITS[name]
    minimum: int | float = int(limit.minimum) if limit.integer else limit.minimum
    maximum: int | float = int(limit.maximum) if limit.integer else limit.maximum
    if default is None:
        return Field(ge=minimum, le=maximum)
    return Field(default=default, ge=minimum, le=maximum)

WEB_DIR = Path(__file__).resolve().parents[2] / "web"


class CalculateRequest(BaseModel):
    current_age: int = _bounded("current_age")
    life_expectancy: int = _bounded("life_expectancy")
    monthly_contribution: int = _bounded("monthly_contribution")
    initial_balance: int = _bounded("initial_balance")
    annual_roi: float = _bounded("annual_roi")
    inflation_rate: float = _bounded("inflation_rate")
    management_fee_rate: float = _bounded("management_fee_rate")
    desired_monthly_net_income: int = _bounded("desired_monthly_net_income")
    gains_tax_rate: float = _bounded("gains_tax_rate")
    contribution_growth_rate: float = _bounded("contribution_growth_rate", default=0.0)


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
                "monthly_contribution": round(point.monthly_contribution, 2),
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
            "current_age": inputs.current_age,
            "inflation_rate": inputs.inflation_rate,
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


class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store"
        return response


def _asset_version(filename: str) -> int:
    return int((WEB_DIR / filename).stat().st_mtime)


app = FastAPI(title="FIRE Calculator PT")
app.mount("/static", NoCacheStaticFiles(directory=WEB_DIR), name="static")


@app.get("/")
def index() -> HTMLResponse:
    html = (WEB_DIR / "index.html").read_text(encoding="utf-8")
    html = html.replace(
        'href="/static/styles.css"',
        f'href="/static/styles.css?v={_asset_version("styles.css")}"',
    )
    html = html.replace(
        'src="/static/app.js"',
        f'src="/static/app.js?v={_asset_version("app.js")}"',
    )
    html = html.replace(
        'href="/static/favicon.svg"',
        f'href="/static/favicon.svg?v={_asset_version("favicon.svg")}"',
    )
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


def _favicon() -> FileResponse:
    return FileResponse(
        WEB_DIR / "favicon.svg",
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/favicon.svg")
def favicon_svg() -> FileResponse:
    return _favicon()


@app.get("/favicon.ico")
def favicon_ico() -> FileResponse:
    return _favicon()


@app.get("/api/defaults")
def defaults() -> dict:
    inputs = default_inputs()
    return {**inputs.__dict__, "limits": limits_payload()}


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
