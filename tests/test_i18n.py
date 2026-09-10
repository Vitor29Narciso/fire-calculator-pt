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
    assert 'data-i18n="fields.current_age"' in html
    assert '<button type="button" class="switch-btn" data-locale="pt">PT</button>' in html
    assert '<button type="button" class="switch-btn is-on" data-locale="en">EN</button>' in html
    script = (WEB_DIR / "app.js").read_text(encoding="utf-8")
    assert "function t(" in script
    assert "loadCatalogs" in script
    assert "setLocale" in script
