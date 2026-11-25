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
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap"><div><span class="pill bad">OWNER ONLY · PRIVATE DATA</span><h3 style="margin:.45rem 0">Learner workspaces</h3><p class="muted">Read-only overview of each account’s saved optional subject, notes, study state and learning data. Learners cannot access this owner view.</p></div><button type="button" class="btn" id="ownerLearnerRefresh">Refresh data</button></div><div id="ownerLearnerWorkspaceStatus" class="muted" role="status">Waiting for owner sign-in…</div><div class="table-wrap"><table><thead><tr><th>Account</th><th>Role</th><th>Optional subject</th><th>Language / level</th><th>Last saved</th><th>Private workspace</th></tr></thead><tbody id="ownerLearnerWorkspaceRows"></tbody></table></div>';
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
      return;
    }
    panel.hidden = false;
    if (busy) return;
    busy = true;
    const status = document.getElementById("ownerLearnerWorkspaceStatus");
    const rows = document.getElementById("ownerLearnerWorkspaceRows");
    status.textContent = "Loading private learner workspaces…";
    try {
      const [profilesResult, dataResult] = await Promise.all([
        context.supabase.from("profiles").select("id,display_name,role,target_exam").order("display_name"),
        context.supabase.from("user_data").select("user_id,payload,updated_at").order("updated_at", { ascending: false })
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (dataResult.error) throw dataResult.error;
      const payloadByUser = new Map((dataResult.data || []).map(item => [item.user_id, item]));
      const profiles = profilesResult.data || [];
      rows.innerHTML = profiles.map(profile => {
        const record = payloadByUser.get(profile.id);
        const payload = record && record.payload && typeof record.payload === "object" ? record.payload : {};
        const optional = payload.optionalPrep || {};
        const details = record ? JSON.stringify(payload, null, 2) : "No cloud workspace data has been saved for this account yet.";
        return '<tr><td><b>' + esc(profile.display_name || "Learner") + '</b><br><small>' + esc(profile.target_exam || "UPSC CSE") + '</small></td>' +
          '<td>' + esc(profile.role || "learner") + '</td>' +
          '<td>' + esc(optional.subject || "Not selected") + '</td>' +
          '<td>' + esc([optional.language, optional.level].filter(Boolean).join(" · ") || "—") + '</td>' +
          '<td>' + esc(record && record.updated_at ? new Date(record.updated_at).toLocaleString() : "Not synced") + '</td>' +
          '<td><details><summary>Open saved workspace</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;padding:.75rem;background:var(--surface-alt);border:1px solid var(--line);border-radius:10px;font-size:.75rem">' + esc(details) + '</pre></details></td></tr>';
      }).join("") || '<tr><td colspan="6">No learner accounts found.</td></tr>';
      status.textContent = profiles.length + " account(s) · " + (dataResult.data || []).length + " saved workspace record(s). Read-only owner view.";
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