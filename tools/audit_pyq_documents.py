#!/usr/bin/env python3
"""Audit provenance metadata for official UPSC paper PDFs without copying question text."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DOCUMENTS = ROOT / "data" / "pyq" / "verified-documents.json"
SOURCES = ROOT / "data" / "pyq" / "sources.json"
YEARS = range(2001, 2026)
CATEGORIES = {"General", "General Studies", "Optional", "Literature"}


def audit_documents(documents: object, source_manifest: object) -> dict:
    """Validate the paper-level catalogue and return transparent coverage counts."""
    errors: list[str] = []
    rows = documents.get("documents", []) if isinstance(documents, dict) else None
    source_rows = source_manifest.get("sources", []) if isinstance(source_manifest, dict) else []
    hosts = {
        str(row.get("allowed_host", "")).lower()
        for row in source_rows
        if isinstance(row, dict) and row.get("allowed_host")
    }
    if not isinstance(rows, list):
        rows = []
        errors.append("verified-documents.json must contain a documents array")

    ids: set[str] = set()
    positions: set[tuple] = set()
    counts: Counter[str] = Counter()
    by_year: Counter[str] = Counter()
    for number, row in enumerate(rows, 1):
        label = f"document {number}"
        if not isinstance(row, dict):
            errors.append(f"{label}: expected an object")
            continue
        for key in ("id", "exam", "year", "stage", "subject", "paper", "category",
                    "status", "title", "document_url", "verification"):
            if row.get(key) in (None, ""):
                errors.append(f"{label}: missing {key}")
        identifier = str(row.get("id", "")).strip()
        if identifier:
            if identifier in ids:
                errors.append(f"{label}: duplicate id {identifier}")
            ids.add(identifier)
        year = row.get("year")
        if isinstance(year, bool) or not isinstance(year, int) or year not in YEARS:
            errors.append(f"{label}: year must be an integer from 2001 to 2025")
        if row.get("stage") != "Mains":
            errors.append(f"{label}: unsupported stage; expected Mains for this manifest")
        if row.get("category") not in CATEGORIES:
            errors.append(f"{label}: unsupported category")
        position = (year, row.get("stage"), row.get("subject"), row.get("paper"))
        if all(value not in (None, "") for value in position):
            if position in positions:
                errors.append(f"{label}: duplicate year/stage/subject/paper entry {position}")
            positions.add(position)
        if row.get("status") != "verified":
            errors.append(f"{label}: manifest entries must remain explicitly verified")
        parsed = urlparse(str(row.get("document_url", "")))
        host = (parsed.hostname or "").lower()
        if (parsed.scheme != "https" or not host
                or not any(host == allowed or host.endswith("." + allowed) for allowed in hosts)):
            errors.append(f"{label}: document_url must use a registered official HTTPS host")
        verification = row.get("verification")
        if not isinstance(verification, dict):
            errors.append(f"{label}: verification must be an object")
        else:
            for key in ("verified_at", "method"):
                if not verification.get(key):
                    errors.append(f"{label}: verification.{key} is required")
        counts[str(row.get("category") or "unspecified")] += 1
        if isinstance(year, int) and not isinstance(year, bool):
            by_year[str(year)] += 1

    return {
        "documents_checked": len(rows),
        "unique_ids": len(ids),
        "by_category": dict(sorted(counts.items())),
        "by_year": dict(sorted(by_year.items())),
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args()
    try:
        documents = json.loads(DOCUMENTS.read_text(encoding="utf-8"))
        sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read document manifest or source register: {exc}")
        return 1
    report = audit_documents(documents, sources)
    print(json.dumps(report, indent=2, ensure_ascii=False) if args.json else
          f"Verified official paper documents: {report['documents_checked']}\n"
          f"Unique document IDs: {report['unique_ids']}\n"
          f"Categories: {report['by_category']}\n"
          f"Structural/provenance errors: {len(report['errors'])}")
    for error in report["errors"]:
        print("ERROR:", error)
    if not report["errors"]:
        print("PASS: document metadata has unique IDs, official-host URLs and verification evidence")
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
