#!/usr/bin/env python3
"""Publish generated JSON safely when scheduled jobs race with other main-branch writers.

Usage: python tools/publish_generated.py data/current-affairs.json
       python tools/publish_generated.py data/pib.json
"""
import copy
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_ATTEMPTS = 5


def git(*args, check=True):
    return subprocess.run(
        ["git", *args], cwd=ROOT, check=check, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )


def merge_items(remote, local, path):
    """Merge JSON arrays by canonical source URL, retaining non-empty values."""
    if isinstance(remote, dict) and isinstance(local, dict):
        result = copy.deepcopy(remote)
        for key, value in local.items():
            if key == "items" and isinstance(value, list) and isinstance(result.get(key), list):
                result[key] = merge_items(result[key], value, path)
            elif key == "updated" and result.get(key):
                result[key] = max(str(result[key]), str(value))
            elif value not in (None, "", [], {}):
                result[key] = value
        return result

    if not isinstance(remote, list) or not isinstance(local, list):
        return copy.deepcopy(local)

    merged = {}
    anonymous = []
    for item in remote + local:
        if not isinstance(item, dict):
            anonymous.append(item)
            continue
        key = item.get("link") or item.get("l") or item.get("url") or item.get("id")
        if not key:
            anonymous.append(item)
            continue
        if key not in merged:
            merged[key] = copy.deepcopy(item)
        else:
            combined = copy.deepcopy(merged[key])
            for field, value in item.items():
                if value not in (None, "", [], {}):
                    combined[field] = value
            merged[key] = combined

    values = list(merged.values()) + anonymous
    values.sort(key=lambda x: str(x.get("date", x.get("d", ""))) if isinstance(x, dict) else "", reverse=True)
    limit = 300 if "pib" in path.lower() else 1000
    return values[:limit]


def main(paths):
    if not paths:
        raise SystemExit("Pass at least one generated JSON path.")
    snapshots = {}
    with tempfile.TemporaryDirectory(prefix="desk-publish-") as temp:
        temp = Path(temp)
        for name in paths:
            source = ROOT / name
            if not source.is_file():
                raise SystemExit(f"Generated file not found: {name}")
            target = temp / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            snapshots[name] = target

        for attempt in range(1, MAX_ATTEMPTS + 1):
            git("fetch", "origin", "main")
            git("reset", "--hard", "origin/main")

            changed = []
            for name, snapshot in snapshots.items():
                target = ROOT / name
                local = json.loads(snapshot.read_text(encoding="utf-8"))
                remote = json.loads(target.read_text(encoding="utf-8")) if target.exists() else ([] if isinstance(local, list) else {})
                combined = merge_items(remote, local, name)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps(combined, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
                changed.append(name)

            # The site's embedded question bank must be rebuilt from the latest
            # committed question files after resetting to the latest main.
            if "data/current-affairs.json" in changed:
                git("add", *changed)
                git("add", "index.html")
                git("commit", "-m", "Publish merged current-affairs update", check=False)
            else:
                git("add", *changed)
                git("commit", "-m", "Publish merged PIB update", check=False)

            if git("diff", "--cached", "--quiet", check=False).returncode == 0:
                # The commit may already have been created; inspect HEAD delta.
                parent = git("rev-parse", "HEAD^", check=False)
                head = git("rev-parse", "HEAD", check=False)
                if parent.returncode == 0 and head.returncode == 0 and parent.stdout.strip() != head.stdout.strip():
                    pass
                else:
                    print("No generated content changes to publish.")
                    return

            if "data/current-affairs.json" in changed:
                # Rebuild index after merged JSON and latest main have been applied.
                build = subprocess.run(
                    [sys.executable, "tools/desk.py", "build"], cwd=ROOT,
                    text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                )
                if build.returncode:
                    raise SystemExit(build.stdout)

            # Stage any rebuilt files and amend the just-created commit if needed.
            git("add", *changed)
            if "data/current-affairs.json" in changed:
                git("add", "index.html")
            git("commit", "--amend", "--no-edit", check=False)

            pushed = git("push", "origin", "HEAD:main", check=False)
            if pushed.returncode == 0:
                print(f"Published {', '.join(changed)} on attempt {attempt}.")
                return
            print(f"Push attempt {attempt} failed; retrying against latest main.\n{pushed.stdout}")
            time.sleep(attempt)

        raise SystemExit(f"Could not publish after {MAX_ATTEMPTS} attempts.")


if __name__ == "__main__":
    main(sys.argv[1:])
