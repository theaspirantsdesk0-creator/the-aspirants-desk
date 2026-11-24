#!/usr/bin/env python3
"""Reconcile the paper-level inventory with individually verified UPSC PDFs."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data" / "pyq" / "documents.json"
VERIFIED = ROOT / "data" / "pyq" / "verified-documents.json"


def inventory_key(row: dict) -> tuple:
    return (row.get("year"), row.get("stage"), row.get("paper"), row.get("optional_subject") or "")


def verified_key(row: dict) -> tuple:
    category = row.get("category")
    if category == "General Studies":
        paper, subject = f"General Studies {row.get('paper')}", ""
    elif category == "General":
        paper, subject = row.get("paper"), ""
    elif category in {"Optional", "Literature"}:
        paper, subject = f"Optional {row.get('paper')}", row.get("subject") or ""
    else:
        raise ValueError(f"Unsupported verified document category: {category!r}")
    return (row.get("year"), row.get("stage"), paper, subject)


def reconcile_inventory(inventory: dict, verified_documents: list[dict]) -> tuple[dict, int]:
    """Apply only already-verified PDF metadata; never promote candidate links."""
    if not isinstance(inventory, dict) or not isinstance(inventory.get("documents"), list):
        raise ValueError("Inventory must contain a documents array")
    if not isinstance(verified_documents, list):
        raise ValueError("Verified documents must be an array")

    rows = inventory["documents"]
    index: dict[tuple, list[dict]] = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Inventory contains a non-object row")
        index.setdefault(inventory_key(row), []).append(row)

    seen_ids = set()
    updated = 0
    for doc in verified_documents:
        if not isinstance(doc, dict) or doc.get("status") != "verified":
            raise ValueError("Only explicitly verified document records may be synchronized")
        for field in ("id", "year", "stage", "subject", "paper", "title", "document_url"):
            if not doc.get(field):
                raise ValueError(f"Verified document is missing {field}")
        verification = doc.get("verification")
        if not isinstance(verification, dict) or not verification.get("verified_at") or not verification.get("method"):
            raise ValueError(f"{doc['id']} is missing verification evidence")
        if doc["id"] in seen_ids:
            raise ValueError(f"Duplicate verified document ID: {doc['id']}")
        seen_ids.add(doc["id"])

        matches = index.get(verified_key(doc), [])
        if len(matches) != 1:
            raise ValueError(f"{doc['id']} must match exactly one inventory row; found {len(matches)}")
        row = matches[0]
        existing_url = row.get("document_url")
        if existing_url and existing_url != doc["document_url"]:
            raise ValueError(f"Conflicting document URL for inventory row {row.get('id')}")
        if row.get("status") == "published":
            if existing_url != doc["document_url"]:
                raise ValueError(f"Published row {row.get('id')} cannot be replaced")
            continue
        row.update({
            "status": "verified",
            "document_url": doc["document_url"],
            "document_title": doc["title"],
            "verified_at": verification["verified_at"],
            "verification_method": verification["method"],
        })
        updated += 1

    summary = inventory.setdefault("inventory_summary", {})
    summary["verified_entries"] = sum(row.get("status") in {"verified", "published"} for row in rows)
    summary["published_entries"] = sum(row.get("status") == "published" for row in rows)
    return inventory, updated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write reconciled inventory; otherwise report only")
    args = parser.parse_args()
    try:
        inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
        verified = json.loads(VERIFIED.read_text(encoding="utf-8"))
        result, changed = reconcile_inventory(inventory, verified.get("documents", []))
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 1
    print(f"Verified PDFs matched to inventory: {len(verified.get('documents', []))}")
    print(f"Inventory rows updated: {changed}")
    print(f"Verified inventory total: {result['inventory_summary']['verified_entries']}")
    if args.write:
        INVENTORY.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("Wrote data/pyq/documents.json")
    else:
        print("Dry run only. Re-run with --write to save changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
