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
  "contribution_growth_rate",
];

const catalogs = { en: {}, pt: {} };
const LOCALE_KEY = "fire-locale";
const THEME_KEY = "fire-theme";
let locale = "en";

function systemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "day" || stored === "night") return stored;
  } catch {
    /* private mode */
  }
  return null;
}

function effectiveTheme() {
  return readStoredTheme() ?? systemTheme();
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode */
  }
}

function applyTheme() {
  const theme = effectiveTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-mode]").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.themeMode === theme);
  });
}

function setTheme(next) {
  if (next !== "day" && next !== "night") return;
  persistTheme(next);
  applyTheme();
  if (latest) renderOutputs();
}

function lookup(catalog, key) {
  return key.split(".").reduce((node, part) => (node == null ? node : node[part]), catalog);
}

function interpolate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] == null ? `{${name}}` : String(vars[name])
  );
}

function t(key, vars = {}) {
  const fromLocale = lookup(catalogs[locale], key);
  const raw = fromLocale || lookup(catalogs.en, key);
  if (raw == null || raw === "") return key;
  return interpolate(raw, vars);
}

function fieldLabel(name) {
  return t(`fields.${name}`);
}

function browserLocale() {
  const langs =
    Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || "en"];
  return langs.some((lang) => String(lang).toLowerCase().startsWith("pt")) ? "pt" : "en";
}

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "en" || stored === "pt") return stored;
  } catch {
    /* private mode */
  }
  return null;
}

function effectiveLocale() {
  return readStoredLocale() ?? browserLocale();
}

function persistLocale() {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* private mode */
  }
}

async function loadCatalogs() {
  const [en, pt] = await Promise.all([
    fetch("/static/locales/en.json").then((response) => response.json()),
    fetch("/static/locales/pt.json").then((response) => response.json()),
  ]);
  catalogs.en = en;
  catalogs.pt = pt;
}

function applyI18n() {
  document.documentElement.lang = locale;
  document.title = t("meta.title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.dataset.i18nTitle));
  });
  document.querySelectorAll("[data-locale]").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.locale === locale);
  });
}

function setLocale(next) {
  if (next !== "en" && next !== "pt") return;
  locale = next;
  persistLocale();
  applyI18n();
  const problems = collectProblems();
  if (problems.length) {
    showWarning(problems);
    return;
  }
  hideWarning();
  if (latest) renderOutputs();
}

const form = document.getElementById("inputs");
const fireAge = document.getElementById("fire-age");
const fireInLabel = document.getElementById("fire-in-label");
const fireIn = document.getElementById("fire-in");
const firePortfolio = document.getElementById("fire-portfolio");
const ssLabel = document.getElementById("ss-label");
const ssAhead = document.getElementById("ss-ahead");
const ssRetirementAge = document.getElementById("ss_retirement_age");
const ssRetirementAgeLabel = document.getElementById("ss_retirement_age_label");
const tableBody = document.getElementById("table-body");
const tableNote = document.getElementById("table-note");
const planWarning = document.getElementById("plan-warning");
const planWarningList = document.getElementById("plan-warning-list");
const ssCard = document.getElementById("ss-card");
const coastCard = document.getElementById("coast-card");
const coastLabel = document.getElementById("coast-label");
const coastValue = document.getElementById("coast-value");
const coastAgeNote = document.getElementById("coast-age-note");
const coastSsPrefix = document.getElementById("coast-ss-prefix");
const coastNote = document.getElementById("coast-note");
const ruleCard = document.getElementById("rule-card");
const ruleLabel = document.getElementById("rule-label");
const ruleTargetValue = document.getElementById("rule-target");
const withdrawalRate = document.getElementById("withdrawal_rate");
const withdrawalRateLabel = document.getElementById("withdrawal_rate_label");

const DEFAULT_WITHDRAWAL_RATE = 0.04;
const DEFAULT_SS_RETIREMENT_AGE = 66.75;

let chart;
let latest = null;
let debounceId;
let displayUnits = "real";
let fieldLimits = {};
let compareCoast = false;
let compareSs = false;
let compareRule = false;

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
  for (const name of NUMBER_FIELDS) {
    if (values[name] !== undefined) {
      document.getElementById(name).value = String(Math.round(Number(values[name])));
    }
  }
  for (const name of RATE_FIELDS) {
    if (values[name] !== undefined) {
      document.getElementById(name).value = values[name];
    }
  }
  refreshRateLabels();
}

function applyLimits(limits) {
  fieldLimits = limits;
  for (const [name, limit] of Object.entries(limits)) {
    const input = document.getElementById(name);
    if (!input) continue;
    input.min = String(limit.min);
    input.max = String(limit.max);
    input.step = String(limit.step);
    if (limit.integer) {
      input.maxLength = String(Math.trunc(limit.max)).length;
    }
  }
}

function formatBound(name, value) {
  if (RATE_FIELDS.includes(name)) return percent(value);
  return String(Math.trunc(value));
}

const DIGIT_NAV_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

function keepDigitsOnly(input) {
  const start = input.selectionStart;
  const previous = input.value;
  const cleaned = previous.replace(/\D/g, "");
  if (previous === cleaned) return;
  input.value = cleaned;
  if (start != null) {
    const lost = previous.length - cleaned.length;
    const next = Math.max(0, start - lost);
    input.setSelectionRange(next, next);
  }
}

function rejectNonDigitKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (DIGIT_NAV_KEYS.has(event.key)) return;
  if (event.key.length === 1 && event.key >= "0" && event.key <= "9") return;
  event.preventDefault();
}

function rejectNonDigits(event) {
  if (event.inputType === "insertText" && event.data && /\D/.test(event.data)) {
    event.preventDefault();
  }
}

function pasteDigitsOnly(event) {
  event.preventDefault();
  const input = event.target;
  const digits = event.clipboardData.getData("text").replace(/\D/g, "");
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.value = `${input.value.slice(0, start)}${digits}${input.value.slice(end)}`;
  input.setSelectionRange(start + digits.length, start + digits.length);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function collectProblems() {
  const problems = [];
  const values = {};

  for (const name of NUMBER_FIELDS) {
    const input = document.getElementById(name);
    const raw = input.value;
    const limit = fieldLimits[name];
    const field = input.closest(".field");
    field?.classList.remove("is-invalid");

    if (!limit) continue;
    if (raw === "") {
      problems.push({
        name,
        message: t("warning.required", { field: fieldLabel(name) }),
      });
      continue;
    }
    const value = Number(raw);
    values[name] = value;
    if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
      problems.push({
        name,
        message: t("warning.wholeNumber", {
          field: fieldLabel(name),
          min: formatBound(name, limit.min),
          max: formatBound(name, limit.max),
        }),
      });
    }
  }

  for (const name of RATE_FIELDS) {
    const input = document.getElementById(name);
    const value = Number(input.value);
    const limit = fieldLimits[name];
    const field = input.closest(".field");
    field?.classList.remove("is-invalid");
    if (!limit) continue;
    values[name] = value;
    if (Number.isNaN(value) || value < limit.min || value > limit.max) {
      problems.push({
        name,
        message: t("warning.between", {
          field: fieldLabel(name),
          min: formatBound(name, limit.min),
          max: formatBound(name, limit.max),
        }),
      });
    }
  }

  if (
    values.current_age != null &&
    values.life_expectancy != null &&
    values.current_age >= values.life_expectancy
  ) {
    problems.push({
      name: "life_expectancy",
      message: t("warning.ageOrder"),
    });
  }

  return problems;
}

function showWarning(problems) {
  planWarningList.replaceChildren(
    ...problems.map((problem) => {
      const item = document.createElement("li");
      item.textContent = problem.message;
      return item;
    })
  );
  for (const problem of problems) {
    if (!problem.name) continue;
    document.getElementById(problem.name)?.closest(".field")?.classList.add("is-invalid");
  }
  planWarning.hidden = false;
}

function hideWarning() {
  planWarning.hidden = true;
  planWarningList.replaceChildren();
  form.querySelectorAll(".field.is-invalid").forEach((field) => {
    field.classList.remove("is-invalid");
  });
}

function refreshRateLabels() {
  for (const name of RATE_FIELDS) {
    document.getElementById(`${name}_label`).textContent = percent(
      Number(document.getElementById(name).value)
    );
  }
}

function duration(years, months) {
  const parts = [];
  if (years > 0) {
    parts.push(t(years === 1 ? "duration.year" : "duration.years", { count: years }));
  }
  if (months > 0) {
    parts.push(t(months === 1 ? "duration.month" : "duration.months", { count: months }));
  }
  if (!parts.length) return t("duration.zero");
  return parts.join(t("duration.joiner"));
}

function euroWithUnit(value) {
  const unit = displayUnits === "real" ? t("units.realValue") : t("units.nominalValue");
  return `${euro(value)}<span class="stat-unit">(${unit})</span>`;
}

function inflationFactor(age, data) {
  return (1 + data.summary.inflation_rate) ** (age - data.summary.current_age);
}

function asDisplay(realValue, age, data) {
  if (realValue == null) return null;
  return displayUnits === "nominal" ? realValue * inflationFactor(age, data) : realValue;
}

function monthlyAsDisplay(nominalValue, age, data) {
  if (nominalValue == null) return null;
  return displayUnits === "real" ? nominalValue / inflationFactor(age, data) : nominalValue;
}

function unitsAxisTitle() {
  return displayUnits === "real" ? t("chart.yAxisReal") : t("chart.yAxisNominal");
}

function padTo(values, length) {
  const padded = values.slice();
  while (padded.length < length) padded.push(null);
  return padded;
}

function formatAge(age) {
  const years = Math.floor(age);
  const months = Math.round((age - years) * 12);
  if (months <= 0) return t("age.years", { years });
  if (months === 12) return t("age.years", { years: years + 1 });
  return t("age.yearsMonths", { years, months });
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
    firePointBorder: token("--fire-point-border"),
    blue: token("--blue"),
    ss: token("--ss"),
    ssInk: token("--ss-ink"),
    coast: token("--coast"),
    coastInk: token("--coast-ink"),
    coastWash: token("--coast-wash"),
    rule: token("--rule"),
    ruleInk: token("--rule-ink"),
  };
}

function withdrawalRateValue() {
  return Number(withdrawalRate.value);
}

function formatWithdrawalRate(rate) {
  const percentValue = rate * 100;
  return `${percentValue.toFixed(percentValue % 1 === 0 ? 0 : 1)}%`;
}

function ruleSeriesLabel() {
  return t("rule.series", { rate: formatWithdrawalRate(withdrawalRateValue()) });
}

function ruleTargetReal(data) {
  const rate = withdrawalRateValue();
  if (!rate) return null;
  return data.four_percent_rule.annual_gross_income / rate;
}

function refreshWithdrawalLabel() {
  withdrawalRateLabel.textContent = formatWithdrawalRate(withdrawalRateValue());
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

function ssRetirementAgeValue() {
  return Number(ssRetirementAge.value);
}

function ageWholeYears(age) {
  return Math.floor(Math.round(age * 12) / 12);
}

function formatSsAge(age) {
  const years = Math.floor(age);
  const months = Math.round((age - years) * 12);
  if (months <= 0) return t("age.shortYears", { years });
  if (months === 12) return t("age.shortYears", { years: years + 1 });
  return t("age.shortYearsMonths", { years, months });
}

function refreshSsAgeLabel() {
  ssRetirementAgeLabel.textContent = formatSsAge(ssRetirementAgeValue());
}

function monthlyRealReturn(data) {
  return (1 + data.summary.real_annual_return) ** (1 / 12) - 1;
}

function findCoastIndex(data, ssAge) {
  const ages = data.chart.ages;
  const portfolio = data.chart.portfolio;
  const required = data.chart.required;
  if (!ages.length || ssAge == null || Number.isNaN(ssAge)) return -1;
  if (ssAge < ages[0] - 1e-9) {
    return portfolio[0] != null && required[0] != null && portfolio[0] + 1e-6 >= required[0]
      ? 0
      : -1;
  }
  const ssIndex = closestIndex(ages, ssAge);
  const target = required[ssIndex];
  if (target == null) return -1;
  const monthly = monthlyRealReturn(data);
  const last = Math.min(portfolio.length, ssIndex + 1);
  for (let i = 0; i < last; i += 1) {
    const value = portfolio[i];
    if (value == null) continue;
    const months = Math.round((ssAge - ages[i]) * 12);
    const future = value * (1 + monthly) ** Math.max(0, months);
    if (future + 1e-6 >= target) return i;
  }
  return -1;
}

function coastLineValues(data, coastIndex, ssIndex) {
  const ages = data.chart.ages;
  if (coastIndex < 0 || ssIndex < 0 || coastIndex > ssIndex) {
    return ages.map(() => null);
  }
  const start = data.chart.portfolio[coastIndex];
  if (start == null) return ages.map(() => null);
  const monthly = monthlyRealReturn(data);
  return ages.map((age, index) => {
    if (index < coastIndex || index > ssIndex) return null;
    const real = start * (1 + monthly) ** (index - coastIndex);
    return asDisplay(real, age, data);
  });
}

function isAlreadyAtCoast(data, coastIndex, ages) {
  if (coastIndex < 0) return false;
  return Math.round((ages[coastIndex] - data.summary.current_age) * 12) <= 0;
}

function isAlreadyAtFire(data) {
  const fireAt = data.chart.fire_age_exact;
  if (fireAt == null) return false;
  return Math.round((fireAt - data.summary.current_age) * 12) <= 0;
}

function findCoastFireIndex(coastLine, required, coastIndex, ssIndex) {
  if (coastIndex < 0 || ssIndex < 0 || coastIndex > ssIndex) return ssIndex;
  for (let index = coastIndex; index <= ssIndex; index += 1) {
    const coast = coastLine[index];
    const need = required[index];
    if (coast != null && need != null && coast >= need - 1e-6) return index;
  }
  return ssIndex;
}

function coastFireMarkerIndex(data, ages, coastIndex, ssIndex, coastLine, required) {
  if (coastIndex < 0 || ssIndex < 0) return -1;
  const fireIndex = findCoastFireIndex(coastLine, required, coastIndex, ssIndex);
  if (isAlreadyAtCoast(data, coastIndex, ages) && fireIndex < ssIndex) return fireIndex;
  return ssIndex;
}

function renderCoastCard(data) {
  const ssAge = ssRetirementAgeValue();
  refreshSsAgeLabel();
  const ages = data.chart.ages;
  const coastIndex = findCoastIndex(data, ssAge);
  if (coastIndex < 0) {
    coastLabel.textContent = t("coast.in");
    coastValue.textContent = t("coast.notReached");
    coastAgeNote.textContent = "—";
    coastSsPrefix.textContent = t("coast.ssPrefix");
    coastNote.textContent = "—";
    return;
  }
  const coastAge = ages[coastIndex];
  const ssIndex = closestIndex(ages, ssAge);
  const coastLine =
    ssIndex >= 0 ? coastLineValues(data, coastIndex, ssIndex) : ages.map(() => null);
  const required = ages.map((age, index) =>
    asDisplay(data.chart.required[index], age, data)
  );
  const markerIndex = coastFireMarkerIndex(
    data,
    ages,
    coastIndex,
    ssIndex,
    coastLine,
    required
  );
  coastAgeNote.textContent = String(ageWholeYears(coastAge));
  const monthsUntil = Math.round((coastAge - data.summary.current_age) * 12);
  if (monthsUntil <= 0) {
    coastLabel.textContent = t("coast.already");
    coastValue.textContent = t("coast.now");
    coastSsPrefix.textContent = t("coast.ssPrefixBefore");
    coastNote.textContent =
      markerIndex >= 0 ? formatSsAge(ages[markerIndex]) : formatSsAge(ssAge);
    return;
  }
  coastSsPrefix.textContent = t("coast.ssPrefix");
  coastNote.textContent = formatSsAge(ssAge);
  const years = Math.floor(monthsUntil / 12);
  const months = monthsUntil % 12;
  coastLabel.textContent = t("coast.in");
  coastValue.textContent = duration(years, months);
}

function renderSsCard(data) {
  const ssAge = ssRetirementAgeValue();
  refreshSsAgeLabel();
  const fireAt = data.chart.fire_age_exact;
  if (fireAt == null) {
    ssLabel.textContent = t("ss.ahead");
    ssAhead.textContent = "—";
    return;
  }
  const ahead = Math.round((ssAge - fireAt) * 12);
  const years = Math.floor(Math.abs(ahead) / 12);
  const months = Math.abs(ahead) % 12;
  if (ahead > 0) {
    ssLabel.textContent = t("ss.ahead");
    ssAhead.textContent = duration(years, months);
    return;
  }
  if (ahead < 0) {
    ssLabel.textContent = t("ss.after");
    ssAhead.textContent = duration(years, months);
    return;
  }
  ssLabel.textContent = t("ss.same");
  ssAhead.textContent = t("ss.sameAge");
}

function renderRuleCard(data) {
  const rate = withdrawalRateValue();
  const target = ruleTargetReal(data);
  const fireAgeExact = data.chart.fire_age_exact;
  const displayAge =
    displayUnits === "nominal" && fireAgeExact != null
      ? fireAgeExact
      : data.summary.current_age;
  ruleLabel.textContent = t("rule.series", { rate: formatWithdrawalRate(rate) });
  ruleTargetValue.innerHTML =
    target == null ? "—" : euroWithUnit(asDisplay(target, displayAge, data));
}

function renderHeadline(data) {
  const { fire_age, years_until_fire, months_until_fire, portfolio_at_fire } =
    data.summary;
  coastCard.hidden = !compareCoast;
  ssCard.hidden = !compareSs;
  ruleCard.hidden = !compareRule;
  if (compareCoast) {
    renderCoastCard(data);
  }
  if (compareSs) {
    renderSsCard(data);
  }
  if (compareRule) {
    renderRuleCard(data);
  }
  if (fire_age === null) {
    fireAge.textContent = "—";
    fireInLabel.textContent = t("fire.in");
    fireIn.textContent = t("fire.notReached");
    firePortfolio.textContent = "—";
    return;
  }
  fireAge.textContent = fire_age;
  if (isAlreadyAtFire(data)) {
    fireInLabel.textContent = t("fire.already");
    fireIn.textContent = t("fire.now");
  } else {
    fireInLabel.textContent = t("fire.in");
    fireIn.textContent = duration(years_until_fire, months_until_fire);
  }
  firePortfolio.innerHTML = euroWithUnit(
    asDisplay(portfolio_at_fire, data.chart.fire_age_exact, data)
  );
}

function renderTable(rows) {
  tableBody.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement("tr");
    if (row.is_fire) tr.className = "fire-row";
    const age = row.age + row.age_months / 12;
    const ageLabel =
      row.age_months > 0
        ? t("age.shortYearsMonths", { years: row.age, months: row.age_months })
        : `${row.age}`;
    tr.innerHTML = `
      <td>${row.year}</td>
      <td>${ageLabel}</td>
      <td>${euro(monthlyAsDisplay(row.monthly_contribution, age, latest))}</td>
      <td>${euro(asDisplay(row.contributed, age, latest))}</td>
      <td>${euro(asDisplay(row.portfolio, age, latest))}</td>
      <td>${euro(asDisplay(row.required, age, latest))}</td>
    `;
    tableBody.appendChild(tr);
  }
}

function renderChart(data) {
  const colors = palette();
  const ctx = document.getElementById("chart");
  const ages = data.chart.ages;
  const required = data.chart.required.map((value, index) =>
    asDisplay(value, ages[index], data)
  );
  const portfolio = padTo(
    data.chart.portfolio.map((value, index) => asDisplay(value, ages[index], data)),
    ages.length
  );
  const contributed = padTo(
    data.chart.contributed.map((value, index) => asDisplay(value, ages[index], data)),
    ages.length
  );
  const fireIndex =
    data.chart.fire_age_exact == null
      ? -1
      : closestIndex(ages, data.chart.fire_age_exact);
  const firePoints = ages.map((_, index) =>
    index === fireIndex
      ? asDisplay(data.summary.portfolio_at_fire, data.chart.fire_age_exact, data)
      : null
  );
  const ssAge = ssRetirementAgeValue();
  const ssInRange =
    ssAge != null &&
    !Number.isNaN(ssAge) &&
    ssAge >= ages[0] &&
    ssAge <= ages[ages.length - 1];
  const ssAnchorIndex = ssInRange ? closestIndex(ages, ssAge) : -1;
  const coastIndex =
    compareCoast && ssAnchorIndex >= 0 ? findCoastIndex(data, ssAge) : -1;
  const ssIndex = compareSs && ssAnchorIndex >= 0 ? ssAnchorIndex : -1;
  const coastLineFull =
    coastIndex >= 0 && ssAnchorIndex >= 0
      ? coastLineValues(data, coastIndex, ssAnchorIndex)
      : ages.map(() => null);
  const coastFireMarker =
    coastIndex >= 0 && ssAnchorIndex >= 0
      ? coastFireMarkerIndex(data, ages, coastIndex, ssAnchorIndex, coastLineFull, required)
      : -1;
  const coastLine = coastLineFull.map((value, index) =>
    coastFireMarker >= 0 && index > coastFireMarker ? null : value
  );
  const coastMeet =
    coastFireMarker >= 0 ? coastLine[coastFireMarker] ?? required[coastFireMarker] : null;
  const coastPoints = ages.map((_, index) =>
    index === coastFireMarker && coastMeet != null ? coastMeet : null
  );
  const ruleReal = compareRule ? ruleTargetReal(data) : null;
  const ruleLine =
    ruleReal == null
      ? []
      : ages.map((age) => asDisplay(ruleReal, age, data));
  const ruleLabelName = ruleSeriesLabel();
  const labels = {
    fireRegionFill: t("chart.fireRegionFill"),
    fireThreshold: t("chart.fireThreshold"),
    contributions: t("chart.contributions"),
    balance: t("chart.balance"),
    fire: t("chart.fire"),
    coastBalance: t("chart.coastBalance"),
    coastFire: t("chart.coastFire"),
    coast: t("chart.coast"),
    ss: t("chart.ss"),
    fireRegion: t("chart.fireRegion"),
    ageAxis: t("chart.ageAxis"),
  };
  const followable = ["balance", "contributions", "fireThreshold", "coastBalance"];
  let focusSeries = null;

  function strokeWidth(base) {
    return (ctx) => (ctx.dataset.series === focusSeries ? Math.max(base + 2, 4.25) : base);
  }

  function hoverRadius(size) {
    return (ctx) => (ctx.dataset.series === focusSeries ? size : 0);
  }

  function closestFollow(chartInstance, items, event) {
    let best = null;
    let bestDist = Infinity;
    for (const item of items) {
      const dataset = chartInstance.data.datasets[item.datasetIndex];
      if (!followable.includes(dataset?.series) || dataset.data[item.index] == null) {
        continue;
      }
      if (!item.element) continue;
      const dist = Math.abs(event.y - item.element.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = dataset.series;
      }
    }
    return best;
  }

  const datasets = [
    {
      series: "fireRegionFill",
      label: labels.fireRegionFill,
      data: required,      fill: "end",
      backgroundColor: withAlpha(colors.copper, 0.08),
      borderWidth: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      order: 4,
    },
    {
      series: "fireThreshold",
      label: labels.fireThreshold,
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
      series: "contributions",
      label: labels.contributions,
      data: contributed,
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
      series: "balance",
      label: labels.balance,
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
      series: "fire",
      label: labels.fire,
      data: firePoints,
      borderColor: colors.navyMid,
      backgroundColor: colors.navyMid,
      pointStyle: "circle",
      pointRadius: 11,
      pointHoverRadius: 13,
      pointHitRadius: 22,
      pointBorderWidth: 3,
      pointHoverBorderWidth: 3,
      pointBorderColor: colors.firePointBorder,
      pointHoverBorderColor: colors.firePointBorder,
      showLine: false,
      order: 0,
    },
    {
      series: "coastBalance",
      label: labels.coastBalance,
      data: coastLine,
      borderColor: colors.coast,
      backgroundColor: colors.coast,
      pointRadius: 0,
      pointHoverRadius: hoverRadius(3.5),
      borderWidth: strokeWidth(2.5),
      hoverBorderWidth: strokeWidth(2.5),
      spanGaps: false,
      fill: false,
      order: 0.5,
    },
    {
      series: "coastFire",
      label: labels.coastFire,
      data: coastPoints,
      borderColor: colors.coast,
      backgroundColor: colors.coast,
      pointStyle: "circle",
      pointRadius: coastMeet == null ? 0 : 11,
      pointHoverRadius: coastMeet == null ? 0 : 13,
      pointHitRadius: coastMeet == null ? 0 : 22,
      pointBorderWidth: 3,
      pointHoverBorderWidth: 3,
      pointBorderColor: colors.firePointBorder,
      pointHoverBorderColor: colors.firePointBorder,
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
    const snapTo = (series, index) => {
      if (index < 0) return null;
      const datasetIndex = chartInstance.data.datasets.findIndex(
        (dataset) => dataset.series === series
      );
      const point = chartInstance.getDatasetMeta(datasetIndex)?.data?.[index];
      if (!point) return null;
      const nearCircle = Math.hypot(event.x - point.x, event.y - point.y) <= 40;
      const nearColumn = Math.abs(event.x - point.x) <= 24;
      if (!nearCircle && !nearColumn) return null;
      return Chart.Interaction.modes.index(
        chartInstance,
        { native: event.native, x: point.x, y: point.y },
        options,
        useFinalPosition
      );
    };
    const snapped =
      snapTo("fire", fireIndex) ??
      snapTo("coastFire", coastFireMarker) ??
      items;
    focusSeries = closestFollow(chartInstance, snapped, event);
    return snapped;
  };

  Chart.Tooltip.positioners.pegLine = function pegLine(items, eventPosition) {
    const match = items.find((item) => {
      const series = this.chart.data.datasets[item.datasetIndex]?.series;
      return series === focusSeries && item.element;
    });
    const el = match?.element ?? items.find((item) => item.element)?.element;
    if (!el) return eventPosition;
    return { x: el.x, y: el.y };
  };

  const chartDecor = {
    id: "chartDecor",
    beforeDatasetDraw(chartInstance, args) {
      const series = chartInstance.data.datasets[args.index]?.series;
      if (series !== "fire" && series !== "coastFire") return;
      const { ctx } = chartInstance;
      ctx.save();
      ctx.shadowColor = withAlpha(
        series === "coastFire" ? colors.coast : colors.navyLight,
        series === "coastFire" ? 0.4 : 0.55
      );
      ctx.shadowBlur = series === "coastFire" ? 18 : 22;
      ctx.shadowOffsetY = 1;
    },
    afterDatasetDraw(chartInstance, args) {
      const series = chartInstance.data.datasets[args.index]?.series;
      if (series !== "fire" && series !== "coastFire") return;
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
      if (coastIndex >= 0) {
        const x = scales.x.getPixelForValue(coastIndex);
        ctx.strokeStyle = colors.coast;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }
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
      if (ruleLine.length) {
        ctx.strokeStyle = colors.rule;
        ctx.beginPath();
        ruleLine.forEach((value, index) => {
          const x = scales.x.getPixelForValue(index);
          const y = scales.y.getPixelForValue(value);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.restore();
    },
    afterEvent(chartInstance, args) {
      const { type } = args.event;
      if (type !== "mousemove" && type !== "mouseout") return;
      if (type === "mouseout" || !args.inChartArea) {
        if (focusSeries !== null) {
          focusSeries = null;
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
      if (next !== focusSeries) {
        focusSeries = next;
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
        labelAt(fireIndex, labels.fire, colors.muted);
      }
      if (coastIndex >= 0) {
        labelAt(coastIndex, labels.coast, colors.coast);
      }
      if (ssIndex >= 0) {
        labelAt(ssIndex, labels.ss, colors.ssInk);
      }
      if (ruleLine.length) {
        const y = scales.y.getPixelForValue(ruleLine[0]);
        const above = y > chartArea.top + 18;
        ctx.fillStyle = colors.ruleInk;
        ctx.textAlign = "left";
        ctx.textBaseline = above ? "bottom" : "top";
        ctx.fillText(
          ruleLabelName,
          chartArea.left + 12,
          y + (above ? -5 : 5)
        );
      }
      ctx.font = "800 24px Nunito, ui-sans-serif, system-ui";
      ctx.fillStyle = colors.copper;
      ctx.shadowColor = withAlpha(colors.copperDeep, 0.16);
      ctx.shadowBlur = 10;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(labels.fireRegion, chartArea.right - 12, chartArea.top + 10);
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
              const series = datasets[item.datasetIndex]?.series;
              const names = ["contributions", "balance", "fireThreshold"];
              if (compareCoast) names.splice(2, 0, "coastBalance");
              return names.includes(series);
            },
            sort(a, b) {
              const order = ["contributions", "balance", "coastBalance", "fireThreshold"];
              return (
                order.indexOf(datasets[a.datasetIndex]?.series) -
                order.indexOf(datasets[b.datasetIndex]?.series)
              );
            },
          },
        },
        tooltip: {
          enabled: false,
          position: "pegLine",
          filter(item) {
            if (item.raw == null) return false;
            return !["fireRegionFill", "fire", "coastFire"].includes(item.dataset.series);
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
            const coastMeetHover =
              coastMeet != null && coastFireMarker >= 0 && index === coastFireMarker;
            let status = t("chart.stillAccumulating");
            if (fire || coastMeetHover) {
              status = t("chart.congrats");
            } else if (ssIndex >= 0 && index === ssIndex) {
              status = t("chart.ssRetirement");
            } else if (fireIndex >= 0 && index > fireIndex) {
              status = t("chart.insideRegion");
            } else {
              const value = portfolio[index];
              if (value != null && value >= required[index]) {
                status = t("chart.insideRegion");
              }
            }
            const order = ["contributions", "balance", "coastBalance", "fireThreshold"];
            const rows = order
              .map((series) =>
                tooltip.dataPoints.find((point) => point.dataset.series === series)
              )
              .filter((point) => point != null && point.raw != null);
            const tone = fire || coastMeetHover ? " is-fire" : "";
            el.className = `chart-tooltip is-open${tone}`;
            el.innerHTML = `
              <p class="title">${formatAge(ages[index])}</p>
              <p class="status">${status}</p>
              ${rows
                .map((point) => {
                  const focused = point.dataset.series === focusSeries ? " focus" : "";
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
          title: { display: true, text: labels.ageAxis, color: colors.muted },
          ticks: {
            maxTicksLimit: 12,
            color: colors.muted,
            callback: (value) => Math.round(ages[value]),
          },
          grid: { color: colors.line },
        },
        y: {
          min: 0,
          suggestedMax:
            Math.max(
              ...required,
              ...(ruleLine.length ? ruleLine : [0]),
              ...coastLine.filter((value) => value != null)
            ) * 1.16,
          title: { display: true, text: unitsAxisTitle(), color: colors.muted },
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
  return t("warning.calculate");
}

function clearOutputs() {
  latest = null;
  fireAge.textContent = "—";
  fireInLabel.textContent = t("fire.in");
  fireIn.textContent = "—";
  firePortfolio.textContent = "—";
  ssLabel.textContent = t("ss.ahead");
  ssAhead.textContent = "—";
  coastLabel.textContent = t("coast.in");
  coastValue.textContent = "—";
  coastAgeNote.textContent = "—";
  coastSsPrefix.textContent = t("coast.ssPrefix");
  coastNote.textContent = "—";
  ruleTargetValue.textContent = "—";
  tableBody.replaceChildren();
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

async function calculate() {
  const problems = collectProblems();
  if (problems.length) {
    showWarning(problems);
    clearOutputs();
    return;
  }
  hideWarning();

  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readInputs()),
  });
  if (!response.ok) {
    showWarning([{ message: await readError(response) }]);
    clearOutputs();
    return;
  }
  latest = await response.json();
  renderOutputs();
}

function renderOutputs() {
  if (!latest) return;
  if (tableNote) {
    tableNote.textContent =
      displayUnits === "real" ? t("table.noteReal") : t("table.noteNominal");
  }
  renderHeadline(latest);
  renderChart(latest);
  renderTable(latest.table);
}

function scheduleCalculate() {
  clearTimeout(debounceId);
  debounceId = setTimeout(calculate, 200);
}

async function init() {
  locale = effectiveLocale();
  applyTheme();
  await loadCatalogs();
  applyI18n();
  fireIn.textContent = t("fire.calculating");
  const defaults = await fetch("/api/defaults").then((response) => response.json());
  applyLimits(defaults.limits);
  writeInputs(defaults);
  withdrawalRate.value = String(DEFAULT_WITHDRAWAL_RATE);
  refreshWithdrawalLabel();
  ssRetirementAge.value = String(defaults.ss_retirement_age ?? DEFAULT_SS_RETIREMENT_AGE);
  refreshSsAgeLabel();
  for (const name of NUMBER_FIELDS) {
    const input = document.getElementById(name);
    input.addEventListener("keydown", rejectNonDigitKey);
    input.addEventListener("beforeinput", rejectNonDigits);
    input.addEventListener("paste", pasteDigitsOnly);
  }
  form.addEventListener("input", (event) => {
    if (NUMBER_FIELDS.includes(event.target.id)) {
      keepDigitsOnly(event.target);
    }
    if (RATE_FIELDS.includes(event.target.id)) {
      refreshRateLabels();
    }
    scheduleCalculate();
  });
  document.querySelectorAll("[data-locale]").forEach((button) => {
    button.addEventListener("click", () => setLocale(button.dataset.locale));
  });
  document.querySelectorAll("[data-theme-mode]").forEach((button) => {
    button.addEventListener("click", () => setTheme(button.dataset.themeMode));
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (readStoredTheme() != null) return;
    applyTheme();
    if (latest) renderOutputs();
  });
  document.querySelectorAll("[data-units]").forEach((button) => {
    button.addEventListener("click", () => {
      displayUnits = button.dataset.units;
      document.querySelectorAll("[data-units]").forEach((other) => {
        other.classList.toggle("is-on", other === button);
      });
      renderOutputs();
    });
  });
  document.querySelectorAll("[data-compare]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = !button.classList.contains("is-on");
      button.classList.toggle("is-on", next);
      button.setAttribute("aria-pressed", String(next));
      if (button.dataset.compare === "coast") compareCoast = next;
      if (button.dataset.compare === "ss") compareSs = next;
      if (button.dataset.compare === "rule") compareRule = next;
      renderOutputs();
    });
  });
  withdrawalRate.addEventListener("input", () => {
    refreshWithdrawalLabel();
    if (latest) renderOutputs();
  });
  ssRetirementAge.addEventListener("input", () => {
    refreshSsAgeLabel();
    if (latest) renderOutputs();
  });
  document.querySelectorAll(".hint-btn").forEach((button) => {
    button.addEventListener("click", (event) => event.preventDefault());
  });
  const unitsHintWrap = document.querySelector(".units-control .hint");
  const unitsHint = unitsHintWrap?.querySelector(".hint-btn");
  if (unitsHint && unitsHintWrap) {
    const storageKey = "unitsHintSeen";
    const readSeen = () => {
      try {
        return sessionStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    };
    const writeSeen = () => {
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        /* private mode / file protocol */
      }
    };
    const markUnitsHintSeen = () => {
      unitsHint.classList.add("is-seen");
      writeSeen();
    };
    if (readSeen()) {
      markUnitsHintSeen();
    } else {
      let hoverTimer;
      const startHover = () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(markUnitsHintSeen, 500);
      };
      const cancelHover = () => clearTimeout(hoverTimer);
      unitsHintWrap.addEventListener("mouseenter", startHover);
      unitsHintWrap.addEventListener("mouseleave", cancelHover);
      unitsHint.addEventListener("focus", startHover);
      unitsHint.addEventListener("blur", cancelHover);
    }
  }
  await calculate();
}

init();
