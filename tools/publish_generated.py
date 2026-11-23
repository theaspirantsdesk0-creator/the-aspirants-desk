#!/usr/bin/env python3
"""Merge and publish generated JSON safely when scheduled jobs race with main."""
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


def merge_json(remote, local, path):
    if isinstance(remote, dict) and isinstance(local, dict):
        result = copy.deepcopy(remote)
        for key, value in local.items():
            if key == "items" and isinstance(value, list) and isinstance(result.get(key), list):
                result[key] = merge_json(result[key], value, path)
            elif key == "updated" and result.get(key):
                result[key] = max(str(result[key]), str(value))
            elif value not in (None, "", [], {}):
                result[key] = value
        return result

    if not isinstance(remote, list) or not isinstance(local, list):
        return copy.deepcopy(local)

    merged, anonymous = {}, []
    for item in remote + local:
        if not isinstance(item, dict):
            anonymous.append(item)
            continue
        key = item.get("link") or item.get("l") or item.get("url") or item.get("id")
        if not key:
            anonymous.append(item)
            continue
        current = copy.deepcopy(merged.get(key, {}))
        for field, value in item.items():
            if value not in (None, "", [], {}):
                current[field] = value
        merged[key] = current

    values = list(merged.values()) + anonymous
    values.sort(
        key=lambda x: str(x.get("date", x.get("d", ""))) if isinstance(x, dict) else "",
        reverse=True,
    )
    return values[:(300 if "pib" in path.lower() else 1000)]


def main(paths):
    if not paths:
        raise SystemExit("Pass at least one generated JSON path.")

    with tempfile.TemporaryDirectory(prefix="desk-publish-") as temp_dir:
        temp = Path(temp_dir)
        snapshots = {}
        for name in paths:
            source = ROOT / name
            if not source.is_file():
                raise SystemExit(f"Generated file not found: {name}")
            snapshot = temp / name
            snapshot.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, snapshot)
            snapshots[name] = snapshot

        for attempt in range(1, MAX_ATTEMPTS + 1):
            git("fetch", "origin", "main")
            git("reset", "--hard", "origin/main")

            for name, snapshot in snapshots.items():
                target = ROOT / name
                local = json.loads(snapshot.read_text(encoding="utf-8"))
                remote = json.loads(target.read_text(encoding="utf-8")) if target.exists() else ([] if isinstance(local, list) else {})
                combined = merge_json(remote, local, name)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps(combined, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

            if "data/current-affairs.json" in paths:
                build = subprocess.run(
                    [sys.executable, "tools/desk.py", "build"], cwd=ROOT,
                    text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                )
                if build.returncode:
                    raise SystemExit(build.stdout)
                print(build.stdout.strip())

            git("add", *paths)
            if "data/current-affairs.json" in paths:
                git("add", "index.html")
            if git("diff", "--cached", "--quiet", check=False).returncode == 0:
                print("No generated content changes to publish.")
                return

            git("config", "user.name", "desk-bot")
            git("config", "user.email", "desk-bot@users.noreply.github.com")
            message = "Publish merged PIB update" if all("pib" in p.lower() for p in paths) else "Publish merged daily content update"
            commit = git("commit", "-m", message, check=False)
            if commit.returncode != 0:
                raise SystemExit(commit.stdout)
            pushed = git("push", "origin", "HEAD:main", check=False)
            if pushed.returncode == 0:
                print(f"Published {', '.join(paths)} on attempt {attempt}.")
                return
            print(f"Push attempt {attempt} failed; retrying against latest main.\n{pushed.stdout}")
            time.sleep(attempt)

    raise SystemExit(f"Could not publish after {MAX_ATTEMPTS} attempts.")


if __name__ == "__main__":
    main(sys.argv[1:])
