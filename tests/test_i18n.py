import json
from pathlib import Path

from fire_calculator.api import WEB_DIR, index

LOCALES_DIR = WEB_DIR / "locales"


def _flatten(node: object, prefix: str = "") -> dict[str, str]:
    if isinstance(node, dict):
        flattened: dict[str, str] = {}
        for key, value in node.items():
            path = f"{prefix}.{key}" if prefix else key
            flattened.update(_flatten(value, path))
        return flattened
    if isinstance(node, str):
        return {prefix: node}
    raise TypeError(f"unexpected locale value at {prefix}: {type(node)}")


def _load(name: str) -> dict:
    return json.loads((LOCALES_DIR / name).read_text(encoding="utf-8"))


def test_locale_files_share_keys() -> None:
    english = _flatten(_load("en.json"))
    portuguese = _flatten(_load("pt.json"))

    assert english.keys() == portuguese.keys()
    assert english
    assert all(value for value in english.values())
    assert all(value for value in portuguese.values())


def test_index_wires_locale_switch_and_keys() -> None:
    html = index().body.decode()

    assert 'data-locale="pt"' in html
    assert 'data-locale="en"' in html
    assert 'data-i18n="chrome.heading"' in html
    assert 'data-i18n="footer.disclaimerIntro"' in html
    assert 'data-i18n="footer.disclaimerPrivacy"' in html
    assert '<div class="footbar-disclaimer">' in html
    assert 'id="disclaimer-expand"' in html
    assert 'id="footbar-disclaimer-more"' in html
    assert 'class="footbar-social"' in html
    assert 'data-i18n="footer.productName"' in html
    assert 'id="footbar-year"' in html
    assert 'class="footbar-meta"' in html
    assert 'linkedin.com/in/vitor29narciso' in html
    assert 'buymeacoffee.com/vitor29narciso' in html
    assert 'class="footbar-coffee"' in html
    assert 'data-i18n="footer.coffeeLabel"' in html
    assert 'bmc-cup.svg' in html
    assert 'class="footbar"' in html
    assert 'data-i18n="fields.current_age"' in html
    assert 'id="table-expand"' in html
    assert 'id="brand-reset"' in html
    assert 'class="mark-btn"' in html
    assert 'data-i18n-title="chrome.reset"' in html
    assert 'id="export-report"' in html
    assert 'id="print-report"' in html
    assert 'id="chart-capture-probe"' in html
    assert "html2pdf.bundle.min.js" in html
    assert 'id="share-simulation"' in html
    assert 'class="chrome-action-btn"' in html
    assert 'data-i18n-aria="chrome.downloadAria"' in html
    assert 'data-i18n-aria="chrome.shareAria"' in html
    assert 'id="share-dialog"' in html
    assert 'id="share-link-copy"' in html
    assert 'data-i18n="share.title"' in html
    assert '<button type="button" class="switch-btn" data-locale="pt">PT</button>' in html
    assert '<button type="button" class="switch-btn is-on" data-locale="en">EN</button>' in html
    script = (WEB_DIR / "app.js").read_text(encoding="utf-8")
    assert "function t(" in script
    assert "loadCatalogs" in script
    assert "setLocale" in script
    assert "browserLocale" in script
    assert "effectiveLocale" in script
    assert "renderPrintReport" in script
    assert "handleExportReport" in script
    assert "reportFilename" in script
    assert "buildReportSummaryCards" in script
    assert "createReportLogo" in script
    assert "loadReportLogoImage" in script
    assert "reportFooterText" in script
    assert "stampReportFooters" in script
    assert "dayChartPalette" in script
    assert "fire-row-before" in script
    assert "appendReportInputBlock" in script
    assert "PLAN_REPORT_COLUMNS" in script
