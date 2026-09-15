FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    FIRE_SIMULATION_DB=/data/simulations.db \
    FIRE_WEB_DIR=/app/web

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
COPY src ./src
COPY web ./web

RUN uv sync --frozen --no-dev --extra web --no-default-groups --no-editable

EXPOSE 8000

CMD ["sh", "-c", ".venv/bin/uvicorn fire_calculator.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
