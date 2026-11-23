#!/usr/bin/env python3
"""Validate source-attributed official UPSC PYQ records and report honest coverage."""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "pyq" / "questions.json"
SOURCES = ROOT / "data" / "pyq" / "sources.json"
COVERAGE = ROOT / "data" / "pyq" / "coverage.json"
YEARS = range(2001, 2026)


def validate_records(records, source_manifest):
    """Reject public records without registered official provenance and verification."""
    errors = []
    if not isinstance(records, list):
        return ["questions.json must contain a JSON array"]
    source_rows = source_manifest.get("sources", []) if isinstance(source_manifest, dict) else []
    sources = {item.get("id"): item for item in source_rows if isinstance(item, dict) and item.get("id")}
    ids, paper_positions = set(), set()

    for number, item in enumerate(records, 1):
        label = f"record {number}"
        if not isinstance(item, dict):
            errors.append(f"{label}: must be an object")
            continue
        for key in ("id", "exam", "stage", "paper", "year", "question_number",
                    "question", "source", "verification", "status"):
            if item.get(key) in (None, ""):
                errors.append(f"{label}: missing {key}")

        year = item.get("year")
        if isinstance(year, bool) or not isinstance(year, int) or year not in YEARS:
            errors.append(f"{label}: year must be an integer from 2001 to 2025")

        identifier = item.get("id")
        if identifier:
            if identifier in ids:
                errors.append(f"{label}: duplicate id {identifier}")
            ids.add(identifier)

        question_number = item.get("question_number")
        if isinstance(question_number, bool) or not isinstance(question_number, (int, str)) or not str(question_number).strip():
            errors.append(f"{label}: question_number must be a non-empty integer or string")

        position = (year, item.get("stage"), item.get("paper"), str(question_number))
        if all(value not in (None, "") for value in position):
            if position in paper_positions:
                errors.append(f"{label}: duplicate year/stage/paper/question number {position}")
            paper_positions.add(position)

        if item.get("status") != "published":
            errors.append(f"{label}: public PYQ records must have status='published'")

        source = item.get("source") if isinstance(item.get("source"), dict) else {}
        registered = sources.get(source.get("id"))
        if not registered:
            errors.append(f"{label}: source.id is not registered in sources.json")
        document_url = source.get("document_url", "")
        parsed = urlparse(document_url)
        allowed_host = registered.get("allowed_host", "") if registered else ""
        if (not allowed_host or parsed.scheme != "https" or not parsed.hostname
                or not (parsed.hostname == allowed_host or parsed.hostname.endswith("." + allowed_host))):
            errors.append(f"{label}: document_url must be HTTPS on the registered official host")

        verification = item.get("verification") if isinstance(item.get("verification"), dict) else {}
        if verification.get("status") != "verified":
            errors.append(f"{label}: verification.status must be 'verified'")
        for key in ("verified_at", "method"):
            if not verification.get(key):
                errors.append(f"{label}: verification.{key} is required")

        options = item.get("options")
        if options is not None:
            if (not isinstance(options, list) or len(options) != 4
                    or len({str(option).strip().casefold() for option in options}) != 4):
                errors.append(f"{label}: options, when supplied, must contain four distinct choices")

        question = item.get("question")
        if not isinstance(question, str) or len(question.strip()) < 8:
            errors.append(f"{label}: question text is missing or too short")

    return errors


def build_coverage_report(records, coverage):
    """Count verified records by year and paper; never infer full-paper completion."""
    published = [
        row for row in records
        if isinstance(row, dict)
        and row.get("status") == "published"
        and isinstance(row.get("verification"), dict)
        and row["verification"].get("status") == "verified"
        and isinstance(row.get("year"), int)
        and not isinstance(row.get("year"), bool)
    ]
    by_year = Counter(str(row["year"]) for row in published)
    by_paper_year = Counter(
        (row.get("stage", ""), row.get("paper", ""), row["year"])
        for row in published
    )
    by_optional = Counter(
        (row.get("stage", ""), row.get("optional_subject") or row.get("subject") or "unspecified")
        for row in published
        if row.get("optional_subject") or row.get("subject")
    )
    scope = coverage.get("scope", {})
    first_year, last_year = scope.get("from_year", 2001), scope.get("to_year", 2025)
    years = list(range(first_year, last_year + 1)) if (
        isinstance(first_year, int) and isinstance(last_year, int) and first_year <= last_year
    ) else []

    paper_targets = []
    for group in coverage.get("targets", []):
        stage = group.get("stage", "")
        for paper in group.get("papers", []):
            yearly = []
            for year in years:
                count = by_paper_year[(stage, paper, year)]
                yearly.append({
                    "year": year,
                    "verified_question_records": count,
                    "status": "records_present" if count else "no_verified_records",
                })
            present = sum(1 for entry in yearly if entry["verified_question_records"])
            paper_targets.append({
                "stage": stage,
                "paper": paper,
                "years_with_verified_records": present,
                "years_without_verified_records": len(years) - present,
                "yearly_coverage": yearly,
                "completeness_claim": False,
            })

    optional_subject_coverage = []
    optional_subjects = coverage.get("optional_subjects", [])
    optional_papers = ("Optional Paper I", "Optional Paper II")
    for subject_row in optional_subjects:
        subject_name = subject_row.get("name", "")
        if not subject_name:
            continue
        paper_rows = []
        missing_pairs = 0
        for paper in optional_papers:
            yearly = []
            for year in years:
                count = sum(
                    1 for row in published
                    if row.get("stage") == "Mains"
                    and (row.get("optional_subject") or row.get("subject")) == subject_name
                    and row.get("paper") == paper
                    and row.get("year") == year
                )
                yearly.append({
                    "year": year,
                    "verified_question_records": count,
                    "status": "records_present" if count else "no_verified_records",
                })
                if not count:
                    missing_pairs += 1
            paper_rows.append({
                "paper": paper,
                "years_with_verified_records": sum(bool(row["verified_question_records"]) for row in yearly),
                "years_without_verified_records": sum(not row["verified_question_records"] for row in yearly),
                "yearly_coverage": yearly,
                "completeness_claim": False,
            })
        optional_subject_coverage.append({
            "subject": subject_name,
            "category": subject_row.get("category", "optional"),
            "paper_targets": paper_rows,
            "missing_year_paper_pairs": missing_pairs,
            "completeness_claim": False,
        })

    return {
        "scope": {"from_year": first_year, "to_year": last_year},
        "verified_published_question_records": len(published),
        "records_by_year": dict(sorted(by_year.items())),
        "records_by_optional_subject": [
            {"stage": stage, "subject": subject, "count": count}
            for (stage, subject), count in sorted(by_optional.items())
        ],
        "paper_targets": paper_targets,
        "optional_subject_coverage": optional_subject_coverage,
        "optional_subjects_in_scope": len(optional_subject_coverage),
        "optional_subject_missing_year_paper_pairs": sum(
            item["missing_year_paper_pairs"] for item in optional_subject_coverage
        ),
        "missing_year_paper_pairs": sum(item["years_without_verified_records"] for item in paper_targets),
        "note": (
            "A year with one or more records is not necessarily a complete paper. "
            "Record counts are not paper-completeness claims; full-paper completion "
            "requires page-by-page review and explicit sign-off."
        ),
    }


def load_inputs():
    return (
        json.loads(DATA.read_text(encoding="utf-8")),
        json.loads(SOURCES.read_text(encoding="utf-8")),
        json.loads(COVERAGE.read_text(encoding="utf-8")),
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", nargs="?", choices=("validate", "report"), default="validate")
    parser.add_argument("--report", action="store_true", help="print the machine-readable coverage report")
    parser.add_argument("--output", type=Path, help="write the coverage report to a JSON file")
    args = parser.parse_args()

    try:
        records, manifest, coverage = load_inputs()
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read PYQ data, source manifest, or coverage map: {exc}")
        return 1

    errors = validate_records(records, manifest)
    if args.report or args.command == "report":
        rendered = json.dumps(build_coverage_report(records, coverage), indent=2, ensure_ascii=False) + "\n"
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(rendered, encoding="utf-8")
        print(rendered, end="")
    else:
        print(f"Official PYQ records checked: {len(records) if isinstance(records, list) else 0}")

    if errors:
        for error in errors:
            print("ERROR", error, file=sys.stderr)
        return 1
    if not (args.report or args.command == "report"):
        print("PASS: all published PYQs have registered official-source and verification metadata")
        print("Run: python tools/pyq.py --report  (year-by-paper counts; not a completeness claim)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
