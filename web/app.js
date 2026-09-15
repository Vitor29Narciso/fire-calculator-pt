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

const SIMULATION_FIELDS = [...NUMBER_FIELDS, ...RATE_FIELDS];
const PLAN_REPORT_COLUMNS = [
  ["current_age", "desired_monthly_net_income", "monthly_contribution"],
  ["life_expectancy", "initial_balance", "contribution_growth_rate"],
];
const MARKET_REPORT_COLUMNS = [
  ["annual_roi", "management_fee_rate"],
  ["inflation_rate", "gains_tax_rate"],
];

function reportCaptureScale() {
  return Math.min(3, Math.max(2, window.devicePixelRatio || 2));
}

function chartCaptureScale() {
  return Math.min(3, Math.max(2, window.devicePixelRatio || 2));
}
const SIMULATION_PARAM = "s";
const SIMULATION_PATH_PATTERN = /^\/s\/([0-9A-Za-z]{8})$/;

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
  if (latest) {
    refreshTableExpandButton(!condensedTableItems(latest.table).isFull);
  }
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
const tableExpand = document.getElementById("table-expand");
const tableExpandWrap = document.getElementById("table-expand-wrap");
const tableWrap = document.getElementById("table-wrap");
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
const brandReset = document.getElementById("brand-reset");
const exportReport = document.getElementById("export-report");
const printReport = document.getElementById("print-report");
const shareSimulation = document.getElementById("share-simulation");
const shareDialog = document.getElementById("share-dialog");
const shareDialogClose = document.getElementById("share-dialog-close");
const shareLinkInput = document.getElementById("share-link-input");
const shareLinkCopy = document.getElementById("share-link-copy");
const shareCopyFeedback = document.getElementById("share-copy-feedback");
const shareSocialButtons = shareDialog
  ? [...shareDialog.querySelectorAll("[data-share-channel]")]
  : [];
const footbarYear = document.getElementById("footbar-year");
const disclaimerExpand = document.getElementById("disclaimer-expand");
const disclaimerMore = document.getElementById("footbar-disclaimer-more");

const DEFAULT_WITHDRAWAL_RATE = 0.04;
const DEFAULT_SS_RETIREMENT_AGE = 66.75;

let chart;
let latest = null;
let debounceId;
let mobileChartPin = null;
let chartCompactMode = null;
let displayUnits = "real";
let fieldLimits = {};
let compareCoast = false;
let compareSs = false;
let compareRule = false;
let tableExpanded = false;
let disclaimerExpanded = false;
let initialDefaults = null;

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

function encodeBase64Url(text) {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  return atob(padded);
}

function simulationArrayFromInputs(values) {
  return SIMULATION_FIELDS.map((name) => Number(values[name]));
}

function simulationInputsFromArray(values) {
  if (!Array.isArray(values) || values.length !== SIMULATION_FIELDS.length) return null;
  const inputs = {};
  for (let index = 0; index < SIMULATION_FIELDS.length; index += 1) {
    const value = Number(values[index]);
    if (!Number.isFinite(value)) return null;
    inputs[SIMULATION_FIELDS[index]] = value;
  }
  return inputs;
}

function encodeSimulationParam(values) {
  return encodeBase64Url(JSON.stringify(simulationArrayFromInputs(values)));
}

function decodeSimulationParam(encoded) {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(encoded));
    return simulationInputsFromArray(parsed);
  } catch {
    return null;
  }
}

function validateSimulationInputs(values) {
  if (!values) return false;
  for (const name of NUMBER_FIELDS) {
    const limit = fieldLimits[name];
    const value = values[name];
    if (!limit || !Number.isFinite(value) || !Number.isInteger(value)) return false;
    if (value < limit.min || value > limit.max) return false;
  }
  for (const name of RATE_FIELDS) {
    const limit = fieldLimits[name];
    const value = values[name];
    if (!limit || !Number.isFinite(value)) return false;
    if (value < limit.min || value > limit.max) return false;
  }
  if (values.current_age >= values.life_expectancy) return false;
  return true;
}

function readSimulationIdFromPath(pathname = window.location.pathname) {
  const match = pathname.match(SIMULATION_PATH_PATTERN);
  return match ? match[1] : null;
}

async function fetchSimulationById(simulationId) {
  try {
    const response = await fetch(`/api/simulations/${encodeURIComponent(simulationId)}`);
    if (!response.ok) return null;
    const values = await response.json();
    return validateSimulationInputs(values) ? values : null;
  } catch {
    return null;
  }
}

async function readSimulationFromLocation() {
  const simulationId = readSimulationIdFromPath();
  if (simulationId) {
    const values = await fetchSimulationById(simulationId);
    return { values, invalid: values == null };
  }
  const hasLegacyParam = new URLSearchParams(window.location.search).has(SIMULATION_PARAM);
  const legacyValues = readSimulationFromSearch();
  return {
    values: legacyValues,
    invalid: hasLegacyParam && legacyValues == null,
  };
}

function buildSimulationShareUrl(simulationId) {
  return `${window.location.origin}/s/${simulationId}`;
}

function readSimulationFromSearch(search = window.location.search) {
  const params = new URLSearchParams(search);
  const encoded = params.get(SIMULATION_PARAM);
  if (!encoded) return null;
  const values = decodeSimulationParam(encoded);
  return validateSimulationInputs(values) ? values : null;
}

function clearSimulationFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;
  if (url.searchParams.has(SIMULATION_PARAM)) {
    url.searchParams.delete(SIMULATION_PARAM);
    changed = true;
  }
  if (readSimulationIdFromPath()) {
    history.replaceState(null, "", "/");
    return;
  }
  if (changed) {
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

let shareFeedbackTimer;
let shareCopyFeedbackTimer;
let shareDialogLastFocus = null;
let activeShareLink = "";

function lockPageScroll() {
  document.documentElement.classList.add("share-dialog-open");
}

function unlockPageScroll() {
  document.documentElement.classList.remove("share-dialog-open");
}

function buildShareMessage() {
  return t("share.message");
}

function buildShareText(link) {
  return `${buildShareMessage()}\n\n${link}`;
}

function whatsAppShareUrl(text) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

function messengerShareUrl(link) {
  return `fb-messenger://share?link=${encodeURIComponent(link)}`;
}

function telegramShareUrl(link) {
  const message = buildShareMessage();
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;
}

function emailShareUrl(link) {
  const subject = t("share.emailSubject");
  const body = buildShareText(link).replace(/\n/g, "\r\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function openExternalUrl(url) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function shareChannelUrl(channel, link) {
  switch (channel) {
    case "whatsapp":
      return whatsAppShareUrl(buildShareText(link));
    case "messenger":
      return messengerShareUrl(link);
    case "telegram":
      return telegramShareUrl(link);
    case "email":
      return emailShareUrl(link);
    default:
      return link;
  }
}

function setShareDialogBusy(busy) {
  if (shareLinkCopy) shareLinkCopy.disabled = busy;
  shareSocialButtons.forEach((button) => {
    if (button.tagName === "A") {
      if (busy) {
        button.setAttribute("aria-disabled", "true");
        button.setAttribute("tabindex", "-1");
      } else {
        button.removeAttribute("aria-disabled");
        button.removeAttribute("tabindex");
      }
    } else {
      button.disabled = busy;
    }
  });
}

function hideShareCopyFeedback() {
  if (!shareCopyFeedback) return;
  shareCopyFeedback.hidden = true;
}

function showShareCopyFeedback(messageKey = "share.copied") {
  if (!shareCopyFeedback) return;
  shareCopyFeedback.textContent = t(messageKey);
  shareCopyFeedback.hidden = false;
  clearTimeout(shareCopyFeedbackTimer);
  shareCopyFeedbackTimer = setTimeout(hideShareCopyFeedback, 2200);
}

function updateShareChannelLinks(link) {
  shareSocialButtons.forEach((button) => {
    if (button.tagName === "A") {
      button.href = shareChannelUrl(button.dataset.shareChannel, link);
    }
  });
}

async function createSimulationShareLink() {
  const response = await fetch("/api/simulations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readInputs()),
  });
  if (!response.ok) throw new Error("simulation create failed");
  const payload = await response.json();
  history.replaceState(null, "", payload.path);
  return {
    id: payload.id,
    link: buildSimulationShareUrl(payload.id),
    path: payload.path,
  };
}

function closeShareDialog() {
  if (!shareDialog || shareDialog.hidden) return;
  shareDialog.hidden = true;
  unlockPageScroll();
  hideShareCopyFeedback();
  activeShareLink = "";
  shareDialogLastFocus?.focus();
  shareDialogLastFocus = null;
}

async function copyShareLinkFromDialog(messageKey = "share.copied") {
  if (!activeShareLink) return false;
  try {
    await navigator.clipboard.writeText(activeShareLink);
    showShareCopyFeedback(messageKey);
    return true;
  } catch {
    showShareCopyFeedback("share.copyFailed");
    return false;
  }
}

async function openShareDialog() {
  if (!shareDialog) return;
  const problems = collectProblems();
  if (problems.length) {
    showWarning(problems);
    return;
  }
  hideWarning();
  hideShareCopyFeedback();
  activeShareLink = "";
  shareDialogLastFocus = document.activeElement;
  shareDialog.hidden = false;
  lockPageScroll();
  if (shareLinkInput) shareLinkInput.value = t("share.creating");
  setShareDialogBusy(true);
  shareDialogClose?.focus();
  try {
    const { link } = await createSimulationShareLink();
    activeShareLink = link;
    if (shareLinkInput) shareLinkInput.value = link;
    updateShareChannelLinks(link);
    setShareDialogBusy(false);
  } catch {
    closeShareDialog();
    flashShareFeedback("share.createFailed");
  }
}

function flashShareFeedback(messageKey) {
  if (!shareSimulation) return;
  const originalTitle = shareSimulation.getAttribute("title") || "";
  shareSimulation.setAttribute("title", t(messageKey));
  clearTimeout(shareFeedbackTimer);
  shareFeedbackTimer = setTimeout(() => {
    shareSimulation.setAttribute("title", originalTitle || t("chrome.share"));
  }, 2200);
}

function wireShareDialog() {
  if (!shareDialog) return;
  shareDialog.querySelectorAll("[data-share-close]").forEach((element) => {
    element.addEventListener("click", closeShareDialog);
  });
  shareLinkCopy?.addEventListener("click", () => {
    copyShareLinkFromDialog();
  });
  const messengerButton = shareDialog.querySelector('[data-share-channel="messenger"]');
  messengerButton?.addEventListener("click", (event) => {
    if (!activeShareLink || messengerButton.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    window.location.href = messengerShareUrl(activeShareLink);
    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        copyShareLinkFromDialog("share.messengerCopied");
      }
    }, 1200);
  });
  const telegramButton = shareDialog.querySelector('[data-share-channel="telegram"]');
  telegramButton?.addEventListener("click", (event) => {
    if (!activeShareLink || telegramButton.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    window.open(telegramShareUrl(activeShareLink), "_blank", "noopener,noreferrer");
  });
  const emailButton = shareDialog.querySelector('[data-share-channel="email"]');
  emailButton?.addEventListener("click", (event) => {
    if (!activeShareLink || emailButton.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    openExternalUrl(emailShareUrl(activeShareLink));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || shareDialog.hidden) return;
    closeShareDialog();
  });
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

function compactChartLayout() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function hideChartTooltip(chartInstance = chart) {
  mobileChartPin = null;
  const el = document.getElementById("chart-tooltip");
  if (el) el.classList.remove("is-open");
  if (!chartInstance) return;
  chartInstance.setActiveElements([]);
  chartInstance.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chartInstance.tooltip?.update();
}

function getChartTooltipEl(chartInstance, compact) {
  let el = document.getElementById("chart-tooltip");
  if (!el) {
    el = document.createElement("div");
    el.id = "chart-tooltip";
    el.className = "chart-tooltip";
  }
  const wrap = chartInstance.canvas.closest(".chart-wrap");
  const parent = compact && wrap ? wrap : document.body;
  if (el.parentElement !== parent) parent.appendChild(el);
  return el;
}

function positionChartTooltip(el, chartInstance, compact, caretX, caretY) {
  el.classList.toggle("is-compact", compact);
  if (compact) {
    el.style.left = "50%";
    el.style.right = "auto";
    el.style.top = "auto";
    el.style.bottom = "0.45rem";
    el.style.transform = "translateX(-50%)";
    return;
  }
  const rect = chartInstance.canvas.getBoundingClientRect();
  el.style.left = `${rect.left + window.scrollX + caretX}px`;
  el.style.top = `${rect.top + window.scrollY + caretY}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.transform = "translate(14px, -110%)";
}

function axisEuro(value, compact = compactChartLayout()) {
  if (!compact) return euro(value);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const scaled = value / 1_000_000;
    return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1)}M €`;
  }
  if (abs >= 1000) return `${Math.round(value / 1000)}k €`;
  return euro(value);
}

function formatAge(age) {
  const years = Math.floor(age);
  const months = Math.round((age - years) * 12);
  if (months <= 0) return t("age.years", { years });
  if (months === 12) return t("age.years", { years: years + 1 });
  return t("age.yearsMonths", { years, months });
}

function token(name, root = document.documentElement) {
  return getComputedStyle(root).getPropertyValue(name).trim();
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

function palette(root = document.documentElement) {
  return {
    navy: token("--navy", root),
    navyMid: token("--navy-mid", root),
    navyLight: token("--navy-light", root),
    slate: token("--slate", root),
    muted: token("--muted", root),
    line: token("--line", root),
    lineMid: token("--line-mid", root),
    copper: token("--copper", root),
    copperMid: token("--copper-mid", root),
    copperDeep: token("--copper-deep", root),
    copperWash: token("--copper-wash", root),
    firePointBorder: token("--fire-point-border", root),
    blue: token("--blue", root),
    ss: token("--ss", root),
    ssInk: token("--ss-ink", root),
    coast: token("--coast", root),
    coastInk: token("--coast-ink", root),
    coastWash: token("--coast-wash", root),
    rule: token("--rule", root),
    ruleInk: token("--rule-ink", root),
  };
}

function dayChartPalette() {
  const probe = document.getElementById("chart-capture-probe");
  return palette(probe ?? document.documentElement);
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

function condensedTableItems(rows) {
  const total = rows.length;
  if (total === 0) {
    return { items: [], isFull: true };
  }

  const picked = new Set();
  for (let index = 0; index < Math.min(5, total); index += 1) {
    picked.add(index);
  }
  for (let index = Math.max(0, total - 5); index < total; index += 1) {
    picked.add(index);
  }

  const fireIndex = rows.findIndex((row) => row.is_fire);
  if (fireIndex >= 0) {
    for (let index = fireIndex - 2; index <= fireIndex + 2; index += 1) {
      if (index >= 0 && index < total) picked.add(index);
    }
  }

  const sorted = [...picked].sort((a, b) => a - b);
  if (sorted.length >= total - 1) {
    return {
      items: rows.map((_, index) => ({ type: "row", index })),
      isFull: true,
    };
  }

  const items = [];
  sorted.forEach((index, position) => {
    if (position > 0 && index - sorted[position - 1] > 1) {
      items.push({ type: "gap" });
    }
    items.push({ type: "row", index });
  });
  return { items, isFull: false };
}

function tableAgeLabel(row) {
  return row.age_months > 0
    ? t("age.shortYearsMonths", { years: row.age, months: row.age_months })
    : `${row.age}`;
}

function createTableRow(row) {
  const tr = document.createElement("tr");
  if (row.is_fire) tr.className = "fire-row";
  const age = row.age + row.age_months / 12;
  tr.innerHTML = `
    <td>${row.year}</td>
    <td>${tableAgeLabel(row)}</td>
    <td>${euro(monthlyAsDisplay(row.monthly_contribution, age, latest))}</td>
    <td>${euro(asDisplay(row.contributed, age, latest))}</td>
    <td>${euro(asDisplay(row.portfolio, age, latest))}</td>
    <td>${euro(asDisplay(row.required, age, latest))}</td>
  `;
  return tr;
}

function createTableGapRow() {
  const tr = document.createElement("tr");
  tr.className = "table-gap";
  tr.innerHTML = `<td colspan="6">${t("table.gap")}</td>`;
  return tr;
}

function refreshTableExpandButton(isFull) {
  if (!tableExpand || !tableExpandWrap) return;
  tableExpandWrap.hidden = isFull;
  if (tableWrap) tableWrap.classList.toggle("is-expanded", tableExpanded);
  if (isFull) return;
  tableExpand.classList.toggle("is-expanded", tableExpanded);
  tableExpand.setAttribute("aria-expanded", tableExpanded ? "true" : "false");
  tableExpand.setAttribute(
    "aria-label",
    t(tableExpanded ? "table.collapseAria" : "table.expandAria")
  );
  tableExpand.title = t(tableExpanded ? "table.collapse" : "table.expand");
}

function renderTable(rows) {
  tableBody.replaceChildren();
  const plan = condensedTableItems(rows);
  refreshTableExpandButton(plan.isFull);
  const items =
    tableExpanded || plan.isFull
      ? rows.map((_, index) => ({ type: "row", index }))
      : plan.items;

  for (const item of items) {
    if (item.type === "gap") {
      tableBody.appendChild(createTableGapRow());
      continue;
    }
    tableBody.appendChild(createTableRow(rows[item.index]));
  }
}

function reportDateLabel() {
  const date = new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return t("report.metaLine", { date });
}

function reportUnitLabel() {
  return displayUnits === "real" ? t("units.realValue") : t("units.nominalValue");
}

function reportMoneyWithUnit(realValue, age, data) {
  if (realValue == null) return "—";
  return { main: euro(asDisplay(realValue, age, data)), unit: reportUnitLabel() };
}

let cachedReportLogo = null;

async function loadReportLogoImage() {
  if (cachedReportLogo) return cachedReportLogo;
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = "/static/favicon.svg";
  });
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d").drawImage(img, 0, 0, size, size);
  cachedReportLogo = canvas.toDataURL("image/png");
  return cachedReportLogo;
}

function createReportLogo(dataUrl) {
  const img = document.createElement("img");
  img.className = "print-report-mark";
  img.src = dataUrl;
  img.alt = "";
  return img;
}

function formatReportStatValue(value) {
  if (value == null || value === "—") return "—";
  if (typeof value === "object" && value.main != null) {
    return `${value.main}<span class="print-report-stat-unit">(${value.unit})</span>`;
  }
  return String(value);
}

function createReportStatCard(card) {
  const { label, value, variant = "", notes = [] } = card;
  const article = document.createElement("article");
  article.className = variant
    ? `print-report-stat print-report-stat-${variant}`
    : "print-report-stat";
  const labelEl = document.createElement("p");
  labelEl.className = "print-report-stat-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("p");
  valueEl.className = "print-report-stat-value";
  const formatted = formatReportStatValue(value);
  if (formatted.includes("<")) {
    valueEl.innerHTML = formatted;
  } else {
    valueEl.textContent = formatted;
  }
  article.append(labelEl, valueEl);
  for (const note of notes) {
    const noteEl = document.createElement("p");
    noteEl.className = "print-report-stat-note";
    const noteLabel = document.createElement("span");
    noteLabel.className = "print-report-stat-note-label";
    noteLabel.textContent = `${note.label}:`;
    const noteValue = document.createElement("span");
    noteValue.className = "print-report-stat-note-value";
    noteValue.textContent = note.value;
    noteEl.append(noteLabel, " ", noteValue);
    article.appendChild(noteEl);
  }
  return article;
}

function reportSsCard(data) {
  const ssAge = ssRetirementAgeValue();
  const fireAt = data.chart.fire_age_exact;
  const notes = [{ label: t("ss.legalAge"), value: formatSsAge(ssAge) }];
  if (fireAt == null) {
    return { label: t("ss.ahead"), value: "—", variant: "ss", notes };
  }
  const ahead = Math.round((ssAge - fireAt) * 12);
  const years = Math.floor(Math.abs(ahead) / 12);
  const months = Math.abs(ahead) % 12;
  if (ahead > 0) {
    return {
      label: t("ss.ahead"),
      value: duration(years, months),
      variant: "ss",
      notes,
    };
  }
  if (ahead < 0) {
    return {
      label: t("ss.after"),
      value: duration(years, months),
      variant: "ss",
      notes,
    };
  }
  return { label: t("ss.same"), value: t("ss.sameAge"), variant: "ss", notes };
}

function reportCoastCard(data) {
  const ssAge = ssRetirementAgeValue();
  const ages = data.chart.ages;
  const coastIndex = findCoastIndex(data, ssAge);
  const agePrefix = t("coast.agePrefix").replace(/:$/, "");
  if (coastIndex < 0) {
    return {
      label: t("coast.in"),
      value: t("coast.notReached"),
      variant: "coast",
      notes: [
        { label: agePrefix, value: "—" },
        { label: t("coast.ssPrefix").replace(/:$/, ""), value: "—" },
      ],
    };
  }
  const coastAge = ages[coastIndex];
  const ssIndex = closestIndex(ages, ssAge);
  const coastLine =
    ssIndex >= 0 ? coastLineValues(data, coastIndex, ssIndex) : ages.map(() => null);
  const required = ages.map((age, index) => asDisplay(data.chart.required[index], age, data));
  const markerIndex = coastFireMarkerIndex(
    data,
    ages,
    coastIndex,
    ssIndex,
    coastLine,
    required
  );
  const monthsUntil = Math.round((coastAge - data.summary.current_age) * 12);
  if (monthsUntil <= 0) {
    return {
      label: t("coast.already"),
      value: t("coast.now"),
      variant: "coast",
      notes: [
        { label: agePrefix, value: String(ageWholeYears(coastAge)) },
        {
          label: t("coast.ssPrefixBefore").replace(/:$/, ""),
          value: markerIndex >= 0 ? formatSsAge(ages[markerIndex]) : formatSsAge(ssAge),
        },
      ],
    };
  }
  return {
    label: t("coast.in"),
    value: duration(Math.floor(monthsUntil / 12), monthsUntil % 12),
    variant: "coast",
    notes: [
      { label: agePrefix, value: String(ageWholeYears(coastAge)) },
      { label: t("coast.ssPrefix").replace(/:$/, ""), value: formatSsAge(ssAge) },
    ],
  };
}

function reportRuleCard(data) {
  const rate = withdrawalRateValue();
  const target = ruleTargetReal(data);
  const fireAgeExact = data.chart.fire_age_exact;
  const displayAge =
    displayUnits === "nominal" && fireAgeExact != null
      ? fireAgeExact
      : data.summary.current_age;
  return {
    label: t("rule.series", { rate: formatWithdrawalRate(rate) }),
    value: target == null ? "—" : reportMoneyWithUnit(target, displayAge, data),
    variant: "rule",
    notes: [{ label: t("rule.withdrawalRate"), value: formatWithdrawalRate(rate) }],
  };
}

function buildReportSummaryCards(data) {
  const summary = reportSummaryValues(data);
  const cards = [
    { label: t("fire.age"), value: summary.fireAge },
    { label: summary.fireInLabel, value: summary.fireIn },
    { label: t("fire.balance"), value: summary.portfolio },
  ];
  if (compareSs) cards.push(reportSsCard(data));
  if (compareRule) cards.push(reportRuleCard(data));
  if (compareCoast) cards.push(reportCoastCard(data));
  return cards;
}

function formatReportInputValue(name, value) {
  if (RATE_FIELDS.includes(name)) return percent(value);
  if (name === "current_age" || name === "life_expectancy") {
    return String(Math.round(value));
  }
  return euro(Math.round(value));
}

function appendReportInputList(parent, fields) {
  const inputs = readInputs();
  const dl = document.createElement("dl");
  dl.className = "print-report-dl";
  for (const name of fields) {
    const dt = document.createElement("dt");
    dt.textContent = fieldLabel(name);
    const dd = document.createElement("dd");
    dd.textContent = formatReportInputValue(name, inputs[name]);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }
  parent.appendChild(dl);
}

function appendReportInputBlock(parent, sectionKey, columnFields) {
  const block = document.createElement("div");
  block.className = "print-report-input-block";
  const heading = document.createElement("h2");
  heading.textContent = t(sectionKey);
  block.appendChild(heading);
  const columns = document.createElement("div");
  columns.className = "print-report-input-columns";
  for (const fields of columnFields) {
    const column = document.createElement("div");
    column.className = "print-report-input-column";
    appendReportInputList(column, fields);
    columns.appendChild(column);
  }
  block.appendChild(columns);
  parent.appendChild(block);
}

function createReportTableRow(row, data) {
  const tr = document.createElement("tr");
  if (row.is_fire) tr.className = "fire-row";
  const age = row.age + row.age_months / 12;
  tr.innerHTML = `
    <td>${row.year}</td>
    <td>${tableAgeLabel(row)}</td>
    <td>${euro(monthlyAsDisplay(row.monthly_contribution, age, data))}</td>
    <td>${euro(asDisplay(row.contributed, age, data))}</td>
    <td>${euro(asDisplay(row.portfolio, age, data))}</td>
    <td>${euro(asDisplay(row.required, age, data))}</td>
  `;
  return tr;
}

function buildReportTable(data) {
  const rows = data.table;
  const plan = condensedTableItems(rows);
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>${t("table.year")}</th>
      <th>${t("table.age")}</th>
      <th>${t("table.monthlyContribution")}</th>
      <th>${t("table.invested")}</th>
      <th>${t("table.balance")}</th>
      <th>${t("table.needed")}</th>
    </tr>
  `;
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  let prevRow = null;
  for (const item of plan.items) {
    if (item.type === "gap") {
      tbody.appendChild(createTableGapRow());
      prevRow = null;
      continue;
    }
    const tr = createReportTableRow(rows[item.index], data);
    if (rows[item.index].is_fire && prevRow) prevRow.classList.add("fire-row-before");
    tbody.appendChild(tr);
    prevRow = tr;
  }
  table.appendChild(tbody);
  return table;
}

function reportSummaryValues(data) {
  const { fire_age, years_until_fire, months_until_fire, portfolio_at_fire } = data.summary;
  if (fire_age === null) {
    return {
      fireAge: "—",
      fireInLabel: t("fire.in"),
      fireIn: t("fire.notReached"),
      portfolio: "—",
    };
  }
  if (isAlreadyAtFire(data)) {
    return {
      fireAge: String(fire_age),
      fireInLabel: t("fire.already"),
      fireIn: t("fire.now"),
      portfolio: reportMoneyWithUnit(
        portfolio_at_fire,
        data.chart.fire_age_exact ?? data.summary.current_age,
        data
      ),
    };
  }
  return {
    fireAge: String(fire_age),
    fireInLabel: t("fire.in"),
    fireIn: duration(years_until_fire, months_until_fire),
    portfolio: reportMoneyWithUnit(
      portfolio_at_fire,
      data.chart.fire_age_exact ?? data.summary.current_age,
      data
    ),
  };
}

async function waitForChartPaint(chartInstance) {
  if (!chartInstance) return;
  await chartInstance.update("none");
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function captureChartForPrint(data) {
  const chartWrap = document.querySelector(".chart-wrap");
  const savedChartHeight = chartWrap?.style.height ?? "";
  const savedVisibility = chartWrap?.style.visibility ?? "";

  try {
    if (chartWrap) {
      chartWrap.style.height = "400px";
      chartWrap.style.visibility = "hidden";
    }
    renderChart(data, {
      animate: false,
      devicePixelRatio: chartCaptureScale(),
      colors: dayChartPalette(),
    });
    await waitForChartPaint(chart);

    const img = document.createElement("img");
    img.className = "print-report-chart-img";
    img.alt = t("report.chartAlt");
    img.src = chart.toBase64Image("image/png", 1);
    return img;
  } finally {
    if (chartWrap) {
      chartWrap.style.height = savedChartHeight;
      chartWrap.style.visibility = savedVisibility;
    }
    renderOutputs();
  }
}

function renderPrintReport(data, chartImage, logoDataUrl) {
  if (!printReport) return;
  printReport.replaceChildren();
  const root = document.createElement("div");
  root.className = "print-report-inner";

  const header = document.createElement("header");
  header.className = "print-report-header";
  const brand = document.createElement("div");
  brand.className = "print-report-brand";
  brand.appendChild(createReportLogo(logoDataUrl));
  const brandText = document.createElement("div");
  brandText.className = "print-report-brand-text";
  const title = document.createElement("h1");
  title.textContent = t("chrome.heading");
  const lede = document.createElement("p");
  lede.className = "print-report-lede";
  lede.textContent = t("chrome.lede");
  brandText.append(title, lede);
  brand.appendChild(brandText);
  const meta = document.createElement("p");
  meta.className = "print-report-meta";
  meta.textContent = reportDateLabel();
  header.append(brand, meta);
  root.appendChild(header);

  const inputs = document.createElement("section");
  inputs.className = "print-report-inputs";
  appendReportInputBlock(inputs, "plan.title", PLAN_REPORT_COLUMNS);
  appendReportInputBlock(inputs, "market.title", MARKET_REPORT_COLUMNS);
  root.appendChild(inputs);

  const summarySection = document.createElement("section");
  summarySection.className = "print-report-summary";
  for (const card of buildReportSummaryCards(data)) {
    summarySection.appendChild(createReportStatCard(card));
  }
  root.appendChild(summarySection);

  if (chartImage) {
    const chartSection = document.createElement("section");
    chartSection.className = "print-report-section print-report-chart";
    const chartHeading = document.createElement("h2");
    chartHeading.textContent = t("projection.title");
    chartSection.append(chartHeading, chartImage);
    root.appendChild(chartSection);
  }

  const tableSection = document.createElement("section");
  tableSection.className = "print-report-section print-report-table";
  const tableHeading = document.createElement("h2");
  tableHeading.textContent = t("table.title");
  const tableNoteEl = document.createElement("p");
  tableNoteEl.className = "print-report-table-note";
  tableNoteEl.textContent =
    displayUnits === "real" ? t("table.noteReal") : t("table.noteNominal");
  const tableWrap = document.createElement("div");
  tableWrap.className = "print-report-table-wrap";
  tableWrap.appendChild(buildReportTable(data));
  tableSection.append(tableHeading, tableNoteEl, tableWrap);
  root.appendChild(tableSection);

  const disclaimerBlock = document.createElement("div");
  disclaimerBlock.className = "print-report-disclaimer";
  const disclaimer = document.createElement("p");
  disclaimer.textContent = t("footer.disclaimerIntro");
  disclaimerBlock.appendChild(disclaimer);
  root.appendChild(disclaimerBlock);

  printReport.appendChild(root);
}

function reportFooterText() {
  return t("report.creditLine", {
    product: t("footer.productName"),
    year: String(new Date().getFullYear()),
  });
}

function stampReportFooters(pdf) {
  const footer = reportFooterText();
  const pageCount = pdf.internal.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.text(footer, pageWidth / 2, pageHeight - 7, { align: "center" });
  }
}

function reportFilename() {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `fire-calculator-${stamp}.pdf`;
}

async function waitForReportImages(root) {
  const pending = [...root.querySelectorAll("img")].filter((img) => !img.complete);
  if (!pending.length) return;
  await Promise.all(
    pending.map(
      (img) =>
        new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        })
    )
  );
}

async function handleExportReport() {
  const problems = collectProblems();
  if (problems.length) {
    showWarning(problems);
    return;
  }
  if (!latest || !printReport || !exportReport) return;
  if (typeof html2pdf !== "function") {
    showWarning([{ message: t("report.exportFailed") }]);
    return;
  }
  hideWarning();
  exportReport.disabled = true;
  exportReport.setAttribute("aria-busy", "true");

  try {
    const logoDataUrl = await loadReportLogoImage();
    const chartImage = await captureChartForPrint(latest);
    renderPrintReport(latest, chartImage, logoDataUrl);
    const root = printReport.querySelector(".print-report-inner");
    if (!root) return;

    printReport.hidden = false;
    printReport.classList.add("is-capturing");
    printReport.setAttribute("aria-hidden", "false");
    await waitForReportImages(root);
    await html2pdf()
      .set({
        margin: [10, 10, 16, 10],
        filename: reportFilename(),
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: {
          scale: reportCaptureScale(),
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], before: ".print-report-table" },
      })
      .from(root)
      .toPdf()
      .get("pdf")
      .then(stampReportFooters)
      .save();
  } catch {
    showWarning([{ message: t("report.exportFailed") }]);
  } finally {
    printReport.hidden = true;
    printReport.classList.remove("is-capturing");
    printReport.setAttribute("aria-hidden", "true");
    exportReport.disabled = false;
    exportReport.removeAttribute("aria-busy");
  }
}

function renderChart(data, { animate = true, devicePixelRatio = null, colors: colorOverride = null } = {}) {
  const colors = colorOverride ?? palette();
  const compact = compactChartLayout();
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
      if (compactChartLayout()) return;
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
        ctx.font = compact
          ? "700 10px Nunito, ui-sans-serif, system-ui"
          : "700 12px Nunito, ui-sans-serif, system-ui";
        ctx.fillText(
          ruleLabelName,
          chartArea.left + (compact ? 6 : 12),
          y + (above ? -5 : 5)
        );
      }
      if (!compact) {
        ctx.font = "800 24px Nunito, ui-sans-serif, system-ui";
        ctx.fillStyle = colors.copper;
        ctx.shadowColor = withAlpha(colors.copperDeep, 0.16);
        ctx.shadowBlur = 10;
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(labels.fireRegion, chartArea.right - 12, chartArea.top + 10);
      }
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
      devicePixelRatio: devicePixelRatio ?? (window.devicePixelRatio || 1),
      animation: animate ? undefined : false,
      interaction: { mode: "snapFire", intersect: false },
      events: compact
        ? ["click", "touchstart", "mouseout"]
        : ["mousemove", "mouseout", "click", "touchstart", "touchmove"],
      onClick(event, elements, chartInstance) {
        if (!compactChartLayout()) return;
        if (elements.length) {
          mobileChartPin = elements[0].index;
          chartInstance.setActiveElements([
            { datasetIndex: elements[0].datasetIndex, index: elements[0].index },
          ]);
          chartInstance.tooltip.setActiveElements(chartInstance.getActiveElements(), {
            x: event.x,
            y: event.y,
          });
        }
        chartInstance.tooltip.update();
      },
      transitions: {
        active: { animation: { duration: 0 } },
      },
      layout: {
        padding: compact ? { top: 4, right: 6, bottom: 0, left: 0 } : {},
      },
      plugins: {
        filler: { propagate: false },
        legend: {
          position: "top",
          align: "center",
          labels: {
            font: { family: "Nunito, ui-sans-serif, system-ui", size: compact ? 10 : 13 },
            color: colors.slate,
            usePointStyle: true,
            boxWidth: compact ? 8 : 12,
            padding: compact ? 10 : 16,
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
            const el = getChartTooltipEl(chartInstance, compact);
            let index;
            if (compact) {
              if (mobileChartPin == null) {
                el.classList.remove("is-open");
                return;
              }
              index = mobileChartPin;
            } else if (tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
              el.classList.remove("is-open");
              return;
            } else {
              index = tooltip.dataPoints[0].dataIndex;
            }
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
            const order = compact
              ? ["balance", "fireThreshold"]
              : ["contributions", "balance", "coastBalance", "fireThreshold"];
            const pointsBySeries = compact
              ? order.map((series) => {
                  const datasetIndex = datasets.findIndex((dataset) => dataset.series === series);
                  if (datasetIndex < 0) return null;
                  const raw = datasets[datasetIndex].data[index];
                  if (raw == null) return null;
                  return {
                    dataset: { series, label: datasets[datasetIndex].label, backgroundColor: datasets[datasetIndex].backgroundColor },
                    raw,
                  };
                })
              : order
                  .map((series) =>
                    tooltip.dataPoints.find((point) => point.dataset.series === series)
                  )
                  .filter((point) => point != null && point.raw != null);
            const rows = compact ? pointsBySeries.filter(Boolean) : pointsBySeries;
            const tone = fire || coastMeetHover ? " is-fire" : "";
            el.className = `chart-tooltip is-open${tone}${compact ? " is-compact" : ""}`;
            el.innerHTML = `
              <p class="title">${formatAge(ages[index])}</p>
              <p class="status">${status}</p>
              ${rows
                .map((point) => {
                  const focused =
                    !compact && point.dataset.series === focusSeries ? " focus" : "";
                  const swatch = point.dataset.backgroundColor;
                  return `<p class="row${focused}"><span class="swatch" style="background:${swatch}"></span>${point.dataset.label}: ${euro(point.raw)}</p>`;
                })
                .join("")}
            `;
            const caretX = compact
              ? chartInstance.chartArea.left + chartInstance.chartArea.width / 2
              : tooltip.caretX;
            const caretY = compact ? chartInstance.chartArea.bottom : tooltip.caretY;
            positionChartTooltip(el, chartInstance, compact, caretX, caretY);
          },
        },
      },
      scales: {
        x: {
          title: {
            display: !compact,
            text: labels.ageAxis,
            color: colors.muted,
            font: { size: compact ? 10 : 12 },
          },
          ticks: {
            maxTicksLimit: compact ? 5 : 12,
            color: colors.muted,
            font: { size: compact ? 10 : 12 },
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
          title: {
            display: !compact,
            text: unitsAxisTitle(),
            color: colors.muted,
            font: { size: compact ? 10 : 12 },
          },
          ticks: {
            maxTicksLimit: compact ? 5 : 8,
            color: colors.muted,
            font: { size: compact ? 10 : 12 },
            callback: (value) => axisEuro(value, compact),
          },
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
  hideChartTooltip();
  if (tableNote) {
    tableNote.textContent =
      displayUnits === "real" ? t("table.noteReal") : t("table.noteNominal");
  }
  renderHeadline(latest);
  renderChart(latest, { animate: !compactChartLayout() });
  renderTable(latest.table);
}

function scheduleCalculate() {
  clearTimeout(debounceId);
  debounceId = setTimeout(calculate, 200);
}

async function applyInitialDefaults(defaults) {
  applyLimits(defaults.limits);
  const { values: shared, invalid } = await readSimulationFromLocation();
  writeInputs(shared ?? defaults);
  if (invalid) clearSimulationFromUrl();
  withdrawalRate.value = String(DEFAULT_WITHDRAWAL_RATE);
  refreshWithdrawalLabel();
  ssRetirementAge.value = String(defaults.ss_retirement_age ?? DEFAULT_SS_RETIREMENT_AGE);
  refreshSsAgeLabel();
}

function wireMarkAnimation(button) {
  if (!button) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const lastSpark = button.querySelector(".mark-spark:last-child");
  if (!lastSpark) return;

  const play = () => {
    if (button.classList.contains("is-playing")) return;
    button.classList.add("is-playing");
  };

  button.addEventListener("mouseenter", play);
  button.addEventListener("focus", play);
  lastSpark.addEventListener("animationend", (event) => {
    if (event.animationName !== "mark-spark-ray") return;
    if (!button.classList.contains("is-playing")) return;
    button.classList.remove("is-playing");
  });
}

function refreshDisclaimerToggle() {
  if (!disclaimerExpand || !disclaimerMore) return;
  disclaimerMore.hidden = !disclaimerExpanded;
  disclaimerExpand.classList.toggle("is-expanded", disclaimerExpanded);
  disclaimerExpand.setAttribute("aria-expanded", disclaimerExpanded ? "true" : "false");
  disclaimerExpand.setAttribute(
    "aria-label",
    t(disclaimerExpanded ? "footer.disclaimerCollapseAria" : "footer.disclaimerExpandAria")
  );
  disclaimerExpand.title = t(
    disclaimerExpanded ? "footer.disclaimerCollapse" : "footer.disclaimerExpand"
  );
}

function resetViewState() {
  displayUnits = "real";
  compareCoast = false;
  compareSs = false;
  compareRule = false;
  tableExpanded = false;
  disclaimerExpanded = false;
  document.querySelectorAll("[data-units]").forEach((button) => {
    button.classList.toggle("is-on", button.dataset.units === "real");
  });
  document.querySelectorAll("[data-compare]").forEach((button) => {
    button.classList.remove("is-on");
    button.setAttribute("aria-pressed", "false");
  });
  hideWarning();
  refreshDisclaimerToggle();
}

async function resetToDefaults() {
  if (!initialDefaults) return;
  clearSimulationFromUrl();
  await applyInitialDefaults(initialDefaults);
  resetViewState();
  fireIn.textContent = t("fire.calculating");
  await calculate();
}

async function init() {
  locale = effectiveLocale();
  applyTheme();
  await loadCatalogs();
  applyI18n();
  loadReportLogoImage().catch(() => {});
  if (footbarYear) {
    footbarYear.textContent = String(new Date().getFullYear());
  }
  fireIn.textContent = t("fire.calculating");
  const defaults = await fetch("/api/defaults").then((response) => response.json());
  initialDefaults = defaults;
  await applyInitialDefaults(defaults);
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
  if (brandReset) {
    brandReset.addEventListener("click", () => {
      resetToDefaults();
    });
    wireMarkAnimation(brandReset);
  }
  if (shareSimulation) {
    shareSimulation.addEventListener("click", () => {
      openShareDialog();
    });
  }
  wireShareDialog();
  if (exportReport) {
    exportReport.addEventListener("click", handleExportReport);
  }
  if (tableExpand) {
    tableExpand.addEventListener("click", () => {
      tableExpanded = !tableExpanded;
      if (latest) renderTable(latest.table);
    });
  }
  refreshDisclaimerToggle();
  if (disclaimerExpand) {
    disclaimerExpand.addEventListener("click", () => {
      disclaimerExpanded = !disclaimerExpanded;
      refreshDisclaimerToggle();
    });
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (readStoredTheme() != null) return;
    applyTheme();
    if (latest) renderOutputs();
  });
  let chartLayoutTimer;
  chartCompactMode = compactChartLayout();
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!compactChartLayout() || mobileChartPin == null || !chart) return;
      if (event.target.closest(".chart-wrap")) return;
      hideChartTooltip();
    },
    true
  );
  window.addEventListener("resize", () => {
    if (!latest) return;
    clearTimeout(chartLayoutTimer);
    chartLayoutTimer = setTimeout(() => {
      const nextCompact = compactChartLayout();
      if (nextCompact !== chartCompactMode) {
        chartCompactMode = nextCompact;
        hideChartTooltip();
        renderChart(latest, { animate: false });
      } else if (chart) {
        chart.resize();
      }
    }, 150);
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
