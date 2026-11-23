#!/usr/bin/env python3
"""Validate source-attributed official UPSC PYQ records; never generates questions."""
from __future__ import annotations
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "pyq" / "questions.json"
SOURCES = ROOT / "data" / "pyq" / "sources.json"
YEARS = range(2001, 2026)


def validate_records(records, source_manifest):
    errors = []
    if not isinstance(records, list):
        return ["questions.json must contain a JSON array"]
    sources = {item.get("id"): item for item in source_manifest.get("sources", []) if isinstance(item, dict)}
    ids, paper_positions = set(), set()
    for number, item in enumerate(records, 1):
        label = f"record {number}"
        if not isinstance(item, dict):
            errors.append(f"{label}: must be an object")
            continue
        for key in ("id", "exam", "stage", "paper", "year", "question_number", "question", "source", "verification", "status"):
            if item.get(key) in (None, ""):
                errors.append(f"{label}: missing {key}")
        if not isinstance(item.get("year"), int) or item.get("year") not in YEARS:
            errors.append(f"{label}: year must be an integer from 2001 to 2025")
        if item.get("status") != "published":
            errors.append(f"{label}: public PYQ records must have status='published'")
        if item.get("id") in ids:
            errors.append(f"{label}: duplicate id {item.get('id')}")
        ids.add(item.get("id"))
        position = (item.get("year"), item.get("stage"), item.get("paper"), str(item.get("question_number")))
        if position in paper_positions:
            errors.append(f"{label}: duplicate year/stage/paper/question number {position}")
        paper_positions.add(position)
        source = item.get("source") if isinstance(item.get("source"), dict) else {}
        registered = sources.get(source.get("id"))
        if not registered:
            errors.append(f"{label}: source.id is not registered in sources.json")
        document_url = source.get("document_url", "")
        parsed = urlparse(document_url)
        allowed_host = registered.get("allowed_host", "") if registered else ""
        if parsed.scheme != "https" or not parsed.hostname or not (parsed.hostname == allowed_host or parsed.hostname.endswith("." + allowed_host)):
            errors.append(f"{label}: document_url must be HTTPS on the registered official host")
        verification = item.get("verification") if isinstance(item.get("verification"), dict) else {}
        if verification.get("status") != "verified":
            errors.append(f"{label}: verification.status must be 'verified'")
        for key in ("verified_at", "method"):
            if not verification.get(key):
                errors.append(f"{label}: verification.{key} is required")
        options = item.get("options")
        if options is not None and (not isinstance(options, list) or len(options) != 4 or len(set(map(str, options))) != 4):
            errors.append(f"{label}: options, when supplied, must contain four distinct choices")
        if not isinstance(item.get("question"), str) or len(item.get("question", "").strip()) < 8:
            errors.append(f"{label}: question text is missing or too short")
    return errors


def build_coverage_report(records, coverage):
    """Count published verified records without treating partial coverage as complete."""
    published = [
        row for row in records
        if isinstance(row, dict)
        and row.get("status") == "published"
        and isinstance(row.get("verification"), dict)
        and row["verification"].get("status") == "verified"
    ]
    by_year = Counter(str(row.get("year")) for row in published)
    by_paper = Counter((row.get("stage", ""), row.get("paper", "")) for row in published)
    by_subject = Counter((row.get("stage", ""), row.get("optional_subject") or row.get("subject") or "unspecified") for row in published)
    scope = coverage.get("scope", {})
    targets = []
    for group in coverage.get("targets", []):
        stage = group.get("stage", "")
        for paper in group.get("papers", []):
            count = by_paper[(stage, paper)]
            targets.append({
                "stage": stage,
                "paper": paper,
                "verified_question_records": count,
                "status": "records_present" if count else "no_verified_records",
                "completeness_claim": False,
            })
    return {
        "scope": {"from_year": scope.get("from_year"), "to_year": scope.get("to_year")},
        "verified_published_question_records": len(published),
        "records_by_year": dict(sorted(by_year.items())),
        "records_by_optional_subject": [
            {"stage": stage, "subject": subject, "count": count}
            for (stage, subject), count in sorted(by_subject.items())
        ],
        "paper_targets": targets,
        "note": "Record counts are not paper-completeness claims. A paper is complete only after a separate page-by-page review and explicit sign-off.",
    }


def main():
    try:
        records = json.loads(DATA.read_text(encoding="utf-8"))
        manifest = json.loads(SOURCES.read_text(encoding="utf-8"))
        coverage = json.loads((ROOT / "data" / "pyq" / "coverage.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read PYQ data, source manifest, or coverage map: {exc}")
        return 1
    errors = validate_records(records, manifest)
    if "--report" in sys.argv:
        print(json.dumps(build_coverage_report(records, coverage), indent=2, ensure_ascii=False))
        if errors:
            print("VALIDATION ERRORS:")
            for error in errors:
                print("ERROR", error)
            return 1
        return 0
    print(f"Official PYQ records checked: {len(records) if isinstance(records, list) else 0}")
    if errors:
        for error in errors:
            print("ERROR", error)
        return 1
    print("PASS: all published PYQs have registered official-source and verification metadata")
    print("Run: python tools/pyq.py --report  (counts records; does not claim paper completeness)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
