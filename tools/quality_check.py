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
from urllib.parse import urlparse
from publish_generated import merge_json
from upsc_angles import fallback_upsc_angle
from pyq import validate_records, build_coverage_report
from question_bank_audit import audit_question_bank
from sync_pyq_inventory import reconcile_inventory
from audit_pyq_documents import audit_documents

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
CHECKS = 0


def check(condition: bool, message: str) -> None:
    global CHECKS
    CHECKS += 1
    if not condition:
        ERRORS.append(message)

def is_official_upsc_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
        return parsed.scheme == "https" and parsed.hostname in {"upsc.gov.in", "www.upsc.gov.in"}
    except (TypeError, ValueError):
        return False


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


    # PWA offline shell: core learner scripts/styles must be precached and syntax-valid.
    sw_path = ROOT / "sw.js"
    offline_path = ROOT / "offline.html"
    manifest_path = ROOT / "manifest.webmanifest"
    check(sw_path.is_file(), "Service worker is missing")
    check(offline_path.is_file(), "Offline fallback page is missing")
    check(manifest_path.is_file(), "PWA manifest is missing")
    if sw_path.is_file():
        sw_source = sw_path.read_text(encoding="utf-8")
        run_node_check(sw_source, "sw.js")
        required_assets = (
            "index.html", "offline.html", "manifest.webmanifest",
            "assets/css/ai-desk.css", "assets/css/design-system.css",
            "assets/js/ai-desk.js", "assets/js/owner-learner-workspaces.js", "assets/js/learning-hub.js",
            "assets/js/pyq-inventory.js", "assets/js/courses.js"
        )
        for asset in required_assets:
            check("'" + asset + "'" in sw_source or '"'+asset+'"' in sw_source,
                  f"Service worker does not precache required app asset: {asset}")
        check("caches.match('offline.html')" in sw_source,
              "Service worker navigation fallback must show the offline page when the app shell is unavailable")
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            check(manifest.get("start_url") == "./", "PWA start_url must remain relative to the GitHub Pages project path")
            check(manifest.get("scope") == "./", "PWA scope must remain relative to the GitHub Pages project path")
            check(manifest.get("display") == "standalone", "PWA display mode should remain standalone")
        except (OSError, json.JSONDecodeError) as exc:
            check(False, f"PWA manifest is invalid JSON: {exc}")
    if offline_path.is_file():
        offline_html = offline_path.read_text(encoding="utf-8")
        check("Try again" in offline_html and "You're offline" in offline_html,
              "Offline fallback must explain the connection state and offer retry")

    # Optional subject onboarding and syllabus workspace must stay wired to the app.
    optional_js = ROOT / "assets" / "js" / "optional-prep.js"
    optional_css = ROOT / "assets" / "css" / "optional-prep.css"
    optional_data = ROOT / "data" / "upsc" / "optional-syllabus.json"
    check(optional_js.is_file(), "Optional subject onboarding module is missing")
    check(optional_css.is_file(), "Optional subject workspace styles are missing")
    check(optional_data.is_file(), "Official optional syllabus catalogue is missing")
    if optional_js.is_file():
        run_node_check(optional_js.read_text(encoding="utf-8"), "assets/js/optional-prep.js")
    if optional_data.is_file():
        try:
            optional_payload = json.loads(optional_data.read_text(encoding="utf-8"))
            check(len(optional_payload.get("subjects", [])) == 48,
                  "Optional catalogue must include the 25 subjects and 23 literature choices")
            anthro_units = optional_payload.get("anthropology", [])
            check(len(anthro_units) >= 14,
                  "Anthropology syllabus map must include both papers and all major units")
            check({unit.get("paper") for unit in anthro_units} == {"I", "II"},
                  "Anthropology syllabus map must cover Paper I and Paper II")
            check(all(unit.get("topics") and unit.get("notes") and unit.get("test") for unit in anthro_units),
                  "Each published Anthropology unit must include topics, notes and a self-test")
            guided_units = [unit for unit in anthro_units if unit.get("lesson")]
            check(len(guided_units) == len(anthro_units), "Every mapped Anthropology unit must include a guided teacher-led lesson")
            check(all(unit["lesson"].get("sections") and unit["lesson"].get("keyTerms") and unit["lesson"].get("answerPractice") for unit in guided_units),
                  "Guided Anthropology lessons must include sections, key terms and Mains answer practice")
            check(all(
                all(isinstance(section.get("heading"), str) and section.get("heading")
                    and isinstance(section.get("explanation"), list) and section.get("explanation")
                    for section in unit["lesson"].get("sections", []))
                for unit in guided_units
            ), "Every guided Anthropology lesson section must have a heading and explanatory content")
            check(all(len(unit.get("test", [])) >= 10 for unit in anthro_units),
                  "Every Anthropology unit must provide at least ten topic-test questions")
            check(all(
                len({question.get("q", "").strip().casefold() for question in unit.get("test", [])})
                == len(unit.get("test", []))
                for unit in anthro_units
            ), "Anthropology unit tests must not contain duplicate question prompts")
            check(all(
                all(isinstance(question.get("q"), str) and question.get("q")
                    and isinstance(question.get("o"), list) and len(question.get("o", [])) == 4
                    and isinstance(question.get("a"), int) and 0 <= question.get("a", -1) < len(question.get("o", []))
                    and isinstance(question.get("w"), str) and question.get("w")
                    for question in unit.get("test", []))
                for unit in anthro_units
            ), "Every Anthropology self-test must have four valid options, an answer index and explanation")
        except (OSError, json.JSONDecodeError) as exc:
            check(False, f"Optional syllabus catalogue is invalid JSON: {exc}")
    if index.is_file():
        optional_html = index.read_text(encoding="utf-8")
        for required in ("optionalSetupModal", "optionalSetupForm", "optionalSyllabusWorkspace",
                         "tad:optionalPrepSave", "assets/js/optional-prep.js", "assets/js/owner-learner-workspaces.js"):
            check(required in optional_html, f"Optional subject onboarding is not wired: {required}")

        # Shared-device account isolation: private learner state must be reset
        # whenever a different account signs in or the active account signs out.
        for required in ("function resetUserScopedState()", "tad_active_user_id",
                         'localStorage.removeItem("tad.learningHub.v1")',
                         "resetUserScopedState();"):
            check(required in optional_html, f"Account privacy isolation is missing: {required}")

        check("function escapeMainsText(value)" in optional_html
              and "escapeMainsText(context)" in optional_html
              and "escapeMainsText(preview)" in optional_html,
              "Saved Mains drafts must escape learner-written content before HTML rendering")
        check('data-load-mains=' in optional_html and 'data-delete-mains=' in optional_html
              and "setMainsPrompt" in optional_html,
              "Saved Mains drafts must support loading and deleting drafts with their question context")
        check('window.addEventListener("tad:mainsPromptSelected"' in optional_html
              and 'id="mainsQuestionText"' in optional_html
              and "TAD_ACTIVE_MAINS_PROMPT" in optional_html,
              "Optional-subject answer practice must connect to the Mains writing pad")
        check('mainsSeconds <= 0' in optional_html
              and '"✓ Time Complete"' in optional_html
              and '$("mainsStartTimerBtn").disabled = true' in optional_html,
              "Mains timer must stop cleanly at zero and reset for a new answer mode")

    owner_workspace = ROOT / "assets" / "js" / "owner-learner-workspaces.js"
    check(owner_workspace.is_file(), "Owner learner workspace module is missing")
    if owner_workspace.is_file():
        owner_source = owner_workspace.read_text(encoding="utf-8")
        run_node_check(owner_source, "assets/js/owner-learner-workspaces.js")
        for required in ('context.profile.role !== "admin"', "panel.hidden = true",
                         'db.from("progress").select("user_id,summary,updated_at")',
                         "Private learner records are not available"):
            check(required in owner_source, f"Owner/learner access separation is missing: {required}")
        check('db.from("test_results").select("user_id,exam,test_name,score,max_score,correct_count,wrong_count,skipped_count,created_at")' in owner_source,
              "Owner workspace must read learner test history")
        check('db.from("pyq_attempts").select("user_id,question_id,selected_option,answer_text,is_correct,marks_awarded,feedback,attempted_at")' in owner_source,
              "Owner workspace must read learner paper attempts")
    if optional_js.is_file():
        optional_source = optional_js.read_text(encoding="utf-8")
        check("quizResults" in optional_source and 'from("test_results").insert' in optional_source,
              "Optional unit test results must be saved to the learner's private account history")
        check("submitButton.disabled=true" in optional_source
              and "could not be confirmed" in optional_source
              and "Attempt recorded in this browser only" in optional_source,
              "Optional unit tests must prevent duplicate submissions and report local/cloud save status accurately")
        check("Units studied" in optional_source and "Mark unit studied" in optional_source,
              "Optional workspace progress labels must match unit-level completion tracking")
        quiz_source = optional_source.split("function startQuiz", 1)[1].split("async function init", 1)[0]
        check("setInterval(updateTimer,1000)" in quiz_source
              and "form.requestSubmit()" in quiz_source
              and "skippedCount" in quiz_source
              and "const initialMinutes=Math.floor(durationSeconds/60)" in quiz_source
              and "questions.length+' questions" in quiz_source,
              "Optional topic tests must have a question-matched countdown, submit on timeout and count skipped answers")
        check('const resultHost=$("optionalQuizHost")' in quiz_source
              and 'resultHost.querySelector("#optionalQuizSaveStatus")' in quiz_source
              and quiz_source.index('window.dispatchEvent(new CustomEvent("tad:optionalPrepSave"')
                  < quiz_source.index('const resultHost=$("optionalQuizHost")'),
              "Quiz results must render safely after optional-preference sync rerenders the workspace")
        check('select("id,display_name,role,target_exam")' not in owner_source,
              "Owner workspace queries a target_exam profile column that does not exist")

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
        check('.from("pyq_questions")' in course_html
              and '.eq("is_published", true)' in course_html
              and '.eq("source_verified", true)' in course_html
              and "isOfficialUpscUrl(row.source_reference)" in course_html,
              "Live PYQ archive must expose only published, source-verified UPSC records")
        check('question_number' in course_html and "source_reference" in course_html,
              "Live PYQ records must retain paper question numbering and official source provenance")
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
            check(re.search(r"async function sendMessage\(message,lessonId=null(?:,evaluation=null)?\)", resume_ui) is not None
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
              and is_official_upsc_url(row.get("document_url", ""))
              and row.get("verification", {}).get("verified_at")
              and row.get("verification", {}).get("method")
              for row in verified_rows),
          "Every displayed official PDF must have an exact UPSC hostname and verification metadata")
    check(is_official_upsc_url("https://upsc.gov.in/paper.pdf")
          and is_official_upsc_url("https://www.upsc.gov.in/paper.pdf")
          and not is_official_upsc_url("https://evilupsc.gov.in/paper.pdf")
          and not is_official_upsc_url("https://upsc.gov.in.evil.example/paper.pdf")
          and not is_official_upsc_url("http://upsc.gov.in/paper.pdf"),
          "Official UPSC URL validation must reject lookalike hosts and non-HTTPS links")
    check("function isOfficialUpscUrl" in html and
          'host === "upsc.gov.in"' in html and 'host === "www.upsc.gov.in"' in html and
          "isOfficialUpscUrl(row.source.document_url)" in html and
          "isOfficialUpscUrl(doc.document_url)" in html,
          "The browser must validate exact UPSC hostnames before displaying official links")
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
              and 'item.status === "pending"' in reminder_source
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
    check('id="checkPushBtn"' in html and 'id="pushDiagnostics"' in html,
          "Push reminder card must expose a device diagnostics control and result area")
    check("async function runPushDiagnostics()" in html
          and '.eq("user_id", currentUser.id)' in html
          and '.eq("endpoint", subscription.endpoint)' in html,
          "Push diagnostics must inspect only the signed-in user’s current device subscription")
    check("This check does not send a notification." in html
          and "send-test-study-notification" in html,
          "Device diagnostics must remain separate from actual test-notification delivery")
    mentor_integrity = ROOT / "supabase" / "migrations" / "20261124100710_validate_mentor_assignment_and_review_links.sql"
    if mentor_integrity.is_file():
        mentor_sql = mentor_integrity.read_text(encoding="utf-8")
        check("security invoker" in mentor_sql.lower()
              and "Only the site owner can manage mentor assignments" in mentor_sql
              and "The selected account is not an approved mentor" in mentor_sql
              and "The selected account is not a learner" in mentor_sql,
              "Mentor assignments must be owner-managed and validate approved mentor/learner roles in the database")
        check("validate_mentor_review_assignment" in mentor_sql
              and "Review learner must match the selected assignment" in mentor_sql
              and "Only the assigned mentor or site owner can write this review" in mentor_sql,
              "Mentor reviews must be tied to the selected assignment and authenticated author")
        check("revoke all on function public.validate_mentor_assignment_roles() from public, anon, authenticated" in mentor_sql.lower()
              and "revoke all on function public.validate_mentor_review_assignment() from public, anon, authenticated" in mentor_sql.lower(),
              "Mentor integrity trigger functions must not be exposed as public RPC endpoints")

    # Mentor workspace regression checks: preserve database-enforced roles,
    # participant visibility, and review-to-assignment integrity.
    profile_security = ROOT / "supabase" / "migrations" / "20261123123703_owner_managed_mentor_workspace_and_role_security.sql"
    active_mentor_security = ROOT / "supabase" / "migrations" / "20261123123723_require_active_mentor_role_for_workspace_access.sql"
    profile_signup_security = ROOT / "supabase" / "migrations" / "20261121135933_harden_profiles_signup_and_rls.sql"
    check(profile_security.is_file(), "Owner-managed profile-role and mentor workspace migration is missing")
    check(active_mentor_security.is_file(), "Active mentor workspace access migration is missing")
    check(profile_signup_security.is_file(), "Profile signup and RLS baseline migration is missing")
    if profile_security.is_file():
        profile_sql = profile_security.read_text(encoding="utf-8").lower()
        check("private.guard_profile_role_changes()" in profile_sql
              and "new.role is distinct from old.role" in profile_sql
              and "not private.is_desk_admin()" in profile_sql
              and "revoke all on function private.guard_profile_role_changes() from public, anon, authenticated" in profile_sql,
              "Profile role changes must be guarded by a private owner-only trigger")
        check("create policy mentor_assignments_read_participants" in profile_sql
              and "mentor_id = (select auth.uid())" in profile_sql
              and "learner_id = (select auth.uid())" in profile_sql
              and "create policy mentor_assignments_owner_insert" in profile_sql
              and "created_by = (select auth.uid())" in profile_sql,
              "Mentor assignments must be participant-readable and owner-created only")
        check("create policy mentor_reviews_read_participants" in profile_sql
              and "visibility = 'shared'" in profile_sql
              and "create policy mentor_reviews_insert_assigned_mentor" in profile_sql
              and "create policy mentor_reviews_update_assigned_mentor" in profile_sql,
              "Learners must see only shared mentor feedback; mentors must be assignment-scoped")
        check("with check" in profile_sql[profile_sql.find("create policy mentor_reviews_update_assigned_mentor"):],
              "Mentor review updates must validate the resulting row as well as the original row")
    if active_mentor_security.is_file():
        active_sql = active_mentor_security.read_text(encoding="utf-8").lower()
        check("create or replace function private.is_desk_mentor()" in active_sql
              and "p.role = 'mentor'" in active_sql
              and "grant execute on function private.is_desk_mentor() to authenticated" in active_sql
              and "revoke all on function private.is_desk_mentor() from public, anon" in active_sql,
              "Mentor workspace access must require the database-verified mentor role")
        check("profiles_read_assigned_learners" in active_sql
              and "a.mentor_id = (select auth.uid())" in active_sql
              and "a.learner_id = profiles.id" in active_sql,
              "Mentors must only be able to read profiles of learners assigned to them")
    if profile_signup_security.is_file():
        signup_sql = profile_signup_security.read_text(encoding="utf-8").lower()
        check("grant update (display_name) on public.profiles to authenticated" in signup_sql,
              "Authenticated users must not receive a broad profile update grant")
        check("create policy profiles_update_self" in signup_sql
              and "with check (id = (select auth.uid()))" in signup_sql,
              "Profile self-update policy must prevent changing profile ownership")

    # The official paper-PDF catalogue must retain traceable provenance.
    pyq_docs_path = ROOT / "data" / "pyq" / "verified-documents.json"
    pyq_sources_path = ROOT / "data" / "pyq" / "sources.json"
    if pyq_docs_path.is_file() and pyq_sources_path.is_file():
        try:
            pyq_docs = json.loads(pyq_docs_path.read_text(encoding="utf-8"))
            pyq_sources = json.loads(pyq_sources_path.read_text(encoding="utf-8"))
            document_audit = audit_documents(pyq_docs, pyq_sources)
            check(not document_audit["errors"],
                  "Official PYQ document audit found provenance errors: " + "; ".join(document_audit["errors"][:5]))
            check(document_audit["documents_checked"] == document_audit["unique_ids"],
                  "Official PYQ document IDs must be unique")
            bad_host_fixture = {"documents": [{
                "id": "fixture", "exam": "Civil Services (Main) Examination",
                "year": 2025, "stage": "Mains", "subject": "Anthropology",
                "paper": "Paper I", "category": "Optional", "status": "verified",
                "title": "Fixture", "document_url": "https://example.invalid/paper.pdf",
                "verification": {"verified_at": "2026-11-24", "method": "test"}
            }]}
            bad_host_audit = audit_documents(bad_host_fixture, pyq_sources)
            check(any("registered official HTTPS host" in issue for issue in bad_host_audit["errors"]),
                  "Official PYQ document audit must reject unregistered document hosts")
        except (OSError, json.JSONDecodeError) as exc:
            check(False, f"Official PYQ document catalogue could not be parsed: {exc}")

    # Public PYQ publication must be backed by a verified, traceable source.
    pyq_publication_guard = ROOT / "supabase" / "migrations" / "20261124101838_require_verified_source_before_publishing_pyqs.sql"
    check(pyq_publication_guard.is_file(), "Verified-source PYQ publication guard migration is missing")
    if pyq_publication_guard.is_file():
        pyq_guard_sql = pyq_publication_guard.read_text(encoding="utf-8").lower()
        check("private.guard_pyq_publication()" in pyq_guard_sql
              and "new.is_published is true" in pyq_guard_sql
              and "new.source_verified is distinct from true" in pyq_guard_sql
              and "nullif(btrim(new.source_reference), '') is null" in pyq_guard_sql
              and "nullif(btrim(new.question_text), '') is null" in pyq_guard_sql,
              "Published PYQs must have non-empty question text and a verified source reference")
        check("security invoker" in pyq_guard_sql
              and "set search_path = pg_catalog, public, private" in pyq_guard_sql
              and "revoke all on function private.guard_pyq_publication() from public, anon, authenticated" in pyq_guard_sql,
              "PYQ publication guard must be a non-exposed invoker trigger function with a fixed search path")
        check("before insert or update of is_published, source_verified, source_reference, question_text" in pyq_guard_sql,
              "PYQ publication guard must cover inserts and changes to publication/source fields")

    # The service worker must not keep old JavaScript or CSS after a site deployment.
    sw_file = ROOT / "sw.js"
    if sw_file.is_file():
        sw_source = sw_file.read_text(encoding="utf-8")
        check(bool(re.search(r"var VERSION = ['\"]desk-v\d+[-\w]*['\"];", sw_source))
              and "(?:js|css)" in sw_source,
              "Service worker must version its cache and refresh scripts/styles while online")
    # Offline current-affairs notes must be cautious syllabus pointers, not invented facts.
    polity_angle = fallback_upsc_angle("Polity")
    check("GS Paper II" in polity_angle and "not a prediction" in polity_angle,
          "Polity fallback must be a cautious GS-II syllabus pointer")
    check(fallback_upsc_angle("General") == "",
          "Broadly classified news must not receive an unsupported generic UPSC angle")

    # Anthropology Mains question bank must remain a distinct practice resource, not official PYQs.
    anthro_mains_path = ROOT / "data" / "upsc" / "anthropology-mains-bank.json"
    mains_bank_script = ROOT / "assets" / "js" / "mains-bank.js"
    index_path = ROOT / "index.html"
    if anthro_mains_path.is_file():
        try:
            mains_bank = json.loads(anthro_mains_path.read_text(encoding="utf-8"))
            mains_questions = mains_bank.get("questions", [])
            check(len(mains_bank.get("units", [])) == 15 and len(mains_questions) == 30,
                  "Anthropology Mains bank must cover 15 units with 30 practice prompts")
            check(all(q.get("marks") in (10, 15)
                      and q.get("wordLimit") == (150 if q.get("marks") == 10 else 250)
                      and q.get("durationMinutes") == (7 if q.get("marks") == 10 else 11)
                      and q.get("prompt") and q.get("framework") and q.get("unit")
                      for q in mains_questions),
                  "Anthropology Mains prompts must include valid mark, word, time and framework metadata")
            check(len({q.get("id") for q in mains_questions}) == len(mains_questions),
                  "Anthropology Mains question IDs must be unique")
            check("not official UPSC PYQs" in mains_bank.get("sourceLabel", ""),
                  "Anthropology Mains practice bank must be clearly distinguished from official PYQs")
        except (OSError, json.JSONDecodeError) as exc:
            check(False, f"Anthropology Mains bank could not be parsed: {exc}")
    check(mains_bank_script.is_file(), "Anthropology Mains bank renderer is missing")
    if mains_bank_script.is_file():
        mains_js = mains_bank_script.read_text(encoding="utf-8")
        check('data/upsc/anthropology-mains-bank.json' in mains_js
              and 'tad:mainsPromptSelected' in mains_js
              and 'escapeHTML' in mains_js,
              "Mains bank must load its data safely and connect questions to the writing pad")
    if index_path.is_file():
        index_html = index_path.read_text(encoding="utf-8")
        check('id="mainsBankHost"' in index_html
              and 'assets/js/mains-bank.js' in index_html
              and 'detail.framework' in index_html
              and 'bankId: activePrompt.bankId' in index_html,
              "Mains writing pad must render the bank and preserve question frameworks in saved drafts")
    sw_source_for_mains = (ROOT / "sw.js").read_text(encoding="utf-8") if (ROOT / "sw.js").is_file() else ""
    check("assets/js/mains-bank.js" in sw_source_for_mains
          and "data/upsc/anthropology-mains-bank.json" in sw_source_for_mains,
          "Service worker must cache the Mains bank script and question data")

    # Mains answer evaluation is authenticated, learner-scoped and clearly formative.
    evaluation_js_path = ROOT / "assets" / "js" / "mains-evaluation.js"
    evaluation_css_path = ROOT / "assets" / "css" / "mains-evaluation.css"
    edge_path = ROOT / "supabase" / "functions" / "ai-assistant" / "index.ts"
    if evaluation_js_path.is_file():
        evaluation_js = evaluation_js_path.read_text(encoding="utf-8")
        check('action:"evaluate_mains_answer"' in evaluation_js
              and 'TAD_CAN_EVALUATE_MAINS' in evaluation_js
              and 'TAD_SAVE_MAINS_EVALUATION' in evaluation_js
              and 'tad:mainsEvaluationsUpdated' in evaluation_js,
              "Mains evaluator must call the protected AI action and save private learner history")
        check("AI-estimated practice mark" in evaluation_js
              and "not an official UPSC" in evaluation_js,
              "Mains evaluator must clearly label marks as formative AI estimates")
        check(all(token in evaluation_js for token in ["criteria", "strengths", "improvements", "missing_points", "factual_cautions", "rewrite_plan"]),
              "Mains evaluator must display the complete feedback rubric")
    else:
        check(False, "Mains evaluation browser module is missing")
    check(evaluation_css_path.is_file(), "Mains evaluation stylesheet is missing")
    if edge_path.is_file():
        edge_source = edge_path.read_text(encoding="utf-8")
        check('body.action === "evaluate_mains_answer"' in edge_source
              and 'profile.role !== "learner"' in edge_source
              and 'consume_ai_daily_quota' in edge_source,
              "Mains evaluation backend must enforce learner role and the existing daily AI quota")
        check("answerText.length > 8000" in edge_source
              and 'raw.match(/\\\\{[\\\\s\\\\S]*\\\\}/)' not in edge_source,
              "Mains evaluation backend must bound answer input and parse structured JSON safely")
        check("AI-generated formative feedback" in edge_source
              and "not an official UPSC score" in edge_source,
              "Mains evaluation backend must not present AI estimates as official marks")
    if index_path.is_file():
        index_html = index_path.read_text(encoding="utf-8")
        check('const password = $("authPassword").value;' in index_html
              and 'const password = $("authPassword").value.trim();' not in index_html,
              "Sign-in and sign-up must preserve the exact password entered by the learner")
        check('if (error) throw error;' in index_html
              and 'Could not sign out. Check your connection and try again.' in index_html
              and 'supabase.auth.signOut({ scope: "local" })' in index_html
              and 'return false;' in index_html[index_html.find("async function handleSignOut"):index_html.find("// Phase 4: Multi-Exam Shell Selector")],
              "Sign-out must retain the active account UI when remote session revocation fails")
        check('id="mainsEvaluateBtn"' in index_html
              and 'id="mainsEvaluationResult"' in index_html
              and 'window.TAD_SAVE_MAINS_EVALUATION' in index_html
              and 'mainsEvaluations: []' in index_html,
              "Mains evaluation UI must persist evaluations inside the signed-in learner payload")
        check('assets/js/mains-evaluation.js' in index_html
              and 'assets/css/mains-evaluation.css' in index_html
              and 'window.TAD_SUPABASE = supabase' in index_html,
              "Mains evaluation assets must use the existing authenticated Supabase client")
    check("assets/js/mains-evaluation.js" in sw_source_for_mains
          and "assets/css/mains-evaluation.css" in sw_source_for_mains
          and "desk-v56-topic-progress-tracker" in sw_source_for_mains,
          "Service worker must cache and version the Mains evaluation and Notes Studio features")

    # Notes Studio content, browser module, sync hook and offline cache.
    notes_data_path = ROOT / "data" / "notes" / "gs-foundations.json"
    notes_js_path = ROOT / "assets" / "js" / "notes-studio.js"
    notes_css_path = ROOT / "assets" / "css" / "notes-studio.css"
    if notes_data_path.is_file():
        try:
            notes_pack = json.loads(notes_data_path.read_text(encoding="utf-8"))
            check(len(notes_pack.get("chapters", [])) >= 6,
                  "Notes Studio must include a useful foundation chapter set")
            check(all(ch.get("title") and ch.get("sections") and ch.get("prelims") and ch.get("mains") and ch.get("recall") for ch in notes_pack.get("chapters", [])),
                  "Every foundation note must include explanations, Prelims, Mains and active recall")
        except (OSError, json.JSONDecodeError):
            check(False, "Notes Studio foundation notes JSON must be valid")
    else:
        check(False, "Notes Studio foundation notes data is missing")
    check(notes_js_path.is_file(), "Notes Studio browser module is missing")
    check(notes_css_path.is_file(), "Notes Studio stylesheet is missing")
    if notes_js_path.is_file():
        run_node_check(notes_js_path.read_text(encoding="utf-8"), "assets/js/notes-studio.js")
        check('tad:notesStudioChange' in index_html and 'assets/js/notes-studio.js' in index_html,
              "Notes Studio must load and sync its notebook through signed-in study state")
    if sw_path.is_file():
        check("assets/js/notes-studio.js" in sw_source and "data/notes/gs-foundations.json" in sw_source
              and "assets/css/notes-studio.css" in sw_source,
              "Notes Studio assets and content must be precached for offline study")
    if notes_js_path.is_file() and index_path.is_file():
        notes_js = notes_js_path.read_text(encoding="utf-8")
        check("data-review" in notes_js and "nextReviewAt" in notes_js and "intervals=[1,3,7,14,30]" in notes_js,
              "Notes Studio must schedule spaced revisions and advance review intervals")
        check('id="nsRevisionQueue"' in index_html and 'id="nsDueCount"' in index_html,
              "Notes Studio must display the due revision queue and count")
        check('id="nsProgressPercent"' in index_html and 'id="nsProgressBar"' in index_html and "data-progress" in notes_js and "notesStudioProgressChange" in index_html,
              "Notes Studio must track per-topic completion and persist it through the learner account")
        check("function recordRecall" in notes_js and 'data-recall="confident"' in notes_js and 'data-recall="review"' in notes_js and "nextReviewAt" in notes_js,
              "Active recall outcomes must update topic mastery and spaced revision dates")

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
