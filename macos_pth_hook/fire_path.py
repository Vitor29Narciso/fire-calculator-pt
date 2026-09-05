"""Make ``fire_calculator`` importable when the editable ``.pth`` is skipped.

Python 3.12+ ignores ``.pth`` files with the macOS ``UF_HIDDEN`` flag.
iCloud-synced folders such as ``Documents`` apply that flag to everything
inside ``.venv``. This module is a real ``.py`` file in site-packages (not a
``.pth``), so console scripts can import it and put ``src/`` on ``sys.path``.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _add_src() -> None:
    try:
        project_root = Path(__file__).resolve().parents[4]
    except IndexError:
        return
    src = project_root / "src"
    if not (src / "fire_calculator" / "__init__.py").is_file():
        return
    src_str = str(src)
    if src_str not in sys.path:
        sys.path.insert(0, src_str)
    # uvicorn --reload spawns a child that does not import this module.
    existing = os.environ.get("PYTHONPATH", "")
    parts = [p for p in existing.split(os.pathsep) if p]
    if src_str not in parts:
        os.environ["PYTHONPATH"] = os.pathsep.join([src_str, *parts])


_add_src()


def run_cli() -> None:
    from fire_calculator.__main__ import main

    main()


def run_web() -> None:
    from fire_calculator.api import serve

    serve()
