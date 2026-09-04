const NUMBER_FIELDS = [
  "current_age",
  "life_expectancy",
  "monthly_contribution",
  "initial_balance",
  "desired_monthly_net_income",
];

const RATE_FIELDS = [
  "annual_roi",
  "inflation_rate",
  "management_fee_rate",
  "gains_tax_rate",
];

const form = document.getElementById("inputs");
const fireAge = document.getElementById("fire-age");
const fireIn = document.getElementById("fire-in");
const firePortfolio = document.getElementById("fire-portfolio");
const ssLabel = document.getElementById("ss-label");
const ssAhead = document.getElementById("ss-ahead");
const ssHint = document.getElementById("ss-hint");
const tableBody = document.getElementById("table-body");

let chart;
let latest = null;
let debounceId;

function euro(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value) {
  return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
}

function readInputs() {
  const payload = {};
  for (const name of NUMBER_FIELDS) {
    payload[name] = Number(document.getElementById(name).value);
  }
  for (const name of RATE_FIELDS) {
    payload[name] = Number(document.getElementById(name).value);
  }
  return payload;
}

function writeInputs(values) {
  for (const name of [...NUMBER_FIELDS, ...RATE_FIELDS]) {
    if (values[name] !== undefined) {
      document.getElementById(name).value = values[name];
    }
  }
  refreshRateLabels();
}

function refreshRateLabels() {
  for (const name of RATE_FIELDS) {
    document.getElementById(`${name}_label`).textContent = percent(
      Number(document.getElementById(name).value)
    );
  }
}

function duration(years, months) {
  const yearLabel = years === 1 ? "year" : "years";
  const monthLabel = months === 1 ? "month" : "months";
  return `${years} ${yearLabel} and ${months} ${monthLabel}`;
}

function padTo(values, length) {
  const padded = values.slice();
  while (padded.length < length) padded.push(null);
  return padded;
}

function formatAge(age) {
  const years = Math.floor(age);
  const months = Math.round((age - years) * 12);
  if (months <= 0) return `Age ${years}`;
  if (months === 12) return `Age ${years + 1}`;
  return `Age ${years}y ${months}m`;
}

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function withAlpha(hex, alpha) {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => part + part)
          .join("")
      : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function palette() {
  return {
    navy: token("--navy"),
    navyMid: token("--navy-mid"),
    navyLight: token("--navy-light"),
    slate: token("--slate"),
    muted: token("--muted"),
    line: token("--line"),
    lineMid: token("--line-mid"),
    copper: token("--copper"),
    copperMid: token("--copper-mid"),
    copperDeep: token("--copper-deep"),
    copperWash: token("--copper-wash"),
    blue: token("--blue"),
    ss: token("--ss"),
    ssInk: token("--ss-ink"),
  };
}

function closestIndex(ages, target) {
  let best = 0;
  let bestDist = Infinity;
  ages.forEach((age, index) => {
    const distance = Math.abs(age - target);
    if (distance < bestDist) {
      bestDist = distance;
      best = index;
    }
  });
  return best;
}

function formatSsAge(age) {
  const years = Math.floor(age);
  const months = Math.round((age - years) * 12);
  if (months <= 0) return `${years}`;
  if (months === 12) return `${years + 1}`;
  return `${years}y ${months}m`;
}

function renderSsCard(summary) {
  const ssAge = summary.ss_retirement_age;
  ssHint.textContent = `Legal age ${formatSsAge(ssAge)}`;
  const ahead = summary.months_ahead_of_ss;
  if (ahead == null) {
    ssLabel.textContent = "Ahead of SS";
    ssAhead.textContent = "—";
    return;
  }
  const years = Math.floor(Math.abs(ahead) / 12);
  const months = Math.abs(ahead) % 12;
  if (ahead > 0) {
    ssLabel.textContent = "Ahead of SS";
    ssAhead.textContent = duration(years, months);
    return;
  }
  if (ahead < 0) {
    ssLabel.textContent = "After SS";
    ssAhead.textContent = duration(years, months);
    return;
  }
  ssLabel.textContent = "vs SS retirement";
  ssAhead.textContent = "Same age";
}

function renderHeadline(data) {
  const { fire_age, years_until_fire, months_until_fire, portfolio_at_fire } =
    data.summary;
  renderSsCard(data.summary);
  if (fire_age === null) {
    fireAge.textContent = "—";
    fireIn.textContent = "Not reached";
    firePortfolio.textContent = "—";
    return;
  }
  fireAge.textContent = fire_age;
  fireIn.textContent = duration(years_until_fire, months_until_fire);
  firePortfolio.textContent = euro(portfolio_at_fire);
}

function renderTable(rows) {
  tableBody.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement("tr");
    if (row.is_fire) tr.className = "fire-row";
    const ageLabel =
      row.age_months > 0 ? `${row.age}y ${row.age_months}m` : `${row.age}`;
    tr.innerHTML = `
      <td>${row.year}</td>
      <td>${ageLabel}</td>
      <td>${euro(row.contributed)}</td>
      <td>${euro(row.portfolio)}</td>
      <td>${euro(row.required)}</td>
    `;
    tableBody.appendChild(tr);
  }
}

function renderChart(data) {
  const colors = palette();
  const ctx = document.getElementById("chart");
  const ages = data.chart.ages;
  const required = data.chart.required;
  const portfolio = padTo(data.chart.portfolio, ages.length);
  const fireIndex =
    data.chart.fire_age_exact == null
      ? -1
      : closestIndex(ages, data.chart.fire_age_exact);
  const firePoints = ages.map((_, index) =>
    index === fireIndex ? data.summary.portfolio_at_fire : null
  );
  const ssAge = data.chart.ss_retirement_age;
  const ssOnChart =
    ssAge != null && ssAge >= ages[0] && ssAge <= ages[ages.length - 1];
  const ssIndex = ssOnChart ? closestIndex(ages, ssAge) : -1;
  const followable = ["Portfolio", "Contributions", "FIRE Threshold"];
  let focusLabel = null;

  function strokeWidth(base) {
    return (ctx) => (ctx.dataset.label === focusLabel ? Math.max(base + 2, 4.25) : base);
  }

  function hoverRadius(size) {
    return (ctx) => (ctx.dataset.label === focusLabel ? size : 0);
  }

  function closestFollow(chartInstance, items, event) {
    let best = null;
    let bestDist = Infinity;
    for (const item of items) {
      const dataset = chartInstance.data.datasets[item.datasetIndex];
      if (!followable.includes(dataset?.label) || dataset.data[item.index] == null) {
        continue;
      }
      if (!item.element) continue;
      const dist = Math.abs(event.y - item.element.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = dataset.label;
      }
    }
    return best;
  }

  const datasets = [
    {
      label: "Fire Region",
      data: required,
      fill: "end",
      backgroundColor: withAlpha(colors.copper, 0.08),
      borderWidth: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      order: 4,
    },
    {
      label: "FIRE Threshold",
      data: required,
      borderColor: colors.copper,
      backgroundColor: colors.copper,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: hoverRadius(3.5),
      borderWidth: strokeWidth(2.5),
      hoverBorderWidth: strokeWidth(2.5),
      order: 3,
    },
    {
      label: "Contributions",
      data: padTo(data.chart.contributed, ages.length),
      borderColor: colors.navyLight,
      backgroundColor: colors.navyLight,
      pointRadius: 0,
      pointHoverRadius: hoverRadius(3.5),
      borderWidth: strokeWidth(2),
      hoverBorderWidth: strokeWidth(2),
      spanGaps: false,
      fill: false,
      order: 2,
    },
    {
      label: "Portfolio",
      data: portfolio,
      borderColor: colors.navyMid,
      backgroundColor: colors.navyMid,
      pointRadius: 0,
      pointHoverRadius: hoverRadius(3.5),
      borderWidth: strokeWidth(2.5),
      hoverBorderWidth: strokeWidth(2.5),
      spanGaps: false,
      fill: false,
      order: 1,
    },
    {
      label: "FIRE",
      data: firePoints,
      borderColor: colors.navyMid,
      backgroundColor: colors.navyMid,
      pointStyle: "circle",
      pointRadius: 11,
      pointHoverRadius: 13,
      pointHitRadius: 22,
      pointBorderWidth: 3,
      pointHoverBorderWidth: 3,
      pointBorderColor: colors.copperWash,
      pointHoverBorderColor: colors.copperWash,
      showLine: false,
      order: 0,
    },
  ];

  Chart.Interaction.modes.snapFire = (
    chartInstance,
    event,
    options,
    useFinalPosition
  ) => {
    const items = Chart.Interaction.modes.index(
      chartInstance,
      event,
      options,
      useFinalPosition
    );
    if (fireIndex < 0) {
      focusLabel = closestFollow(chartInstance, items, event);
      return items;
    }
    const fireDs = chartInstance.data.datasets.findIndex(
      (dataset) => dataset.label === "FIRE"
    );
    const point = chartInstance.getDatasetMeta(fireDs)?.data?.[fireIndex];
    if (!point) {
      focusLabel = closestFollow(chartInstance, items, event);
      return items;
    }
    const nearCircle = Math.hypot(event.x - point.x, event.y - point.y) <= 40;
    const nearColumn = Math.abs(event.x - point.x) <= 24;
    const resolved =
      nearCircle || nearColumn
        ? Chart.Interaction.modes.index(
            chartInstance,
            { native: event.native, x: point.x, y: point.y },
            options,
            useFinalPosition
          )
        : items;
    focusLabel = closestFollow(chartInstance, resolved, event);
    return resolved;
  };

  Chart.Tooltip.positioners.pegLine = function pegLine(items, eventPosition) {
    const match = items.find((item) => {
      const label = this.chart.data.datasets[item.datasetIndex]?.label;
      return label === focusLabel && item.element;
    });
    const el = match?.element ?? items.find((item) => item.element)?.element;
    if (!el) return eventPosition;
    return { x: el.x, y: el.y };
  };

  const chartDecor = {
    id: "chartDecor",
    beforeDatasetDraw(chartInstance, args) {
      if (chartInstance.data.datasets[args.index]?.label !== "FIRE") return;
      const { ctx } = chartInstance;
      ctx.save();
      ctx.shadowColor = withAlpha(colors.navyMid, 0.4);
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 1;
    },
    afterDatasetDraw(chartInstance, args) {
      if (chartInstance.data.datasets[args.index]?.label !== "FIRE") return;
      chartInstance.ctx.restore();
    },
    beforeDatasetsDraw(chartInstance) {
      const { ctx, chartArea, scales } = chartInstance;
      if (!chartArea) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
      ctx.clip();
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      if (ssIndex >= 0) {
        const x = scales.x.getPixelForValue(ssIndex);
        ctx.strokeStyle = colors.ss;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }
      if (fireIndex >= 0) {
        const x = scales.x.getPixelForValue(fireIndex);
        ctx.strokeStyle = colors.lineMid;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }
      ctx.restore();
    },
    afterEvent(chartInstance, args) {
      const { type } = args.event;
      if (type !== "mousemove" && type !== "mouseout") return;
      if (type === "mouseout" || !args.inChartArea) {
        if (focusLabel !== null) {
          focusLabel = null;
          args.changed = true;
        }
        return;
      }
      const items = Chart.Interaction.modes.snapFire(
        chartInstance,
        args.event,
        { intersect: false },
        true
      );
      const next = closestFollow(chartInstance, items, args.event);
      if (next !== focusLabel) {
        focusLabel = next;
        args.changed = true;
      }
    },
    afterDatasetsDraw(chartInstance) {
      const { ctx, chartArea, scales } = chartInstance;
      if (!chartArea) return;
      ctx.save();
      ctx.font = "700 12px Nunito, ui-sans-serif, system-ui";
      ctx.textBaseline = "bottom";
      const labelAt = (index, text, fill) => {
        const x = scales.x.getPixelForValue(index);
        ctx.fillStyle = fill;
        ctx.textAlign = x > chartArea.right - 36 ? "right" : "left";
        ctx.fillText(text, x + (ctx.textAlign === "right" ? -6 : 6), chartArea.bottom - 4);
      };
      if (fireIndex >= 0) {
        labelAt(fireIndex, "FIRE", colors.muted);
      }
      if (ssIndex >= 0) {
        labelAt(ssIndex, "SS", colors.ssInk);
      }
      ctx.font = "800 24px Nunito, ui-sans-serif, system-ui";
      ctx.fillStyle = colors.copper;
      ctx.shadowColor = withAlpha(colors.copperDeep, 0.16);
      ctx.shadowBlur = 10;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText("FIRE Region", chartArea.right - 12, chartArea.top + 10);
      ctx.restore();
    },
  };

  const config = {
    type: "line",
    plugins: [chartDecor],
    data: { labels: ages, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "snapFire", intersect: false },
      transitions: {
        active: { animation: { duration: 0 } },
      },
      plugins: {
        filler: { propagate: false },
        legend: {
          labels: {
            font: { family: "Nunito, ui-sans-serif, system-ui", size: 13 },
            color: colors.slate,
            usePointStyle: true,
            padding: 16,
            filter(item) {
              return ["Contributions", "Portfolio", "FIRE Threshold"].includes(
                item.text
              );
            },
            sort(a, b) {
              const order = ["Contributions", "Portfolio", "FIRE Threshold"];
              return order.indexOf(a.text) - order.indexOf(b.text);
            },
          },
        },
        tooltip: {
          enabled: false,
          position: "pegLine",
          filter(item) {
            if (item.raw == null) return false;
            return !["Fire Region", "FIRE"].includes(item.dataset.label);
          },
          external(context) {
            const { chart: chartInstance, tooltip } = context;
            let el = document.getElementById("chart-tooltip");
            if (!el) {
              el = document.createElement("div");
              el.id = "chart-tooltip";
              el.className = "chart-tooltip";
              document.body.appendChild(el);
            }
            if (tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
              el.classList.remove("is-open");
              return;
            }
            const index = tooltip.dataPoints[0].dataIndex;
            const fire = fireIndex >= 0 && index === fireIndex;
            let status = "Still accumulating";
            if (fire) {
              status = "Congratulations! You've reached FIRE.";
            } else if (ssIndex >= 0 && index === ssIndex) {
              status = "SS retirement age";
            } else if (fireIndex >= 0 && index > fireIndex) {
              status = "Inside the FIRE Region";
            } else {
              const value = portfolio[index];
              if (value != null && value >= required[index]) {
                status = "Inside the FIRE Region";
              }
            }
            const order = ["Contributions", "Portfolio", "FIRE Threshold"];
            const rows = order
              .map((label) =>
                tooltip.dataPoints.find((point) => point.dataset.label === label)
              )
              .filter((point) => point != null && point.raw != null);
            el.className = `chart-tooltip is-open${fire ? " is-fire" : ""}`;
            el.innerHTML = `
              <p class="title">${formatAge(ages[index])}</p>
              <p class="status">${status}</p>
              ${rows
                .map((point) => {
                  const focused = point.dataset.label === focusLabel ? " focus" : "";
                  const swatch = point.dataset.backgroundColor;
                  return `<p class="row${focused}"><span class="swatch" style="background:${swatch}"></span>${point.dataset.label}: ${euro(point.raw)}</p>`;
                })
                .join("")}
            `;
            const rect = chartInstance.canvas.getBoundingClientRect();
            el.style.left = `${rect.left + window.scrollX + tooltip.caretX}px`;
            el.style.top = `${rect.top + window.scrollY + tooltip.caretY}px`;
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Age", color: colors.muted },
          ticks: {
            maxTicksLimit: 12,
            color: colors.muted,
            callback: (value) => Math.round(ages[value]),
          },
          grid: { color: colors.line },
        },
        y: {
          min: 0,
          suggestedMax: Math.max(...required) * 1.16,
          ticks: { color: colors.muted, callback: (value) => euro(value) },
          grid: { color: colors.line },
        },
      },
    },
  };

  if (chart) {
    chart.destroy();
  }
  chart = new Chart(ctx, config);
}

async function readError(response) {
  try {
    const error = await response.json();
    if (typeof error.detail === "string") return error.detail;
    if (Array.isArray(error.detail) && error.detail[0]?.msg) {
      return error.detail.map((item) => item.msg).join(". ");
    }
  } catch {
    /* fall through */
  }
  return "Could not calculate with these inputs.";
}

async function calculate() {
  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readInputs()),
  });
  if (!response.ok) {
    fireIn.textContent = await readError(response);
    fireAge.textContent = "—";
    firePortfolio.textContent = "—";
    ssLabel.textContent = "Ahead of SS";
    ssAhead.textContent = "—";
    return;
  }
  latest = await response.json();
  renderHeadline(latest);
  renderChart(latest);
  renderTable(latest.table);
}

function scheduleCalculate() {
  clearTimeout(debounceId);
  debounceId = setTimeout(calculate, 200);
}

async function init() {
  const defaults = await fetch("/api/defaults").then((response) => response.json());
  writeInputs(defaults);
  form.addEventListener("input", (event) => {
    if (RATE_FIELDS.includes(event.target.id)) {
      refreshRateLabels();
    }
    scheduleCalculate();
  });
  await calculate();
}

init();
