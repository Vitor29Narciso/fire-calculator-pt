<div align="center">

# FIRE Calculator PT

**Explore when your retirement plan can withstand uncertain returns.**
A FIRE (Financial Independence, Retire Early) calculator built for investors in Portugal.

[![Tests](https://github.com/Vitor29Narciso/fire-calculator-pt/actions/workflows/test.yml/badge.svg)](https://github.com/Vitor29Narciso/fire-calculator-pt/actions/workflows/test.yml)
[![GitHub stars](https://img.shields.io/github/stars/Vitor29Narciso/fire-calculator-pt?style=flat)](https://github.com/Vitor29Narciso/fire-calculator-pt/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/Vitor29Narciso/fire-calculator-pt)](https://github.com/Vitor29Narciso/fire-calculator-pt/commits/main)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)

[**Live app: firecalculator.pt**](https://firecalculator.pt)

</div>

![FIRE Calculator PT showing the plan inputs, summary cards and the projection chart](docs/screenshot.png)

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [How the model works](#how-the-model-works)
- [Quick start](#quick-start)
- [Using the app and the API](#using-the-app-and-the-api)
- [Inputs](#inputs)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Tests and CI](#tests-and-ci)
- [Deployment](#deployment)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [Star history](#star-history)
- [Author and support](#author-and-support)
- [Disclaimer and privacy](#disclaimer-and-privacy)

## Why this exists

The 4% rule is a useful starting point, but a single spending multiple cannot
describe every retirement plan. The order of investment returns, years spent in
retirement, capital gains tax, inflation and future pension income all affect
when a portfolio can fund spending.

This calculator runs simulated market paths through both saving and retirement.
It searches for an earliest common retirement date that meets your chosen
simulated success rate, stops contributions at that date, and includes optional
Portuguese Social Security pension income. Success means funding the requested
spending through the chosen horizon; it does not require ending near zero or
preserving a particular inheritance.

This project started as a Google Sheets prototype and grew into a small web app
with a proper model behind it. The goal is simple: give people a calculator that
is honest about its assumptions, models FIFO gains taxation for Portuguese
investors, and is open source so everyone can check the maths,
provide feedback and contribute to improve it.

## Features

- **Monte Carlo FIRE age, to the month.** Search for a retirement date that
  meets a chosen simulated success rate through the planning horizon.
- **Return and sequence risk.** Seeded market scenarios model uncertain annual
  returns during accumulation and retirement, with adjustable volatility.
- **Actual retirement cash flows.** Contributions stop at FIRE and withdrawals
  fund the spending left after any pension income begins.
- **FIFO lot-by-lot taxation.** Purchase lots are sold oldest-first, taxing only
  positive realised nominal gains.
- **Optional pension income.** Enter a manual net pension or estimate a
  simplified post-2002 Portuguese pension from salary and contribution history.
- **Interactive chart** with the median balance, 10th–90th percentile range,
  cumulative contributions and a separate constant-return capital reference.
- **Comparison overlays**
  - **4%**: the classic 25x rule of thumb, for comparison.
  - **SS**: the Portuguese Social Security legal retirement age, as a marker.
  - Legacy Coast helpers remain available to library users; the Monte Carlo
    view hides that constant-return comparison.
- **Real / Nominal toggle.** See everything in today's euros or in each year's
  euros as it would appear on an account statement.
- **Year-by-year table** with a compact summary view and a full view.
- **Shareable simulations.** One click creates a short link (`/s/xxxxxxxx`) and
  share buttons for WhatsApp, Messenger, Telegram and email.
- **PDF report** of your simulation, rendered identically on desktop and mobile.
- **English and Portuguese**, detected from the browser and switchable at any
  time.
- **Day and night themes**, following the system by default.
- **Responsive**, with a mobile layout and touch-friendly chart tooltips.
- **No account, no tracking cookies, no build step** for the front end.

## How the model works

### Market paths and retirement date

The engine samples independent annual **lognormal nominal returns**, calibrated
to `annual_roi` as the arithmetic expected return and `annual_volatility` as
the annual standard deviation of returns. Each sampled year's growth is spread
evenly across its months. A fixed `simulation_seed` makes the same inputs
reproducible; changing the seed produces a different finite sample.

For each candidate FIRE month, every path uses the same candidate date. Before
it, monthly contributions buy new lots. From it onward, contributions are zero
and monthly FIFO sales fund spending after pension income. The same seeded
market paths are reused while searching for the earliest month whose successful
paths meet `success_probability`. A successful path funds **every retirement
withdrawal through `life_expectancy`**. The returned date is a common planning
date, not a different hindsight retirement date for every market path.

The chart and table follow those cash flows through the full horizon, including
retirement. `portfolio` is the median simulated balance; `portfolio_p10` and
`portfolio_p90` are pointwise percentiles. The band is neither a guarantee nor
the course of one particular portfolio. Zero volatility reduces market returns
to the expected return, while retaining the same cash-flow rules.

### Inflation, fees and tax

Spending and reported real balances use **today's euros**. Inflation and the
management fee are fixed user assumptions. `monthly_contribution` is this
year's nominal standing order, raised each birthday by
`contribution_growth_rate`, then deflated for real-value reporting. A flat
1,000 EUR transfer loses purchasing power when prices rise.

Tax is calculated on positive realised **nominal** gains from each FIFO lot,
then the resulting cash flows are expressed in real terms. The starting balance
is assumed to have a cost basis equal to its current value: existing unrealised
gains are not supplied separately.

The legacy constant-return modules remain available for library users and
tests. Their capital requirement is shown only as a comparison curve; crossing
it does not determine the Monte Carlo FIRE date. The simplified 4% comparison
ignores pension income and grosses up the entire withdrawal by the gains tax
rate, so it is not the FIFO tax calculation used by the main simulation.

### Portuguese pension income

`pension_mode` selects no pension (`0`), a manual net pension (`1`), or a
salary-based estimate (`2`). **Manual input is preferred.** Use the
[official Social Security pension simulator](https://www.seg-social.pt/ptss/pssd/menu/simuladores/simulador-pensoes),
adjust its future earnings to match the age at which you intend to stop working,
and enter a net amount in today's euros. Its automatic projection may otherwise
assume continued earnings until pension age.

The salary estimate applies a simplified post-2002 general-regime formula with
the 2026 IAS of 537.13 EUR. It weights your past career-average salary by past
contribution years and your current gross salary by additional whole working
years before FIRE when future salary is positive. Both salaries are monthly pensionable pay on a 14-payment
basis; past pay is assumed revalued to today's euros and future pay stays flat
in real terms. Estimated contribution years stop at FIRE, require at least 15,
and are capped at 40. The estimate freezes once that cap is reached; it does not
replace lower historical wages with higher future wages.

The estimated gross pension uses 2% annual accrual for 15–20 years and marginal
rates of 2.3%, 2.25%, 2.2%, 2.1% and 2% above 20 years, at salary boundaries of
1.1, 2, 4 and 8 IAS. It has 14 payments annually and uses the separate
`pension_tax_rate` assumption, not capital gains tax. Manual input can use 12,
13 or 14 net payments.

Pension income begins only after both FIRE and `pension_start_age`, is smoothed
monthly, and remains constant in real terms. It offsets spending; any surplus
is not reinvested. Salary-based mode requires a start age of at least 66.75
(66 years 9 months), the normal age in 2026. The normal age is already set at
66 years 11 months for 2027, and later ages are unknown: the chosen start age
is an assumption, not a future entitlement promise. Early and special pensions
require manual input.

See the [pension calculation legislation, Articles 28–33](https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/2007-34524275-48496775),
[2026 IAS](https://www.dgaep.gov.pt/index.cfm?OBJID=3E74CF19-DA87-4B8F-81E2-51E0649AAA9F),
[2026 retirement age](https://diariodarepublica.pt/dr/detalhe/portaria/358-2024-901536090)
and [2027 retirement age](https://diariodarepublica.pt/dr/detalhe/portaria/476-2025-992879815).

## Quick start

Requires **Python 3.11 or newer**. The recommended tool is
[uv](https://docs.astral.sh/uv/), because dependencies are locked in `uv.lock`.

```bash
git clone https://github.com/Vitor29Narciso/fire-calculator-pt.git
cd fire-calculator-pt
uv sync --all-extras
uv run fire-web
```

Then open <http://127.0.0.1:8000>. Auto-reload is on. Change the bind address
with the `HOST` and `PORT` environment variables, for example
`PORT=3000 uv run fire-web`.

> Run it from the repository root: the app locates `web/` by walking up from
> the package directory (or use `FIRE_WEB_DIR`).

### With Docker

```bash
docker build -t fire-calculator-pt .
docker run --rm -p 8000:8000 -v fire-data:/data fire-calculator-pt
```

The volume keeps shared simulations between runs. Then open
<http://127.0.0.1:8000>.

### With pip

Unpinned versions, so results may differ from the locked environment:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,web]"
fire-web
```

<details>
<summary>macOS and iCloud note</summary>

On macOS, prefer `uv sync` over an editable pip install if the project lives in
an iCloud-synced `Documents` folder. Python skips hidden `.pth` files, which is
how editable installs expose the package. This repository ships a small
`macos_pth_hook` for exactly that case.

</details>

### Extras

| Extra | Contents                                         |
| ----- | ------------------------------------------------ |
| `dev` | pytest, httpx, and fastapi so the API tests run  |
| `web` | fastapi and uvicorn for the browser app          |

After changing a dependency in `pyproject.toml`, run `uv lock` and commit the
updated `uv.lock`.

## Using the app and the API

The web app is a single page served by the same FastAPI process as the API.
The API is plain JSON, so you can use the model without the UI.

| Method | Path                           | Purpose                                         |
| ------ | ------------------------------ | ----------------------------------------------- |
| GET    | `/`                            | The one-page app                                |
| GET    | `/api/defaults`                | Default inputs, field limits, SS retirement age |
| POST   | `/api/calculate`               | Run the model against a set of inputs           |
| POST   | `/api/simulations`             | Save inputs and get a short shareable id        |
| GET    | `/api/simulations/{id}`        | Load the inputs of a saved simulation           |
| GET    | `/s/{id}`                      | Open the app preloaded with a saved simulation  |

Example:

```bash
curl -s -X POST http://127.0.0.1:8000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "current_age": 24,
    "life_expectancy": 90,
    "monthly_contribution": 1000,
    "initial_balance": 0,
    "annual_roi": 0.08,
    "inflation_rate": 0.03,
    "management_fee_rate": 0.0014,
    "desired_monthly_net_income": 3000,
    "gains_tax_rate": 0.196,
    "contribution_growth_rate": 0,
    "annual_volatility": 0.15,
    "success_probability": 0.9,
    "simulation_count": 500,
    "simulation_seed": 42,
    "pension_mode": 1,
    "pension_start_age": 67,
    "pension_monthly_net": 700,
    "pension_payments_per_year": 14
  }'
```

The response retains the original four top-level keys and adds `methodology`:

- `summary`: FIRE age, years and months until FIRE, median balance at FIRE,
  simulated and target success rates, market assumptions, pension settings,
  simulation count and seed, and the dated Social Security comparison.
- `four_percent_rule`: the target portfolio under the 4% rule, for comparison.
- `chart`: the median and percentile balance series, contributions and the
  constant-return comparison curve.
- `table`: year-by-year rows, plus the FIRE month, including actual contribution
  cash flows and pension income.
- `methodology`: model version and assumptions for returns, tax, pension,
  success and the comparison curve.

If no candidate retirement date meets the target, the FIRE result fields are
`null`. The response exposes the last tested success rate separately.

Interactive API docs are available at `/docs` while the server is running.

## Inputs

All rates are decimals, so `0.08` means 8%. Every field is validated against the
limits served by `/api/defaults`.

| Key                          | Meaning                                         | Default  |
| ---------------------------- | ----------------------------------------------- | -------- |
| `current_age`                | Age today                                       | 24       |
| `life_expectancy`            | Age the balance must last until                 | 90       |
| `monthly_contribution`       | Standing order this year, in this year's euros  | 1,000    |
| `contribution_growth_rate`   | Yearly raise of that standing order (nominal)   | 0%       |
| `initial_balance`            | Starting balance, in today's euros              | 0        |
| `annual_roi`                 | Arithmetic expected nominal annual return       | 8%       |
| `annual_volatility`          | Standard deviation of nominal annual returns    | 15%      |
| `success_probability`        | Required simulated fraction of successful paths | 90%      |
| `simulation_count`           | Number of simulated market paths                | 500      |
| `simulation_seed`            | Seed for reproducible market paths              | 42       |
| `inflation_rate`             | Expected annual inflation                       | 3%       |
| `management_fee_rate`        | Annual fund or platform fee                     | 0.14%    |
| `desired_monthly_net_income` | Target monthly income after tax, today's euros  | 3,000    |
| `gains_tax_rate`             | Capital gains tax on realised gains             | 19.6%    |
| `pension_mode`               | 0: none; 1: manual net; 2: salary estimate        | 0        |
| `pension_start_age`          | Assumed age pension income can begin            | 66.75    |
| `pension_monthly_net`        | Manual net amount per pension payment, today EUR | 0       |
| `pension_payments_per_year`  | Manual pension payment count: 12, 13 or 14       | 14       |
| `current_gross_monthly_salary` | Future pensionable gross monthly pay, ×14     | 2,000    |
| `career_average_monthly_salary` | Past average gross monthly pay, revalued, ×14 | 2,000  |
| `contribution_years`         | Completed pension contribution years today      | 0        |
| `pension_tax_rate`           | Effective pension income tax for salary estimate | 15%     |

Salary fields are used only in estimated pension mode; the manual pension is
already net of tax. Contribution years cannot exceed the years since age 16.
The estimator rejects pension start ages below 66.75; use manual mode for early
or special regimes. Field limits and defaults are modelling choices, not
recommended financial assumptions or a statement of future law.

Core defaults live in [`constants.py`](src/fire_calculator/constants.py), with
simulation and pension defaults in [`types.py`](src/fire_calculator/types.py).
Limits live in [`limits.py`](src/fire_calculator/limits.py).

## Tech stack

| Area           | Tools                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Language       | Python 3.11+                                                          |
| Backend        | [FastAPI](https://fastapi.tiangolo.com/), Pydantic, Uvicorn           |
| Storage        | SQLite (shared simulations only)                                      |
| Front end      | Vanilla JavaScript, HTML and CSS, no build step                       |
| Charts         | [Chart.js](https://www.chartjs.org/)                                  |
| PDF export     | [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)               |
| Tooling        | [uv](https://docs.astral.sh/uv/), pytest, httpx                       |
| CI             | GitHub Actions                                                        |
| Hosting        | Docker on [Railway](https://railway.app/)                             |
| DNS and edge   | Cloudflare (DNS, proxy, cookieless Web Analytics)                     |

## Project layout

```
src/fire_calculator/
  types.py          Frozen dataclasses for inputs and results, with validation
  constants.py      Default inputs and Portugal-specific figures
  limits.py         Field limits shared by the API and the UI
  simulations.py    SQLite storage for shareable simulations
  math/
    lots.py           Lot and Portfolio: FIFO buys, sells, and gain tracking
    monte_carlo.py    Seeded market paths, FIRE-date search and full cash flows
    pension.py        Manual pension and simplified post-2002 salary estimate
    accumulation.py   Legacy constant-return contribution projection
    drawdown.py       Legacy drawdown and required-capital comparison
    fire_age.py       Legacy constant-return FIRE and comparison helpers
  api.py            FastAPI app and JSON serialisation
web/                Static one-page app (index.html, app.js, styles.css, locales/)
tests/              pytest suite, one module per source module
macos_pth_hook/     Helper package for iCloud-synced checkouts on macOS
Dockerfile          Production image
railway.toml        Railway build and healthcheck settings
```

Dependencies flow one way: `types` and `constants` are the base, `math` builds
on them, and `api` sits on top. Nothing in `math` imports from the layers above
it, so the model can be used and tested without any web code.

## Tests and CI

```bash
uv run pytest
```

CI runs the same suite on every push to `main` and on pull requests, using
`uv sync --locked` so a stale `uv.lock` fails the build.

## Deployment

Production runs the FastAPI app in Docker on Railway. Shared simulations need a
persistent volume for SQLite.

1. Push the repository to GitHub, with `Dockerfile` and `railway.toml` on `main`.
2. In Railway, choose **New Project, Deploy from GitHub repo** and select this
   repository. Railway builds the `Dockerfile` automatically.
3. Add a **Volume** to the service with mount path `/data`. The app stores
   simulations at `/data/simulations.db`.
4. Open the generated `*.up.railway.app` URL and check that the calculator
   loads, that sharing creates a working `/s/xxxxxxxx` link, and that the PDF
   download works.

### Custom domain

1. In the Railway service, open **Settings, Networking, Custom Domain** and add
   your domain. Make sure the target port matches the port the app listens on.
2. Railway lists the DNS records to create, usually a `CNAME` plus a `TXT`
   verification record.
3. Create them at your DNS provider. If your registrar cannot serve a `CNAME` on
   the root domain, move the nameservers to Cloudflare, which can.
4. When Railway shows the domain as verified, HTTPS is issued automatically.

With Cloudflare in front, set SSL/TLS to **Full**, turn on **Always Use HTTPS**,
and redirect `www` to the root domain with a redirect rule.

### Environment variables

| Variable             | Default                 | Purpose                                                              |
| -------------------- | ----------------------- | -------------------------------------------------------------------- |
| `PORT`               | `8000`                  | Port to listen on, set by Railway                                    |
| `HOST`               | `127.0.0.1` locally     | Bind address (the Docker image binds `0.0.0.0`)                      |
| `FIRE_SIMULATION_DB` | `/data/simulations.db`  | SQLite path, use together with a volume                              |
| `FIRE_WEB_DIR`       | auto-detected           | Directory with the static front end                                  |
| `WEB_RELOAD`         | `1` locally             | Set to `0` if you run `fire-web` in production (Docker does not use it) |

## Limitations

This is a simplified model. Read these before interpreting a result.

- A simulated success rate is conditional on the model and inputs, **not a
  guarantee or a measured real-world probability**. Finite samples vary with
  the seed. At 90% observed success with 500 paths, the approximate sampling
  standard error alone is 1.3 percentage points; model uncertainty is additional.
- Independent lognormal annual returns do not reproduce every market regime,
  crash pattern or fat tail. Monthly returns are constant within each sampled
  year. Inflation, fees, spending and future real salary are fixed assumptions;
  their uncertainty and correlations are not simulated.
- The selected FIRE month is common to all paths, including uncertain
  accumulation outcomes. The median balance at FIRE does not certify any
  particular investor's realised portfolio. Recalculate with actual holdings
  and updated assumptions before making a retirement decision.
- Tax is a single flat rate on positive realised nominal FIFO gains. It does
  not model loss offsets, progressive-rate election, holding-period relief,
  PPR treatment or future law changes. Existing unrealised gains are omitted
  because the initial balance is treated as having equal cost basis.
- The pension estimate omits the mixed formula for pre-2002 careers,
  calendar-year contribution-density rules, best-40-year replacements, guaranteed
  minima, early-claim penalties, late-claim bonuses and foreign or special
  regimes. Pension taxation is an assumed effective rate; the calculator does
  not determine household IRS. Prefer a net pension from the official simulator.
- Pensions retain today's purchasing power by assumption. Future eligibility,
  pension age, indexation and tax rules may change. Payments are smoothed
  monthly, begin only after both FIRE and the chosen pension age, and surplus
  income is not reinvested.
- The horizon is fixed. There is no mortality model, spending shock, bequest
  target or reserve requirement; surviving beyond `life_expectancy` is not
  tested. Successful paths can end with substantial balances.
- The constant-return requirement, Coast comparison and simplified 4% target
  are references, not Monte Carlo success criteria. The 4% calculation ignores
  pensions and treats the whole withdrawal as taxable.
- Defaults and legal reference values can become outdated. Check them against
  current rules and your own circumstances.

## Contributing

Issues and pull requests are welcome.

1. Fork the repository and create a branch from `main`.
2. Install with `uv sync --all-extras` and run the app with `uv run fire-web`.
3. Make your change and add or update tests next to the module you touched.
4. Run `uv run pytest` and make sure it passes.
5. Open a pull request describing what changed and why.

Bug reports are most useful with the exact inputs that produced the problem.
Because simulations can be shared, a `/s/xxxxxxxx` link is a great way to
include them.

## Star history

If this project is useful to you, a star helps others find it.

<a href="https://star-history.com/#Vitor29Narciso/fire-calculator-pt&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Vitor29Narciso/fire-calculator-pt&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Vitor29Narciso/fire-calculator-pt&type=Date" />
    <img alt="Star history chart" src="https://api.star-history.com/svg?repos=Vitor29Narciso/fire-calculator-pt&type=Date" />
  </picture>
</a>

## Author and support

Built by **Vítor Narciso**.

- GitHub: [Vitor29Narciso](https://github.com/Vitor29Narciso)
- LinkedIn: [vitor29narciso](https://www.linkedin.com/in/vitor29narciso)
- Support the project: [Buy me a coffee](https://buymeacoffee.com/vitor29narciso)

## Disclaimer and privacy

**Not financial advice.** This tool is for educational and simulation purposes
only. All figures are illustrative projections based on your inputs and the
assumptions built into the model. They are not a recommendation to buy, sell or
hold any asset, and they are not financial, investment, tax, legal or retirement
advice. Use it at your own risk.

**Privacy.** No account or identifying details are required. Theme and language
preferences stay in your browser. Creating a shared simulation stores its
numeric financial inputs, including any salary and pension values you entered,
under a random 8-character id. Anyone who has the link can open those inputs.
The hosted instance may use cookieless Cloudflare Web Analytics for aggregate
traffic counts.
