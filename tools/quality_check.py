#!/usr/bin/env python3
"""Static quality checks for The Aspirant's Desk before publishing."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
CHECKS = 0


def check(condition: bool, message: str) -> None:
    global CHECKS
    CHECKS += 1
    if not condition:
        ERRORS.append(message)


class Scripts(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.inline: list[str] = []
        self.external: list[str] = []
        self._active = False
        self._type = ""

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "script":
            return
        values = dict(attrs)
        self._type = values.get("type", "").lower()
        src = values.get("src")
        if src:
            if not src.startswith(("http://", "https://", "//")):
                self.external.append(src.split("?", 1)[0])
            self._active = False
        else:
            self._active = self._type in ("", "text/javascript", "application/javascript", "module")

    def handle_data(self, data):
        if self._active:
            self.inline.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "script":
            self._active = False


def run_node_check(source: str, label: str) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as f:
        f.write(source)
        name = f.name
    try:
        result = subprocess.run(["node", "--check", name], text=True, capture_output=True)
        check(result.returncode == 0, f"JavaScript syntax error in {label}: {result.stderr.strip()}")
    finally:
        Path(name).unlink(missing_ok=True)


def main() -> int:
    index = ROOT / "index.html"
    config = ROOT / "config.js"
    ai_js = ROOT / "assets/js/ai-desk.js"
    ai_css = ROOT / "assets/css/ai-desk.css"
    ai_ts = ROOT / "supabase/functions/ai-assistant/index.ts"

    check(index.is_file(), "index.html is missing")
    check(config.is_file(), "config.js is missing")
    check(ai_js.is_file(), "AI Desk JavaScript is missing")
    check(ai_css.is_file(), "AI Desk CSS is missing")
    check(ai_ts.is_file(), "AI assistant Edge Function source is missing")

    if index.is_file():
        html = index.read_text(encoding="utf-8")
        parser = Scripts()
        parser.feed(html)
        check('src="config.js"' in html, "index.html does not load config.js")
        check("cdn.jsdelivr.net/npm/@supabase/supabase-js@2" in html, "Supabase browser SDK is missing")
        check('src="assets/js/ai-desk.js" defer' in html, "AI Desk script is not included")
        check('href="assets/css/ai-desk.css"' in html, "AI Desk stylesheet is not included")
        for src in parser.external:
            check((ROOT / src).is_file(), f"Local script referenced by index.html is missing: {src}")
        for number, source in enumerate(parser.inline, start=1):
            if source.strip():
                run_node_check(source, f"index.html inline script {number}")

    if config.is_file():
        public_config = config.read_text(encoding="utf-8")
        check(not re.search(r"sb_secret_|service_role|GEMINI_API_KEY\s*=|GROQ_API_KEY\s*=", public_config, re.I),
              "A server-side secret appears in public config.js")

    if ai_js.is_file():
        run_node_check(ai_js.read_text(encoding="utf-8"), "assets/js/ai-desk.js")

    js_files = [p for p in (ROOT / "assets").rglob("*.js") if p != ai_js]
    for path in js_files:
        run_node_check(path.read_text(encoding="utf-8"), str(path.relative_to(ROOT)))

    questions_dir = ROOT / "data/questions"
    all_ids: dict[str, str] = {}
    if questions_dir.is_dir():
        for path in sorted(questions_dir.glob("*.json")):
            try:
                rows = json.loads(path.read_text(encoding="utf-8"))
                check(isinstance(rows, list), f"{path.name} must contain a JSON array")
                if not isinstance(rows, list):
                    continue
                for n, row in enumerate(rows, start=1):
                    valid = (
                        isinstance(row, dict)
                        and all(row.get(key) for key in ("id", "subject", "q", "a", "e", "status"))
                        and isinstance(row.get("w"), list)
                        and len(row.get("w", [])) == 3
                    )
                    check(valid, f"{path.name} record {n} has an invalid question schema")
                    if isinstance(row, dict) and row.get("id"):
                        key = str(row["id"])
                        if key in all_ids:
                            check(False, f"Duplicate question ID {key} in {path.name} and {all_ids[key]}")
                        else:
                            all_ids[key] = path.name
            except (OSError, json.JSONDecodeError) as exc:
                check(False, f"Cannot parse {path.name}: {exc}")

    for relative in ("data/current-affairs.json", "data/pib.json"):
        path = ROOT / relative
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if relative.endswith("current-affairs.json"):
                items = value.get("items") if isinstance(value, dict) else None
                check(isinstance(items, list), "current-affairs.json must contain an items array")
            else:
                check(isinstance(value, list), "pib.json must contain a JSON array")
        except (OSError, json.JSONDecodeError) as exc:
            check(False, f"Cannot parse {relative}: {exc}")

    if ai_ts.is_file():
        source = ai_ts.read_text(encoding="utf-8")
        check(r"article\s*\d+" in source, "AI retrieval Article-number matching regex is incorrectly escaped")
        check("if (true)" not in source, "AI retrieval must not fetch current-affairs feeds for every question")
        check("buildGroundedContext" in source, "AI retrieval function is missing")
        check("consume_ai_daily_quota" in source, "AI daily quota enforcement is missing")

    print(f"Quality checks executed: {CHECKS}")
    print(f"Question IDs inspected: {len(all_ids)}")
    if ERRORS:
        print(f"FAILED: {len(ERRORS)} issue(s)")
        for error in ERRORS:
            print(f" - {error}")
        return 1
    print("PASS: static quality checks completed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
