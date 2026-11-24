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
from sync_pyq_inventory import reconcile_inventory

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

    dashboard_js = ROOT / "assets" / "js" / "dashboard.js"
    dashboard_css = ROOT / "assets" / "css" / "design-system.css"
    if dashboard_js.is_file() and dashboard_css.is_file() and index.is_file():
        dashboard_source = dashboard_js.read_text(encoding="utf-8")
        dashboard_style = dashboard_css.read_text(encoding="utf-8")
        dashboard_html = index.read_text(encoding="utf-8")
        for element_id in ("learnerCommandTitle", "homeStudyHours", "homeSyllabusProgress",
                           "homeLatestScore", "homeLearningProgress", "homeVerifiedDocsStatus"):
            check(f'id="{element_id}"' in dashboard_html,
                  f"Learner dashboard element is missing: {element_id}")
        check("data/pyq/verified-documents.json" in dashboard_source,
              "Learner dashboard must load the verified document count from the published manifest")
        check(".learner-command-panel" in dashboard_style,
              "Learner dashboard responsive styles are missing")

    # Course discovery and starter-course content must remain valid and searchable.
    course_js = ROOT / "assets" / "js" / "courses.js"
    course_css = ROOT / "assets" / "css" / "courses.css"
    if course_js.is_file() and course_css.is_file() and index.is_file():
        course_source = course_js.read_text(encoding="utf-8")
        course_style = course_css.read_text(encoding="utf-8")
        course_html = index.read_text(encoding="utf-8")
        for control in ("courseSearch", "courseCategoryFilter", "courseStatusFilter", "courseResultCount"):
            check(f'id="{control}"' in course_html,
                  f"Course discovery control is missing from index.html: {control}")
        for feature in ("digital-information-literacy", "responsible-ai-literacy"):
            check(f'id:"{feature}"' in course_source,
                  f"Universal starter course is missing: {feature}")
        check("categoryFilter" in course_source and "statusFilter" in course_source,
              "Course catalogue must apply category and progress filters")
        check(".course-discovery-toolbar" in course_style,
              "Course discovery toolbar styles are missing")
        check('id="pyqInventorySnapshot"' in course_html,
              "Official PYQ verification snapshot is missing")
        design_system_css = ROOT / "assets" / "css" / "design-system.css"
        design_system = design_system_css.read_text(encoding="utf-8") if design_system_css.is_file() else ""
        check("data/pyq/documents.json" in course_html and "pyq-inventory-snapshot" in design_system,
              "Official PYQ verification snapshot must load the paper inventory and use its design styles")

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
        # The mistake notebook prepends new entries, so Anbuu must read from
        # the start of the array rather than the oldest entries at the end.
        check("mistakeRows.slice(0, 12)" in source,
              "Anbuu must use the 12 newest saved mistakes for learner context")
        check('lessonHistoryResult' in source
              and 'SAVED GUIDED-LESSON HISTORY' in source
              and 'lessonHistory' in source,
              "Anbuu chat must use the authenticated learner's saved lesson history")
        check('body.lessonId' in source and 'resumedLesson' in source
              and '.eq("id", lessonId).eq("user_id", authData.user.id)' in source
              and 'CURRENT RESUMED LESSON' in source
              and 'no prior chat transcript' in source.lower(),
              "Anbuu resume must load only the authenticated learner's saved lesson metadata and disclose transcript limits")
        if ai_js.is_file():
            resume_ui = ai_js.read_text(encoding="utf-8")
            check('sendMessage(message,lessonId=null)' in resume_ui
                  and 'lesson.id));' in resume_ui
                  and 'history:lessonId?[]:history' in resume_ui,
                  "Resuming a lesson must send its saved ID and start a clean lesson-specific chat context")
        check('lessonActiveResult' in source and 'activeLessonResult' in source
              and '.in("status", ["in_progress", "paused"])' in source
              and 'prioritisedLessons' in source
              and 'findIndex(candidate => candidate.id === lesson.id)' in source,
              "Anbuu must prioritise active and paused lessons even when newer completed lessons fill the recent-history window")
        if ai_js.is_file():
            check('tadAiNextSteps' in ai_js.read_text(encoding="utf-8")
                  and 'renderNextSteps' in ai_js.read_text(encoding="utf-8")
                  and 'Ask Anbuu' in ai_js.read_text(encoding="utf-8"),
                  "Anbuu must show actionable, lesson-aware next-step recommendations")
        check('body.action === "get_lessons"' in source and 'body.action === "start_lesson"' in source
              and 'body.action === "update_lesson"' in source,
              "Anbuu persistent lesson history actions are missing")
        check('complete_anbuu_lesson_and_queue_revision' in source
              and 'p_user_id: authData.user.id' in source
              and 'mentorState' in source,
              "Anbuu lesson completion must queue a learner-scoped revision task transactionally")
        completion_migration = ROOT / "supabase/migrations/20261124031000_anbuu_lesson_completion_revision_task.sql"
        check(completion_migration.is_file(), "Anbuu lesson completion revision-task migration is missing")
        if completion_migration.is_file():
            completion_sql = completion_migration.read_text(encoding="utf-8").lower()
            check("security invoker" in completion_sql
                  and "for update" in completion_sql
                  and "lesson-review-" in completion_sql
                  and "grant execute" in completion_sql
                  and "to service_role" in completion_sql
                  and "revoke all on function" in completion_sql,
                  "Anbuu completion task function must be atomic, idempotent and service-role-only")
        check('lessonCompletedResult.count' in source and 'lessonInProgressResult.count' in source
              and 'lessonPausedResult.count' in source and 'lessonRecentResult.data' in source,
              "Anbuu progress report must include user-scoped guided-lesson counts and recent lessons")
        check('eq("user_id", authData.user.id)' in source,
              "Anbuu lesson history queries must be scoped to the authenticated learner")
        lesson_migration = ROOT / "supabase/migrations/20261124024026_anbuu_lesson_history.sql"
        check(lesson_migration.is_file(), "Anbuu lesson history migration file is missing")
        if lesson_migration.is_file():
            migration_sql = lesson_migration.read_text(encoding="utf-8").lower()
            check("enable row level security" in migration_sql
                  and "revoke all on table public.anbuu_lesson_history from public, anon, authenticated" in migration_sql
                  and "grant all on table public.anbuu_lesson_history to service_role" in migration_sql,
                  "Anbuu lesson history must remain service-role-only behind its authenticated Edge Function")
            policy_migration = ROOT / "supabase/migrations/20261124024203_anbuu_lesson_history_service_role_policy.sql"
            check(policy_migration.is_file(), "Anbuu lesson history service-role policy migration is missing")
            if policy_migration.is_file():
                policy_sql = policy_migration.read_text(encoding="utf-8").lower()
                check("for all" in policy_sql and "to service_role" in policy_sql
                      and "using (true)" in policy_sql and "with check (true)" in policy_sql,
                      "Anbuu lesson history RLS policy must grant rows only to service_role")
        if ai_js.is_file():
            lesson_ui = ai_js.read_text(encoding="utf-8")
            check(('id="tadLessonHistoryList"' in lesson_ui or "id='tadLessonHistoryList'" in lesson_ui)
                  and ('id="tadRefreshLessons"' in lesson_ui or "id='tadRefreshLessons'" in lesson_ui)
                  and 'action:"update_lesson"' in lesson_ui
                  and ('id="tadAiLessons"' in lesson_ui or 'id=\\"tadAiLessons\\"' in lesson_ui or "id='tadAiLessons'" in lesson_ui)
                  and 'tad-ai-lesson-stats' in lesson_ui
                  and 'Complete + add revision task' in lesson_ui
                  and 'tadAiLessonRevisionTasks' in lesson_ui
                  and 'renderRevisionTasks' in lesson_ui,
                  "Anbuu learner lesson history and dashboard progress summary are missing")
        app_source = index.read_text(encoding="utf-8") if index.is_file() else ""
        if ai_js.is_file():
            revision_ui = ai_js.read_text(encoding="utf-8")
            check('function revisionIntervalDays(topic)' in revision_ui
                  and 'if(misses>=4)return 0' in revision_ui
                  and 'if(misses===3)return 1' in revision_ui
                  and 'if(misses===2)return 3' in revision_ui
                  and 'return 7' in revision_ui
                  and 'revisionDueDate(topic)' in revision_ui
                  and 'based on miss count' in revision_ui,
                  "Anbuu revision dates must use recorded mistake frequency and show explicit due dates")
        if ai_js.is_file():
            check('function renderRevisionTasks(tasks)' in revision_ui
                  and 'Overdue' in revision_ui
                  and 'postpone.addEventListener' in revision_ui
                  and 'task(item.id,"pending",dueDate)' in revision_ui
                  and 'review_count' in revision_ui and 'snooze_count' in revision_ui
                  and 'rating.value' in revision_ui and 'Again · 1d' in revision_ui
                  and 'Easy · 7d' in revision_ui,
                  "Anbuu revision queue must show overdue status, allow postponement and capture confidence ratings")
        edge_file = ROOT / "supabase" / "functions" / "ai-assistant" / "index.ts"
        if edge_file.is_file():
            edge_source = edge_file.read_text(encoding="utf-8")
            check('task.snooze_count = (task.snooze_count || 0) + 1' in edge_source
                  and 'task.review_count = (task.review_count || 0) + 1' in edge_source
                  and 'Choose a valid review date today or later.' in edge_source
                  and 'previousTasks = new Map(mentorState.pending_tasks.map(task => [task.id, task]))' in edge_source
                  and 'const intervals: Record<string, number> = { again: 1, hard: 2, good: 4, easy: 7 }' in edge_source
                  and 'task.last_review_result = result' in edge_source
                  and 'task.due_date = nextDate.toISOString().slice(0, 10)' in edge_source
                  and 'const tasks: Array<{id:string;title:string;description:string;due_date:string;status:"pending"|"completed";review_count:number;snooze_count:number;last_reviewed_at:string;last_snoozed_at:string;completed_at:string;last_review_result:string}> = [];' in edge_source,
                  "Anbuu backend must validate due dates, persist review outcomes and preserve metadata across AI state updates")
        check("state.mistakes.unshift(" in app_source,
              "Mistake notebook must prepend new entries so newest-first ordering remains valid")

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
    # Paper-level inventory: all target years and optional subjects must have an
    # explicit status. A candidate link is never treated as verified by default.
    document_inventory = json.loads((ROOT / "data/pyq/documents.json").read_text(encoding="utf-8"))
    inventory_rows = document_inventory.get("documents", [])
    expected_inventory_count = 25 * (7 + 2 * len(coverage_data.get("optional_subjects", [])))
    inventory_ids = [row.get("id") for row in inventory_rows if isinstance(row, dict)]
    check(len(inventory_rows) == expected_inventory_count,
          "Official PYQ document inventory must cover 2001-2025 for seven core papers and both papers for every optional subject")
    check(len(inventory_ids) == len(set(inventory_ids)),
          "Official PYQ document inventory IDs must be unique")
    check(all(row.get("status") in {"not_checked", "source_found", "verified", "published"}
              for row in inventory_rows if isinstance(row, dict)),
          "Every PYQ inventory row must use a supported verification status")
    check(all(row.get("document_url") is None or
              (isinstance(row.get("document_url"), str) and row["document_url"].startswith("https://")
               and row.get("status") in {"verified", "published"})
              for row in inventory_rows if isinstance(row, dict)),
          "Direct official PDF URLs may only appear on verified or published inventory rows")
    check(all(row.get("document_url") and row.get("document_title")
              and row.get("verified_at") and row.get("verification_method")
              for row in inventory_rows if isinstance(row, dict) and row.get("status") in {"verified", "published"}),
          "Verified and published inventory rows must include the document URL, title, date, and verification method")
    check(len(document_inventory.get("official_indexes", [])) >= 2,
          "PYQ document inventory must retain both current and archived official UPSC indexes")
    report = build_coverage_report(pyq_records, coverage_data)
    check(report["verified_published_question_records"] == len(pyq_records),
          "PYQ coverage report must count only verified published records")
    check(all(not item["completeness_claim"] for item in report["paper_targets"]),
          "PYQ coverage report must not claim paper completeness from record counts")
    check(all(len(item["yearly_coverage"]) == 25 for item in report["paper_targets"]),
          "PYQ coverage must expose one status row for each year from 2001 to 2025")
    optional_rows = coverage_data.get("optional_subjects", [])
    check(len(optional_rows) == 48, "PYQ coverage catalog must include 25 optional subjects and 23 literature options")
    check({row.get("name") for row in optional_rows} >= {"Anthropology", "Tamil", "English"},
          "PYQ optional catalog must include Anthropology and literature options")
    check(report["optional_subjects_in_scope"] == 48,
          "PYQ report must produce a separate coverage block for every optional and literature subject")
    check(all(len(subject["paper_targets"]) == 2
              and all(len(paper["yearly_coverage"]) == 25 for paper in subject["paper_targets"])
              for subject in report["optional_subject_coverage"]),
          "Every optional subject must expose Paper I and Paper II coverage for all 25 years")
    sample_optional = [{
        "id": "test-anthropology-2025-1", "exam": "Civil Services Examination",
        "stage": "Mains", "paper": "Optional Paper I", "optional_subject": "Anthropology",
        "year": 2025, "question_number": 1,
        "question": "A sufficiently long sample optional-subject question.",
        "status": "published", "source": {"id": "upsc-question-paper-archive",
        "document_url": "https://www.upsc.gov.in/example-paper.pdf"},
        "verification": {"status": "verified", "verified_at": "2026-11-24", "method": "manual PDF comparison"}
    }]
    optional_report = build_coverage_report(sample_optional, coverage_data)
    anthropology = next(item for item in optional_report["optional_subject_coverage"]
                        if item["subject"] == "Anthropology")
    anthropology_paper_one = next(item for item in anthropology["paper_targets"]
                                  if item["paper"] == "Optional Paper I")
    check(anthropology_paper_one["years_with_verified_records"] == 1
          and anthropology_paper_one["years_without_verified_records"] == 24,
          "Anthropology Paper I coverage must count only its matching year and paper")
    sample_pyq = [{
        "id": "test-pyq-coverage-2025-1", "exam": "Civil Services Examination",
        "stage": "Prelims", "paper": "General Studies Paper I", "year": 2025,
        "question_number": 1, "question": "A sufficiently long sample question for testing.",
        "status": "published", "source": {"id": "upsc-question-paper-archive",
        "document_url": "https://www.upsc.gov.in/example-paper.pdf"},
        "verification": {"status": "verified", "verified_at": "2026-11-24", "method": "manual PDF comparison"}
    }]
    sample_report = build_coverage_report(sample_pyq, coverage_data)
    sample_target = next(item for item in sample_report["paper_targets"]
                         if item["stage"] == "Prelims" and item["paper"] == "General Studies Paper I")
    check(sample_target["years_with_verified_records"] == 1
          and sample_target["years_without_verified_records"] == 24,
          "PYQ coverage must count the sample year and retain all 24 uncovered years")
    check(sample_target["yearly_coverage"][-1]["year"] == 2025
          and sample_target["yearly_coverage"][-1]["verified_question_records"] == 1,
          "PYQ yearly matrix must assign records to the correct paper and year")

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
    check('id="optionalPyqCoverageSubject"' in html and 'id="optionalPyqCoverageGrid"' in html,
          "The live PYQ interface must expose the all-subject optional coverage explorer")
    check('data/pyq/coverage.json' in html and "catalogSubjects" in html,
          "PYQ subject filters must load the full subject catalog, not only subjects present in published records")
    check('Optional Paper I' in html and 'Optional Paper II' in html,
          "The optional coverage explorer must expose both papers for every catalog subject")
    check('yearsInScope' in html and 'No verified records published yet' in html,
          "The optional coverage explorer must show year-by-year status without implying missing papers were never conducted")
    check(len(coverage.get("optional_subjects", [])) == 48,
          "The site catalog must expose all 25 optional subjects and 23 literature choices")
    check("archived-exam-documents/question-papers" in html,
          "Official PYQ section must link to the UPSC archived paper index")
    check('id="verifiedPyqDocuments"' in html and 'data/pyq/verified-documents.json' in html,
          "The PYQ section must render individually verified official document links")
    verified_docs = json.loads((ROOT / "data/pyq/verified-documents.json").read_text(encoding="utf-8"))
    verified_rows = verified_docs.get("documents", [])
    check(len(verified_rows) >= 1, "At least one official UPSC PDF must be individually verified")
    check(all(row.get("status") == "verified"
              and row.get("document_url", "").startswith("https://")
              and "upsc.gov.in/" in row.get("document_url", "")
              and row.get("verification", {}).get("verified_at")
              and row.get("verification", {}).get("method")
              for row in verified_rows),
          "Every displayed official PDF must have an UPSC URL and verification metadata")
    check(len({row.get("id") for row in verified_rows}) == len(verified_rows),
          "Verified official document IDs must be unique")

    # Every curated verified PDF must reconcile to exactly one matching paper-level
    # inventory row; candidate/source-found links must never be promoted.
    try:
        reconciled_inventory, reconciled_count = reconcile_inventory(
            json.loads(json.dumps(document_inventory)), verified_rows
        )
        check(reconciled_count == len(verified_rows),
              "Every verified UPSC PDF must map to exactly one inventory row")
        check(reconciled_inventory["inventory_summary"]["verified_entries"] ==
              len(verified_rows),
              "Inventory summary must count all verified and published rows")
        verified_keys = {
            (row.get("year"), row.get("stage"), row.get("paper"),
             row.get("optional_subject") or "")
            for row in reconciled_inventory["documents"]
            if row.get("status") in {"verified", "published"}
        }
        expected_keys = {
            (row.get("year"), row.get("stage"),
             (f"General Studies {row.get('paper')}" if row.get("category") == "General Studies"
              else row.get("paper") if row.get("category") == "General"
              else f"Optional {row.get('paper')}"),
             row.get("subject") if row.get("category") in {"Optional", "Literature"} else "")
            for row in verified_rows
        }
        check(expected_keys <= verified_keys,
              "Verified document metadata must appear in the matching inventory rows")
    except (ValueError, KeyError, TypeError) as exc:
        check(False, f"Verified PYQ inventory reconciliation failed: {exc}")

    try:
        reconcile_inventory(
            json.loads(json.dumps(document_inventory)),
            [{"id": "candidate", "status": "source_found"}],
        )
        check(False, "PYQ inventory reconciliation must reject unverified candidate links")
    except ValueError:
        check(True, "PYQ inventory reconciliation rejects unverified candidates")

    # Push reminders should prioritise due Anbuu revision tasks, even if study activity
    # has already been logged for the day, while preserving the existing inactivity reminder.
    reminder_file = ROOT / "supabase" / "functions" / "send-study-reminders" / "index.ts"
    if reminder_file.is_file():
        reminder_source = reminder_file.read_text(encoding="utf-8")
        check("function dueRevisionCounts(" in reminder_source
              and 'item.status !== "pending"' in reminder_source
              and 'dueDate <= date' in reminder_source
              and 'dueDate < date' in reminder_source,
              "Push reminder logic must count only valid pending revision tasks due today or overdue")
        check(r"/^\d{4}-\d{2}-\d{2}$/" in reminder_source
              and r"/^\\d{4}-\\d{2}-\\d{2}$/" not in reminder_source,
              "Revision due-date validation must use digit classes, not literal backslashes")
        check('from("anbuu_mentor_state")' in reminder_source
              and 'title: "Anbuu revision reminder"' in reminder_source
              and 'tag: "desk-revision-reminder"' in reminder_source
              and 'url: "./#anbuu"' in reminder_source,
              "Push reminders must read learner-owned Anbuu tasks and link revision alerts to Anbuu")
        check("if (revisions.due > 0)" in reminder_source
              and 'title: "Time to study"' in reminder_source,
              "Due revision alerts must take priority while preserving the existing daily study reminder")

    # Anbuu is dynamically injected with a styling ID different from its navigation route.
    # Keep the route alias explicit so selecting Anbuu does not hide every view.
    check('const viewId = clean === "anbuu" ? "tadAiPanel" : clean;' in html
          and 's.id === viewId' in html,
          "Anbuu navigation must activate its injected view without breaking other sections")
    check('$("menuToggle").addEventListener("click"' in html
          and '$("sidebarScrim").addEventListener("click"' in html,
          "Mobile navigation must expose and close the complete sidebar")
    ai_script = ROOT / "assets" / "js" / "ai-desk.js"
    ai_source = ai_script.read_text(encoding="utf-8") if ai_script.is_file() else ""
    check('document.addEventListener("click", (e) => {' in html
          and 'e.target.closest("[data-nav]")' in html,
          "Navigation must use delegation for dynamically injected module links")
    check('tad-anbuu-shortcuts' in ai_source
          and all(f'data-nav={chr(92)}"{route}{chr(92)}"' in ai_source for route in
                  ("home", "today", "notes", "pyq", "planner", "tracker")),
          "Anbuu must provide working shortcuts back to the main study sections")
    # The service worker must not keep old JavaScript or CSS after a site deployment.
    sw_file = ROOT / "sw.js"
    if sw_file.is_file():
        sw_source = sw_file.read_text(encoding="utf-8")
        check("desk-v6-fresh-assets" in sw_source and "(?:js|css)" in sw_source,
              "Service worker must version its cache and refresh scripts/styles while online")
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
