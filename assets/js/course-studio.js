(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const columns = "id,created_by,title,summary,category,level,duration_minutes,outcomes,lessons,quiz,status,review_note,reviewed_by,reviewed_at,created_at,updated_at";
  let supabase = null;
  let user = null;
  let profile = null;
  let editingId = null;
  let lessonRows = [{ title: "", body: "", task: "" }];
  let quizRows = [];
  let busy = false;

  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const lines = value => String(value || "").split("\n").map(x => x.trim()).filter(Boolean);

  function message(id, text, kind) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "course-studio-message" + (kind ? " " + kind : "");
  }

  function renderShell() {
    const host = $("courseStudioApp");
    if (!host) return;
    const role = profile && profile.role;
    if (host.dataset.role === role) return;
    host.dataset.role = role || "";
    host.innerHTML = `
      <div class="course-studio-heading">
        <div><span class="eyebrow">COURSE AUTHORING</span><h2>${role === "admin" ? "Owner Course Review Desk" : "Mentor Course Studio"}</h2>
        <p class="muted">${role === "admin" ? "Review submitted courses, publish approved material, or create a course as the owner." : "Create a draft, check your lessons, then submit it for owner review. Only approved courses appear in the learner catalogue."}</p></div>
        <span class="course-role-chip">${role === "admin" ? "OWNER" : "MENTOR"}</span>
      </div>
      <p id="courseStudioFeedback" class="course-studio-message" aria-live="polite"></p>
      <form id="courseEditor" class="course-editor">
        <div class="course-form-grid">
          <label>Course title<input id="courseTitle" maxlength="140" required placeholder="e.g. Introduction to public policy"></label>
          <label>Category<input id="courseCategory" maxlength="80" required value="Foundations" placeholder="e.g. Research"></label>
          <label>Level<select id="courseLevel"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
          <label>Estimated duration (minutes)<input id="courseDuration" type="number" min="5" max="600" value="30" required></label>
        </div>
        <label>Short description<textarea id="courseSummary" rows="3" maxlength="1200" required placeholder="Explain what this course covers and who it is for."></textarea></label>
        <label>Learning outcomes <span class="muted">(one per line; up to 12)</span><textarea id="courseOutcomes" rows="3" required placeholder="Explain the core concept\nIdentify reliable sources"></textarea></label>
        <div class="course-lessons-head"><div><h3>Lessons</h3><p class="muted">Add at least one lesson. Put each paragraph on a separate line.</p></div><button type="button" class="btn" data-add-lesson>Add lesson</button></div>
        <div id="courseLessonRows"></div>
        <div class="course-lessons-head"><div><h3>Knowledge check (optional)</h3><p class="muted">Add up to 20 multiple-choice questions. Each question needs 2–5 options, one correct answer and an explanation.</p></div><button type="button" class="btn" data-add-quiz-question>Add question</button></div>
        <div id="courseQuizRows"></div>
        <div class="course-form-actions">
          <button type="submit" class="btn" data-intent="draft">Save draft</button>
          <button type="submit" class="btn primary" data-intent="${role === "admin" ? "publish" : "review"}">${role === "admin" ? "Publish course" : "Submit for review"}</button>
          <button type="button" class="btn" data-new-course>Clear form</button>
        </div>
      </form>
      <div class="course-studio-lists">
        <section class="card"><h3>${role === "admin" ? "All courses" : "My courses"}</h3><div id="myCoursesList" class="course-studio-list">Loading…</div></section>
        ${role === "admin" ? '<section class="card"><h3>Awaiting review</h3><div id="pendingCoursesList" class="course-studio-list">Loading…</div></section>' : ""}
      </div>`;
    lessonRows = [{ title: "", body: "", task: "" }];
    quizRows = [];
    renderLessonRows();
    renderQuizRows();
  }

  function renderLessonRows() {
    const host = $("courseLessonRows");
    if (!host) return;
    host.innerHTML = lessonRows.map((lesson, i) => `
      <article class="course-lesson-editor">
        <div class="course-lesson-editor-head"><b>Lesson ${i + 1}</b><button type="button" class="btn small" data-remove-lesson="${i}" ${lessonRows.length === 1 ? "disabled" : ""}>Remove</button></div>
        <label>Lesson title<input data-lesson-field="title" data-lesson-index="${i}" maxlength="140" value="${esc(lesson.title)}" required placeholder="Lesson title"></label>
        <label>Lesson content<textarea data-lesson-field="body" data-lesson-index="${i}" rows="4" required placeholder="Write one paragraph per line">${esc(lesson.body)}</textarea></label>
        <label>Practice task<input data-lesson-field="task" data-lesson-index="${i}" maxlength="500" value="${esc(lesson.task)}" required placeholder="A short activity for the learner"></label>
      </article>`).join("");
  }

  function renderQuizRows() {
    const host = $("courseQuizRows");
    if (!host) return;
    if (!quizRows.length) {
      host.innerHTML = '<p class="muted course-no-quiz">No knowledge check added. Learners will complete this course through lesson progress only.</p>';
      return;
    }
    host.innerHTML = quizRows.map((item, i) => `
      <article class="course-quiz-editor">
        <div class="course-lesson-editor-head"><b>Question ${i + 1}</b><button type="button" class="btn small" data-remove-quiz-question="${i}">Remove question</button></div>
        <label>Question text<input data-quiz-field="q" data-quiz-index="${i}" maxlength="500" value="${esc(item.q)}" required placeholder="Write a clear multiple-choice question"></label>
        <div class="course-quiz-options">
          ${item.options.map((option, j) => `
            <label>Option ${j + 1}<span class="course-quiz-option-row"><input data-quiz-option data-quiz-index="${i}" data-option-index="${j}" maxlength="240" value="${esc(option)}" required placeholder="Answer option"><button type="button" class="btn small" data-remove-quiz-option="${i}" data-option-index="${j}" ${item.options.length <= 2 ? "disabled" : ""} aria-label="Remove option ${j + 1}">×</button></span></label>
          `).join("")}
        </div>
        <div class="course-quiz-actions"><button type="button" class="btn small" data-add-quiz-option="${i}" ${item.options.length >= 5 ? "disabled" : ""}>Add option</button></div>
        <label>Correct answer<select data-quiz-field="answer" data-quiz-index="${i}">${item.options.map((option, j) => `<option value="${j}" ${Number(item.answer) === j ? "selected" : ""}>Option ${j + 1}</option>`).join("")}</select></label>
        <label>Explanation<textarea data-quiz-field="why" data-quiz-index="${i}" rows="2" maxlength="1200" required placeholder="Explain why the correct answer is right.">${esc(item.why)}</textarea></label>
      </article>`).join("");
  }

  function resetEditor() {
    editingId = null;
    const form = $("courseEditor");
    if (form) form.reset();
    if ($("courseCategory")) $("courseCategory").value = "Foundations";
    if ($("courseDuration")) $("courseDuration").value = "30";
    lessonRows = [{ title: "", body: "", task: "" }];
    quizRows = [];
    renderLessonRows();
    renderQuizRows();
    message("courseStudioFeedback", "Ready to create a new course.", "info");
  }

  function renderPublished(courses) {
    const host = $("publishedCourseList");
    if (!host) return;
    if (!courses || !courses.length) {
      host.innerHTML = '<p class="muted">No mentor-published courses yet. Approved courses will appear here.</p>';
      return;
    }
    host.innerHTML = courses.map(course => {
      const lessons = Array.isArray(course.lessons) ? course.lessons : [];
      const outcomes = Array.isArray(course.outcomes) ? course.outcomes : [];
      return `<article class="published-course">
        <div class="published-course-meta"><span class="course-role-chip">${esc(course.category)}</span><span>${esc(course.level)} · ${Number(course.duration_minutes) || 0} min</span></div>
        <h3>${esc(course.title)}</h3><p>${esc(course.summary)}</p>
        ${outcomes.length ? '<h4>Learning outcomes</h4><ul>' + outcomes.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul>' : ""}
        <details><summary>View ${lessons.length} lesson(s)</summary>
          ${lessons.map((lesson, i) => '<article class="published-lesson"><b>' + (i + 1) + '. ' + esc(lesson.title) + '</b>' +
            (Array.isArray(lesson.body) ? lesson.body.map(p => '<p>' + esc(p) + '</p>').join("") : '<p>' + esc(lesson.body || "") + '</p>') +
            (lesson.task ? '<p><b>Practice:</b> ' + esc(lesson.task) + '</p>' : "") + '</article>').join("")}
        </details>
      </article>`;
    }).join("");
  }

  function statusLabel(status) {
    return ({
      draft: "Draft", pending_review: "Awaiting review", published: "Published",
      rejected: "Changes requested", archived: "Archived"
    })[status] || status;
  }

  function renderManaged(courses) {
    const host = $("myCoursesList");
    if (!host) return;
    if (!courses.length) {
      host.innerHTML = '<p class="muted">No courses created yet.</p>';
      return;
    }
    host.innerHTML = courses.map(course => `
      <article class="course-managed-item">
        <div><b>${esc(course.title)}</b><span class="course-status status-${esc(course.status)}">${esc(statusLabel(course.status))}</span></div>
        <p>${esc(course.category)} · ${esc(course.level)} · ${Number(course.duration_minutes) || 0} min</p>
        ${course.review_note ? '<p class="course-review-note"><b>Owner note:</b> ' + esc(course.review_note) + '</p>' : ""}
        <button type="button" class="btn small" data-edit-course="${esc(course.id)}">Edit course</button>
      </article>`).join("");
  }

  function renderPending(courses) {
    const host = $("pendingCoursesList");
    if (!host) return;
    if (!courses.length) {
      host.innerHTML = '<p class="muted">No courses are waiting for review.</p>';
      return;
    }
    host.innerHTML = courses.map(course => `
      <article class="course-managed-item">
        <b>${esc(course.title)}</b><p>${esc(course.summary)}</p>
        <p class="muted">Author ID: ${esc(course.created_by)}</p>
        <label>Review note<textarea rows="2" maxlength="1200" data-review-note="${esc(course.id)}" placeholder="Explain any requested changes (optional for publishing)"></textarea></label>
        <div class="course-form-actions">
          <button type="button" class="btn primary small" data-review-course="${esc(course.id)}" data-decision="published">Approve & publish</button>
          <button type="button" class="btn small" data-review-course="${esc(course.id)}" data-decision="rejected">Request changes</button>
        </div>
      </article>`).join("");
  }

  async function refresh() {
    if (!supabase || !user) {
      renderPublished([]);
      if ($("publishedCourseList")) $("publishedCourseList").innerHTML = '<p class="muted">Sign in to view courses published by mentors.</p>';
      if ($("courseStudio")) $("courseStudio").hidden = true;
      return;
    }
    const { data: published, error: publishedError } = await supabase.from("courses")
      .select(columns).eq("status", "published").order("created_at", { ascending: false });
    if (publishedError) {
      const host = $("publishedCourseList");
      if (host) host.innerHTML = '<p class="muted">Published courses could not be loaded: ' + esc(publishedError.message) + '</p>';
      message("courseStudioFeedback", publishedError.message, "error");
    } else {
      renderPublished(published || []);
      window.dispatchEvent(new CustomEvent("tad:publishedCoursesChanged"));
    }

    const role = profile && profile.role;
    const allowed = role === "admin" || role === "mentor";
    const section = $("courseStudio");
    if (section) section.hidden = !allowed;
    const communityPanel = $("communityCoursesPanel");
    if (communityPanel) communityPanel.hidden = !allowed;
    if (!allowed) return;
    renderShell();

    let query = supabase.from("courses").select(columns).order("updated_at", { ascending: false });
    if (role !== "admin") query = query.eq("created_by", user.id);
    const { data: managed, error: managedError } = await query;
    if (managedError) message("courseStudioFeedback", managedError.message, "error");
    else renderManaged(managed || []);

    if (role === "admin") {
      const { data: pending, error: pendingError } = await supabase.from("courses")
        .select(columns).eq("status", "pending_review").order("created_at", { ascending: true });
      if (pendingError) message("courseStudioFeedback", pendingError.message, "error");
      else renderPending(pending || []);
    }
  }

  async function saveCourse(intent) {
    if (busy) return;
    busy = true;
    const button = document.querySelector('#courseEditor button[type="submit"][data-intent="' + intent + '"]');
    if (button) button.disabled = true;
    try {
      const title = $("courseTitle").value.trim();
      const summary = $("courseSummary").value.trim();
      const category = $("courseCategory").value.trim();
      const level = $("courseLevel").value;
      const duration = Number($("courseDuration").value);
      const outcomes = lines($("courseOutcomes").value);
      const lessons = lessonRows.map(item => ({
        title: item.title.trim(),
        body: lines(item.body),
        task: item.task.trim()
      }));
      const quiz = quizRows.map(item => ({
        q: String(item.q || "").trim(),
        options: (item.options || []).map(option => String(option || "").trim()),
        answer: Number(item.answer),
        why: String(item.why || "").trim()
      }));
      if (title.length < 4 || summary.length < 10 || category.length < 2) throw new Error("Complete the title, description and category.");
      if (!Number.isInteger(duration) || duration < 5 || duration > 600) throw new Error("Duration must be between 5 and 600 minutes.");
      if (!outcomes.length || outcomes.length > 12) throw new Error("Add between 1 and 12 learning outcomes.");
      if (!lessons.length || lessons.length > 30 || lessons.some(x => !x.title || !x.body.length || !x.task)) throw new Error("Each lesson needs a title, content and practice task. Add 1 to 30 lessons.");
      if (quiz.length > 20) throw new Error("A course can have up to 20 quiz questions.");
      if (quiz.some(x => x.q.length < 8 || x.q.length > 500 || x.options.length < 2 || x.options.length > 5 || x.options.some(o => !o || o.length > 240) || new Set(x.options.map(o => o.toLowerCase())).size !== x.options.length || !Number.isInteger(x.answer) || x.answer < 0 || x.answer >= x.options.length || x.why.length < 5 || x.why.length > 1200)) throw new Error("Each quiz question needs a clear question, 2–5 different options, one correct answer and an explanation.");
      const payload = { title, summary, category, level, duration_minutes: duration, outcomes, lessons, quiz };
      let courseId = editingId;
      if (editingId) {
        const { data, error } = await supabase.from("courses").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId).select("id").single();
        if (error) throw error;
        if (!data) throw new Error("The course could not be updated. Check your role and course status.");
        courseId = data.id;
      } else {
        const { data, error } = await supabase.from("courses").insert({ ...payload, created_by: user.id }).select("id").single();
        if (error) throw error;
        courseId = data.id;
        editingId = courseId;
      }
      if (intent === "review") {
        const { data, error } = await supabase.from("courses").update({ status: "pending_review" }).eq("id", courseId).select("id").single();
        if (error) throw error;
        if (!data) throw new Error("The course could not be submitted for review.");
        message("courseStudioFeedback", "Course submitted. It will appear in the learner catalogue only after owner approval.", "success");
      } else if (intent === "publish") {
        const { data, error } = await supabase.from("courses").update({
          status: "published", review_note: null, reviewed_by: user.id, reviewed_at: new Date().toISOString()
        }).eq("id", courseId).select("id").single();
        if (error) throw error;
        if (!data) throw new Error("The course could not be published.");
        message("courseStudioFeedback", "Course published successfully.", "success");
      } else {
        message("courseStudioFeedback", "Draft saved.", "success");
      }
      resetEditor();
      await refresh();
    } catch (error) {
      message("courseStudioFeedback", error && error.message ? error.message : "Could not save the course.", "error");
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  async function editCourse(id) {
    const { data, error } = await supabase.from("courses").select(columns).eq("id", id).single();
    if (error) { message("courseStudioFeedback", error.message, "error"); return; }
    editingId = data.id;
    $("courseTitle").value = data.title || "";
    $("courseSummary").value = data.summary || "";
    $("courseCategory").value = data.category || "General";
    $("courseLevel").value = data.level || "beginner";
    $("courseDuration").value = data.duration_minutes || 30;
    $("courseOutcomes").value = (Array.isArray(data.outcomes) ? data.outcomes : []).join("\n");
    lessonRows = (Array.isArray(data.lessons) ? data.lessons : []).map(x => ({
      title: x.title || "",
      body: Array.isArray(x.body) ? x.body.join("\n") : String(x.body || ""),
      task: x.task || ""
    }));
    if (!lessonRows.length) lessonRows = [{ title: "", body: "", task: "" }];
    quizRows = (Array.isArray(data.quiz) ? data.quiz : []).map(x => ({
      q: x.q || "",
      options: Array.isArray(x.options) ? x.options.map(String) : ["", ""],
      answer: Number.isInteger(x.answer) ? x.answer : 0,
      why: x.why || ""
    }));
    renderLessonRows();
    renderQuizRows();
    message("courseStudioFeedback", "Editing: " + data.title + " (" + statusLabel(data.status) + ").", "info");
    $("courseEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function reviewCourse(id, decision) {
    if (busy) return;
    const noteInput = document.querySelector('[data-review-note="' + id + '"]');
    const note = noteInput ? noteInput.value.trim() : "";
    if (decision === "rejected" && note.length < 5) {
      message("courseStudioFeedback", "Add a short review note when requesting changes.", "error");
      return;
    }
    busy = true;
    try {
      const { data, error } = await supabase.from("courses").update({
        status: decision, review_note: decision === "rejected" ? note : null,
        reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq("id", id).select("id").single();
      if (error) throw error;
      if (!data) throw new Error("The course was not available for this review action.");
      message("courseStudioFeedback", decision === "published" ? "Course approved and published." : "Changes requested. The mentor can revise and resubmit.", "success");
      await refresh();
    } catch (error) {
      message("courseStudioFeedback", error && error.message ? error.message : "Review action failed.", "error");
    } finally {
      busy = false;
    }
  }

  document.addEventListener("input", event => {
    const field = event.target.closest("[data-lesson-field]");
    if (field) {
      const index = Number(field.dataset.lessonIndex);
      const key = field.dataset.lessonField;
      if (lessonRows[index] && ["title", "body", "task"].includes(key)) lessonRows[index][key] = field.value;
      return;
    }
    const option = event.target.closest("[data-quiz-option]");
    if (option) {
      const index = Number(option.dataset.quizIndex), optionIndex = Number(option.dataset.optionIndex);
      if (quizRows[index] && quizRows[index].options[optionIndex] !== undefined) quizRows[index].options[optionIndex] = option.value;
      return;
    }
    const quizField = event.target.closest("[data-quiz-field]");
    if (quizField) {
      const index = Number(quizField.dataset.quizIndex), key = quizField.dataset.quizField;
      if (quizRows[index] && ["q", "why", "answer"].includes(key)) quizRows[index][key] = key === "answer" ? Number(quizField.value) : quizField.value;
    }
  });

  document.addEventListener("click", event => {
    if (event.target.closest("[data-add-quiz-question]")) {
      if (quizRows.length >= 20) { message("courseStudioFeedback", "A course can have up to 20 quiz questions.", "error"); return; }
      quizRows.push({ q: "", options: ["", "", "", ""], answer: 0, why: "" }); renderQuizRows(); return;
    }
    const addOption = event.target.closest("[data-add-quiz-option]");
    if (addOption) {
      const index = Number(addOption.dataset.addQuizOption);
      if (quizRows[index] && quizRows[index].options.length < 5) { quizRows[index].options.push(""); renderQuizRows(); }
      return;
    }
    const removeOption = event.target.closest("[data-remove-quiz-option]");
    if (removeOption) {
      const index = Number(removeOption.dataset.removeQuizOption), optionIndex = Number(removeOption.dataset.optionIndex);
      if (quizRows[index] && quizRows[index].options.length > 2) {
        quizRows[index].options.splice(optionIndex, 1);
        if (quizRows[index].answer >= quizRows[index].options.length) quizRows[index].answer = quizRows[index].options.length - 1;
        renderQuizRows();
      }
      return;
    }
    const removeQuestion = event.target.closest("[data-remove-quiz-question]");
    if (removeQuestion) { quizRows.splice(Number(removeQuestion.dataset.removeQuizQuestion), 1); renderQuizRows(); return; }
    if (event.target.closest("[data-add-lesson]")) {
      if (lessonRows.length >= 30) { message("courseStudioFeedback", "A course can have up to 30 lessons.", "error"); return; }
      lessonRows.push({ title: "", body: "", task: "" }); renderLessonRows(); return;
    }
    const remove = event.target.closest("[data-remove-lesson]");
    if (remove) { lessonRows.splice(Number(remove.dataset.removeLesson), 1); renderLessonRows(); return; }
    if (event.target.closest("[data-new-course]")) { resetEditor(); return; }
    const edit = event.target.closest("[data-edit-course]");
    if (edit) { editCourse(edit.dataset.editCourse); return; }
    const review = event.target.closest("[data-review-course]");
    if (review) reviewCourse(review.dataset.reviewCourse, review.dataset.decision);
  });

  document.addEventListener("submit", event => {
    if (event.target.id !== "courseEditor") return;
    event.preventDefault();
    const intent = event.submitter && event.submitter.dataset.intent || "draft";
    saveCourse(intent);
  });

  function applyAuthContext(context) {
    if (!context) return;
    supabase = context.supabase || null;
    user = context.user || null;
    profile = context.profile || { role: "learner" };
    const section = $("courseStudio");
    const allowed = !!(user && profile && ["admin", "mentor"].includes(profile.role));
    if (section) section.hidden = !allowed;
    const communityPanel = $("communityCoursesPanel");
    if (communityPanel) communityPanel.hidden = !allowed;
    if (allowed) renderShell();
    refresh();
  }

  window.addEventListener("tad:authStateChanged", event => applyAuthContext(event.detail));
  if (window.DESK_AUTH_CONTEXT) applyAuthContext(window.DESK_AUTH_CONTEXT);
  else {
    const list = $("publishedCourseList");
    if (list) list.innerHTML = '<p class="muted">Sign in to view courses published by mentors.</p>';
  }
})();