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
from publish_generated import merge_json
from upsc_angles import fallback_upsc_angle
from pyq import validate_records, build_coverage_report
from question_bank_audit import audit_question_bank

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

    # Full question-bank audit: report actual distribution without inventing target counts.
    bank_audit = audit_question_bank(ROOT / "data" / "questions")
    check(not bank_audit["errors"], "Question-bank audit found structural errors: " + "; ".join(bank_audit["errors"][:5]))
    check(bank_audit["total_records"] == len(all_ids),
          "Question-bank audit total must match the globally unique question IDs")
    check(isinstance(bank_audit["difficulty_distribution"], dict),
          "Question-bank audit must report difficulty distribution")

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

    # The publisher must union source items across concurrent updates without
    # discarding useful fields when one writer supplies an empty value.
    current_remote = {
        "updated": "2026-11-22T10:00:00+00:00",
        "items": [{"link": "https://example.test/a", "title": "Old", "upsc_angle": "Existing angle"}],
    }
    current_local = {
        "updated": "2026-11-22T12:00:00+00:00",
        "items": [
            {"link": "https://example.test/a", "title": "Updated", "upsc_angle": ""},
            {"link": "https://example.test/b", "title": "New"},
        ],
    }
    current_merged = merge_json(current_remote, current_local, "data/current-affairs.json")
    check(len(current_merged["items"]) == 2, "Publisher must merge current-affairs items by source link")
    retained = next((x for x in current_merged["items"] if x.get("link", "").endswith("/a")), {})
    check(retained.get("title") == "Updated" and retained.get("upsc_angle") == "Existing angle",
          "Publisher must prefer non-empty generated fields and preserve existing enrichment")

    pib_merged = merge_json(
        [{"l": "https://pib.test/1", "t": "One"}],
        [{"l": "https://pib.test/1", "t": "One updated"}, {"l": "https://pib.test/2", "t": "Two"}],
        "data/pib.json",
    )
    check(len(pib_merged) == 2, "Publisher must merge PIB items by official source link")
    check(any(x.get("t") == "One updated" for x in pib_merged),
          "Publisher must retain the latest non-empty PIB fields")

    # Official PYQ records must be source-attributed and explicitly verified.
    pyq_manifest = json.loads((ROOT / "data/pyq/sources.json").read_text(encoding="utf-8"))
    pyq_records = json.loads((ROOT / "data/pyq/questions.json").read_text(encoding="utf-8"))
    check(validate_records(pyq_records, pyq_manifest) == [],
          "Published official PYQs must pass source and verification checks")
    invalid_pyq = [{"id": "fake", "year": 2025, "status": "published", "question": "Invented sample question", "source": {}, "verification": {}}]
    check(bool(validate_records(invalid_pyq, pyq_manifest)),
          "PYQ validator must reject records without official source and verification metadata")

    # Official PYQ coverage reports counts only; zero records must never be labelled complete.
    coverage_data = json.loads((ROOT / "data/pyq/coverage.json").read_text(encoding="utf-8"))
    report = build_coverage_report(pyq_records, coverage_data)
    check(report["verified_published_question_records"] == len(pyq_records),
          "PYQ coverage report must count only verified published records")
    check(all(not item["completeness_claim"] for item in report["paper_targets"]),
          "PYQ coverage report must not claim paper completeness from record counts")

    # Coverage metadata is a target map, not a false claim of imported papers.
    coverage = json.loads((ROOT / "data/pyq/coverage.json").read_text(encoding="utf-8"))
    scope = coverage.get("scope", {})
    check(scope.get("from_year") == 2001 and scope.get("to_year") == 2025,
          "PYQ coverage scope must remain 2001-2025")
    target_pairs = {(x.get("stage"), paper) for x in coverage.get("targets", [])
                    for paper in x.get("papers", [])}
    for required in (("Prelims", "General Studies Paper I"),
                     ("Prelims", "General Studies Paper II (CSAT)"),
                     ("Mains", "Essay"), ("Mains", "General Studies Paper I"),
                     ("Mains", "General Studies Paper II"), ("Mains", "General Studies Paper III"),
                     ("Mains", "General Studies Paper IV")):
        check(required in target_pairs, f"PYQ coverage target is missing {required}")
    check("officialPyqStage" in html and "officialPyqSubject" in html and "officialPyqSearch" in html,
          "Official PYQ filters must include stage, optional subject, and text search")
    check("archived-exam-documents/question-papers" in html,
          "Official PYQ section must link to the UPSC archived paper index")

    # Offline current-affairs notes must be cautious syllabus pointers, not invented facts.
    polity_angle = fallback_upsc_angle("Polity")
    check("GS Paper II" in polity_angle and "not a prediction" in polity_angle,
          "Polity fallback must be a cautious GS-II syllabus pointer")
    check(fallback_upsc_angle("General") == "",
          "Broadly classified news must not receive an unsupported generic UPSC angle")

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
