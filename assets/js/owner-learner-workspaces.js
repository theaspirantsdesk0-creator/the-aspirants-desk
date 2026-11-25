(function () {
  "use strict";
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  let busy = false;

  function ensurePanel() {
    const admin = document.getElementById("admin");
    if (!admin || document.getElementById("ownerLearnerWorkspace")) return;
    const panel = document.createElement("div");
    panel.className = "card";
    panel.id = "ownerLearnerWorkspace";
    panel.style.marginTop = "1rem";
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap"><div><span class="pill bad">OWNER ONLY · PRIVATE DATA</span><h3 style="margin:.45rem 0">Learner workspaces</h3><p class="muted">Read-only access to each account’s saved optional subject, study state, test history, paper attempts and Anbuu learning records. Learners and mentors cannot access this owner view.</p></div><button type="button" class="btn" id="ownerLearnerRefresh">Refresh data</button></div><div id="ownerLearnerWorkspaceStatus" class="muted" role="status">Waiting for owner sign-in…</div><div class="table-wrap"><table><thead><tr><th>Account</th><th>Role</th><th>Optional subject</th><th>Language / level</th><th>Test / paper activity</th><th>Last saved</th><th>Private workspace</th></tr></thead><tbody id="ownerLearnerWorkspaceRows"></tbody></table></div>';
    admin.appendChild(panel);
    document.getElementById("ownerLearnerRefresh").addEventListener("click", load);
  }

  async function load() {
    ensurePanel();
    const context = window.DESK_AUTH_CONTEXT;
    const panel = document.getElementById("ownerLearnerWorkspace");
    if (!panel) return;
    if (!context || !context.user || !context.profile || context.profile.role !== "admin" || !context.supabase) {
      panel.hidden = true;
      const rows = document.getElementById("ownerLearnerWorkspaceRows");
      const status = document.getElementById("ownerLearnerWorkspaceStatus");
      if (rows) rows.innerHTML = "";
      if (status) status.textContent = "Owner access required. Private learner records are not available in this session.";
      return;
    }
    panel.hidden = false;
    if (busy) return;
    busy = true;
    const status = document.getElementById("ownerLearnerWorkspaceStatus");
    const rows = document.getElementById("ownerLearnerWorkspaceRows");
    status.textContent = "Loading private learner workspaces…";
    try {
      const db = context.supabase;
      const [profilesResult, dataResult, progressResult, testsResult, attemptsResult, lessonsResult, mentorResult] = await Promise.all([
        db.from("profiles").select("id,display_name,role,created_at").order("display_name"),
        db.from("user_data").select("user_id,payload,updated_at").order("updated_at", { ascending: false }),
        db.from("progress").select("user_id,summary,updated_at"),
        db.from("test_results").select("user_id,exam,test_name,score,max_score,correct_count,wrong_count,skipped_count,created_at").order("created_at", { ascending: false }).limit(500),
        db.from("pyq_attempts").select("user_id,question_id,selected_option,answer_text,is_correct,marks_awarded,feedback,attempted_at").order("attempted_at", { ascending: false }).limit(500),
        db.from("anbuu_lesson_history").select("user_id,track,subject,topic,level,status,updated_at,checkpoint_completed").order("updated_at", { ascending: false }).limit(500),
        db.from("anbuu_mentor_state").select("user_id,active_study_plan,doubt_log,pending_tasks,updated_at")
      ]);
      for (const result of [profilesResult, dataResult, progressResult, testsResult, attemptsResult, lessonsResult, mentorResult]) {
        if (result.error) throw result.error;
      }
      const byUser = result => {
        const map = new Map();
        (result.data || []).forEach(item => {
          if (!map.has(item.user_id)) map.set(item.user_id, []);
          map.get(item.user_id).push(item);
        });
        return map;
      };
      const payloadByUser = new Map((dataResult.data || []).map(item => [item.user_id, item]));
      const progressByUser = new Map((progressResult.data || []).map(item => [item.user_id, item]));
      const testsByUser = byUser(testsResult);
      const attemptsByUser = byUser(attemptsResult);
      const lessonsByUser = byUser(lessonsResult);
      const mentorByUser = new Map((mentorResult.data || []).map(item => [item.user_id, item]));
      const profiles = profilesResult.data || [];
      rows.innerHTML = profiles.map(profile => {
        const record = payloadByUser.get(profile.id);
        const payload = record && record.payload && typeof record.payload === "object" ? record.payload : {};
        const progressRecord = progressByUser.get(profile.id);
        const progressSummary = progressRecord && progressRecord.summary && typeof progressRecord.summary === "object" ? progressRecord.summary : {};
        const optional = payload.optionalPrep || {};
        const tests = testsByUser.get(profile.id) || [];
        const attempts = attemptsByUser.get(profile.id) || [];
        const lessons = lessonsByUser.get(profile.id) || [];
        const mentor = mentorByUser.get(profile.id) || null;
        const workspace = {
          savedAccountPayload: payload,
          testResults: tests,
          paperAndPYQAttempts: attempts,
          AnbuuLessonHistory: lessons,
          AnbuuMentorState: mentor
        };
        const details = record || tests.length || attempts.length || lessons.length || mentor
          ? JSON.stringify(workspace, null, 2)
          : "No cloud workspace records have been saved for this account yet.";
        const lastSaved = [record && record.updated_at, tests[0] && tests[0].created_at, attempts[0] && attempts[0].attempted_at, lessons[0] && lessons[0].updated_at, mentor && mentor.updated_at].filter(Boolean).sort().reverse()[0];
        return '<tr><td><b>' + esc(profile.display_name || "Learner") + '</b><br><small>' + esc(profile.target_exam || "UPSC CSE") + '</small></td>' +
          '<td>' + esc(profile.role || "learner") + '</td>' +
          '<td>' + esc(optional.subject || "Not selected") + '</td>' +
          '<td>' + esc([optional.language, optional.level].filter(Boolean).join(" · ") || "—") + '</td>' +
          '<td>' + tests.length + ' tests · ' + attempts.length + ' PYQ attempts · ' + lessons.length + ' lessons</td>' +
          '<td>' + esc(lastSaved ? new Date(lastSaved).toLocaleString() : "Not synced") + '</td>' +
          '<td><details><summary>Open saved workspace</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;padding:.75rem;background:var(--surface-alt);border:1px solid var(--line);border-radius:10px;font-size:.75rem">' + esc(details) + '</pre></details></td></tr>';
      }).join("") || '<tr><td colspan="7">No learner accounts found.</td></tr>';
      status.textContent = profiles.length + " account(s) · owner-only read view · recent activity capped at 500 rows per activity table.";
    } catch (error) {
      status.textContent = "Could not load learner workspaces: " + esc(error && error.message ? error.message : "Unknown error");
      rows.innerHTML = "";
    } finally {
      busy = false;
    }
  }

  window.addEventListener("tad:authStateChanged", load);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensurePanel);
  else ensurePanel();
  if (window.DESK_AUTH_CONTEXT) load();
})();