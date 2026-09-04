# fire-calculator-pt

A FIRE (Financial Independence, Retire Early) calculator tailored for Portugal.

Everything is modelled in **today's euros**: the projection uses a real return
(`annual_roi - inflation_rate - management_fee_rate`), so no figure needs to be
deflated afterwards.

The distinguishing feature is the drawdown model. Rather than applying a flat
withdrawal rate, it tracks individual purchase lots and sells them **FIFO**,
taxing only the realised gain of each lot at the Portuguese capital gains rate.
Early retirement years therefore sell low-gain lots and pay less tax, which
lowers the capital actually required compared to the 4% rule of thumb.

## Requirements

Python 3.11 or newer.

## Install

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,web]"
```

Extras:

- `dev` — pytest, plus fastapi so the API tests collect
- `web` — fastapi and uvicorn for the browser one-pager

## Usage

### CLI

Edit `fire.toml`, then run:

```bash
fire-calc
```

Or without installing:

```bash
PYTHONPATH=src python -m fire_calculator
```

Prints the inputs, the 4% rule reference target, the FIRE age, a per-year table,
and opens a matplotlib chart.

### Web

```bash
uvicorn fire_calculator.api:app --reload
```

Then open http://127.0.0.1:8000. Run it from the repository root: the app serves
`web/` by walking up from the package directory.

Endpoints:

| Method | Path             | Purpose                                  |
| ------ | ---------------- | ---------------------------------------- |
| GET    | `/`              | The one-pager                            |
| GET    | `/api/defaults`  | Built-in default inputs                  |
| POST   | `/api/calculate` | Run the model against a set of inputs    |

## Inputs

All rates are decimals, so `0.08` means 8%.

| Key                            | Meaning                                        |
| ------------------------------ | ---------------------------------------------- |
| `current_age`                  | Age today                                      |
| `life_expectancy`              | Age the portfolio must last until              |
| `monthly_contribution`         | Amount invested each month during accumulation |
| `initial_balance`              | Starting portfolio value                       |
| `annual_roi`                   | Nominal expected annual return                 |
| `inflation_rate`               | Expected annual inflation                      |
| `management_fee_rate`          | Annual fund or platform fee                    |
| `desired_monthly_net_income`   | Target monthly income after tax, in retirement |
| `gains_tax_rate`               | Capital gains tax on realised gains            |

Defaults live in [constants.py](src/fire_calculator/constants.py) and are used
for any key `fire.toml` omits. Unknown keys are rejected.

## Layout

```
src/fire_calculator/
  types.py        Frozen dataclasses for inputs and results, with validation
  constants.py    Default inputs and Portugal-specific figures
  config.py       fire.toml loading
  math/
    lots.py         Lot and Portfolio: FIFO buys, sells, and gain tracking
    accumulation.py Monthly contribution projection
    drawdown.py     Retirement withdrawals and required-capital bisection
    fire_age.py     Ties it together: earliest month the portfolio suffices
  api.py          FastAPI app and JSON serialisation
  plot.py         matplotlib chart
  __main__.py     CLI entry point
web/              Static one-pager consumed by api.py
tests/            pytest suite, one module per source module
```

Dependencies flow one way: `types` and `constants` are the base, `math` builds
on them, and `api`, `plot`, and `__main__` sit on top. Nothing in `math` imports
from the layers above it.

## Tests

```bash
pytest
```

CI runs the same suite on every push to `main` and on pull requests.

## Caveats

- Portuguese Social Security income is **not** modelled. The legal retirement
  age is reported purely as a comparison marker.
- The tax model applies a single flat rate to realised gains. It does not cover
  the progressive-rate election, holding-period relief, or PPR treatment.
- Returns are a constant real rate. There is no sequence-of-returns risk or
  Monte Carlo simulation, so a single bad early decade is not represented.
- Not financial advice.
