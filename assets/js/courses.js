(function () {
  "use strict";
  const ROOT_KEY = "tad_state_v5";
  const starterCourses = [
    {
      id:"learn-to-learn", title:"Learning how to learn", category:"Foundations", level:"Beginner", duration:"45 minutes",
      summary:"Build a repeatable study cycle using clear goals, active recall and spaced review.",
      outcomes:["Turn a broad goal into a small learning target","Use retrieval practice instead of rereading alone","Plan short review sessions"],
      lessons:[
        {title:"Set a useful learning target",body:["A useful target describes what you should be able to do, not only what you plan to read.","Example: replace “study geography” with “explain the water cycle in five steps without looking at notes”.","Keep the target small enough to practise and check in one sitting."],task:"Write one measurable target for a topic you are studying."},
        {title:"Practise recall and review",body:["After studying, close the source and write or explain the main ideas from memory. This is retrieval practice.","Check your recall against a trusted source. Correct gaps rather than copying everything again.","Review the same ideas after increasing intervals. A simple starting pattern is the next day, three days later and one week later."],task:"Create three review dates for the target you wrote in Lesson 1."}
      ],
      quiz:[
        {q:"Which is the clearest learning target?",options:["Read geography for two hours","Finish a textbook chapter","Explain the water cycle in five steps without notes","Highlight every important sentence"],answer:2,why:"A strong target states an observable ability that can be checked."},
        {q:"What is retrieval practice?",options:["Re-reading the same page repeatedly","Trying to recall information before checking the source","Copying a summary word for word","Watching a lesson at double speed"],answer:1,why:"Retrieval practice means bringing information to mind from memory."},
        {q:"What should you do after a recall attempt?",options:["Ignore mistakes","Compare with a reliable source and correct gaps","Start a new subject immediately","Memorise the page layout"],answer:1,why:"Feedback helps identify and correct missing or inaccurate understanding."}
      ]
    },
    {
      id:"research-literacy", title:"Research and source literacy", category:"Research", level:"Beginner", duration:"50 minutes",
      summary:"Ask focused questions, identify primary sources and separate evidence from interpretation.",
      outcomes:["Convert a topic into a focused question","Recognise primary and secondary sources","Record evidence and uncertainty"],
      lessons:[
        {title:"Ask a focused question",body:["A topic such as “climate change” is too broad for a short research task.","Narrow it by place, period, group or outcome. For example: “How have heat-action plans been used by one Indian city?”","Write down what evidence would help answer the question before searching."],task:"Turn one broad topic into a question with a clear place or period."},
        {title:"Check sources and claims",body:["A primary source is close to the event or data being studied, such as a law, official dataset, original report or research paper.","A secondary source explains or analyses primary material. It can be useful, but check its references and date.","Separate a verified fact from an author's interpretation. Record the source link and any limitation."],task:"Find one primary source and one secondary explanation for your question."}
      ],
      quiz:[
        {q:"Which is usually a primary source for a law?",options:["A social-media summary","The official text of the law","A coaching-centre note","An unsourced blog"],answer:1,why:"The official legal text is the original source."},
        {q:"Why narrow a research question?",options:["To avoid checking evidence","To make the question answerable with available evidence","To guarantee one preferred conclusion","To remove uncertainty"],answer:1,why:"A focused question defines what evidence is relevant and manageable."},
        {q:"What should you do when a source has a limitation?",options:["Hide it","Record the limitation and consider its effect","Treat it as fully reliable","Delete other sources"],answer:1,why:"Transparent limitations help readers judge the strength of a conclusion."}
      ]
    },
    {
      id:"clear-writing", title:"Clear writing and structured answers", category:"Communication", level:"Beginner", duration:"40 minutes",
      summary:"Organise an answer around the question, support points with evidence and edit for clarity.",
      outcomes:["Identify the task in a question","Build a logical answer structure","Edit vague or unsupported statements"],
      lessons:[
        {title:"Understand the question",body:["Identify the command word: describe, explain, compare, analyse or evaluate.","Underline the subject and the boundaries of the question, such as time, place or stakeholder.","Plan a direct response before writing the introduction."],task:"Choose a practice question and identify its command word and boundaries."},
        {title:"Build and edit the answer",body:["Use a short opening that directly addresses the question.","Arrange the main points in a logical order. Support factual claims with examples, data or authoritative references where available.","Finish with a conclusion that follows from the discussion. Remove repetition and unsupported claims."],task:"Write a short answer and edit it once for relevance, evidence and clarity."}
      ],
      quiz:[
        {q:"What should you identify first when reading an exam question?",options:["The number of paragraphs","The command word and scope","A quotation to use","The conclusion"],answer:1,why:"The command word and scope tell you what the question requires."},
        {q:"What makes a factual claim stronger?",options:["Using complicated words","Adding relevant evidence or a reliable example","Repeating it several times","Writing it in capital letters"],answer:1,why:"Relevant evidence makes a claim more supportable."},
        {q:"What is a useful final editing check?",options:["Does every paragraph answer the question?","Can I add unrelated facts?","Can I remove all examples?","Can I make every sentence longer?"],answer:0,why:"Relevance is a central test of answer quality."}
      ]
    }
    ,
    {
      id:"digital-information-literacy", title:"Digital and information literacy", category:"Digital skills", level:"Beginner", duration:"55 minutes",
      summary:"Use digital tools safely, search more effectively and judge whether online information is trustworthy.",
      outcomes:["Use focused search terms and compare sources","Recognise common online safety and privacy risks","Check the origin, date and evidence behind a claim"],
      lessons:[
        {title:"Search with a clear purpose",body:["Turn a broad topic into a specific question before searching. Add useful terms such as a place, date, institution or document type.","Prefer original sources for important claims: official notices, laws, datasets, research papers and institutional publications.","Compare more than one credible source. A search ranking is not proof that a result is accurate."],task:"Write a focused search query and identify one primary source for your topic."},
        {title:"Evaluate information",body:["Check who created the material, when it was published and what evidence it provides. Open the original source rather than relying only on a screenshot or forwarded message.","Separate facts, opinions and predictions. Look for missing context, unsupported numbers and headlines that overstate the evidence.","If a claim matters, verify it with an independent authoritative source and record uncertainty where evidence is incomplete."],task:"Choose one online claim and record its author, date, evidence and one independent cross-check."},
        {title:"Protect accounts and personal data",body:["Use unique passwords and enable multi-factor authentication where available. Never share one-time codes or recovery links with another person.","Review app permissions and privacy settings. Avoid uploading identity documents or sensitive personal information to unfamiliar services.","Use trusted networks and keep your browser, operating system and security updates current. Report suspicious messages through the relevant service."],task:"Review the permissions of one app and identify one setting you can improve."}
      ],
      quiz:[
        {q:"What is the best first step when checking an important online claim?",options:["Share it quickly","Find the original source and inspect its evidence","Trust the most popular post","Judge it by the headline"],answer:1,why:"Checking the original source and its evidence is more reliable than relying on popularity or presentation."},
        {q:"Why should you compare publication dates?",options:["Older sources are always wrong","Dates help identify whether information may be outdated","Dates prove the author is correct","Dates replace source checking"],answer:1,why:"Some information changes, so the date helps you judge whether it is still current."},
        {q:"Which practice improves account security?",options:["Reuse one password everywhere","Share one-time codes with support callers","Use unique passwords and multi-factor authentication","Store passwords in a public note"],answer:2,why:"Unique passwords limit reuse risk and multi-factor authentication adds another layer of protection."}
      ]
    },
    {
      id:"responsible-ai-literacy", title:"AI literacy and responsible use", category:"Technology", level:"Beginner", duration:"50 minutes",
      summary:"Understand what AI tools can and cannot do, write clearer prompts and verify generated information.",
      outcomes:["Explain the difference between a model output and verified evidence","Write prompts with context, constraints and a clear task","Check outputs for errors, bias and privacy risks"],
      lessons:[
        {title:"Understand AI outputs",body:["AI systems generate outputs from patterns in data and instructions. A fluent answer is not automatically a correct or complete answer.","Models can make factual mistakes, omit context or present uncertain information confidently. Treat important claims as items to verify.","Use AI as an assistant for explanation, drafting and exploration—not as a substitute for professional judgement or authoritative records."],task:"Take one AI-generated factual claim and verify it against an authoritative source."},
        {title:"Write a useful prompt",body:["State the task, relevant context, intended audience and format. Give constraints such as word limits or the level of explanation required.","Break complex work into stages: ask for an outline, inspect it, then request a focused draft or explanation.","Ask the tool to identify uncertainty and distinguish sourced facts from suggestions. You remain responsible for checking the result."],task:"Rewrite a vague prompt by adding context, task, audience and output format."},
        {title:"Use AI safely and fairly",body:["Do not enter passwords, one-time codes, private records or other sensitive information into tools unless you understand and trust their data handling.","Check outputs for stereotypes, missing viewpoints, fabricated citations and accessibility barriers. Include human review for consequential decisions.","Follow academic and workplace rules. Disclose AI assistance when required and make sure submitted work reflects your own understanding."],task:"Create a short checklist you will use before relying on an AI-generated answer."}
      ],
      quiz:[
        {q:"Does a fluent AI answer guarantee factual accuracy?",options:["Yes, fluency proves accuracy","No, important claims still need checking","Only if the answer is long","Only if it includes a table"],answer:1,why:"Fluency and factual accuracy are different; verify important claims using reliable sources."},
        {q:"Which prompt is usually more useful?",options:["Explain everything","Give a clear task, context, audience and output format","Write something impressive","Do not ask questions"],answer:1,why:"Clear context and constraints help make the output relevant and usable."},
        {q:"What should you avoid entering into an unfamiliar AI tool?",options:["A public topic","A general study question","Passwords and sensitive personal records","A request for a summary of public information"],answer:2,why:"Sensitive data should not be shared unless the tool's data handling is understood and appropriate."}
      ]
    }
  ];

  let courses = starterCourses.slice();
  let courseSupabase = null;
  let courseUser = null;
  let publishedLoadVersion = 0;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function rootState() {
    try { const value = JSON.parse(localStorage.getItem(ROOT_KEY) || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
    catch (_) { return {}; }
  }
  function readCourseState() {
    const hub = rootState().learningHub || {};
    return hub.courses && typeof hub.courses === "object" ? hub.courses : {};
  }
  function writeCourseState(next) {
    const root = rootState();
    const hub = root.learningHub && typeof root.learningHub === "object" ? root.learningHub : {};
    hub.courses = next;
    root.learningHub = hub;
    try { localStorage.setItem(ROOT_KEY, JSON.stringify(root)); } catch (_) {}
    window.dispatchEvent(new CustomEvent("tad:learningHubChange", {detail:hub}));
  }
  let selected = "";
  let searchTerm = "";
  let categoryFilter = "ALL";
  let statusFilter = "ALL";
  function progressFor(course, state) {
    const record = state[course.id] || {};
    const rawCompleted = Array.isArray(record.completedLessons) ? record.completedLessons : [];
    const lessonTotal = course.lessons.length;
    const completed = [...new Set(rawCompleted.filter(n => Number.isInteger(n) && n >= 0 && n < lessonTotal))];
    const hasQuiz = Array.isArray(course.quiz) && course.quiz.length > 0;
    const quizDone = hasQuiz && (Number.isInteger(record.quizBest) || (Array.isArray(record.quizHistory) && record.quizHistory.length > 0));
    const total = lessonTotal + (hasQuiz ? 1 : 0);
    const done = completed.length + (quizDone ? 1 : 0);
    const completedCount = completed.length;
    const isComplete = completedCount === lessonTotal && (!hasQuiz || quizDone);
    return {record, completed, done, total, percent:total ? Math.round(done / total * 100) : 0, isComplete, hasQuiz};
  }
  function render() {
    const host = document.getElementById("courseCatalog");
    const detail = document.getElementById("courseDetail");
    if (!host || !detail) return;
    const state = readCourseState();
    const categorySelect = document.getElementById("courseCategoryFilter");
    if (categorySelect) {
      const categories = [...new Set(courses.map(course => course.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      const options = '<option value="ALL">All learning areas</option>' + categories.map(category => '<option value="'+esc(category)+'">'+esc(category)+'</option>').join("");
      if (categorySelect.innerHTML !== options) categorySelect.innerHTML = options;
      categorySelect.value = categories.includes(categoryFilter) ? categoryFilter : "ALL";
      categoryFilter = categorySelect.value;
    }
    const visible = courses.filter(c => {
      const p = progressFor(c,state);
      const status = p.isComplete ? "COMPLETED" : p.record.enrolledAt ? "IN_PROGRESS" : "NOT_STARTED";
      return (!searchTerm || (c.title+" "+c.category+" "+c.summary).toLowerCase().includes(searchTerm))
        && (categoryFilter === "ALL" || c.category === categoryFilter)
        && (statusFilter === "ALL" || status === statusFilter);
    });
    const resultCount = document.getElementById("courseResultCount");
    if (resultCount) resultCount.textContent = "Showing " + visible.length + " of " + courses.length + " courses";
    let enrolledCount = 0, completedCount = 0, assessmentCount = 0;
    courses.forEach(course => {
      const p = progressFor(course, state);
      if (p.record.enrolledAt) enrolledCount++;
      if (p.isComplete) completedCount++;
      assessmentCount += Array.isArray(p.record.quizHistory) ? p.record.quizHistory.length : (Number(p.record.quizAttempts) || 0);
    });
    const summary = document.getElementById("courseLearningSummary");
    if (summary) summary.innerHTML = '<div class="course-summary-stat"><b>'+enrolledCount+'</b><span>Enrolled</span></div><div class="course-summary-stat"><b>'+completedCount+'</b><span>Completed</span></div><div class="course-summary-stat"><b>'+assessmentCount+'</b><span>Quiz attempts</span></div>';
    host.innerHTML = visible.map(course => {
      const p = progressFor(course,state);
      const enrolled = !!p.record.enrolledAt;
      const status = p.isComplete ? "Completed" : enrolled ? "In progress" : "Not started";
      return '<article class="card tad-course-card"><div class="tad-course-meta"><span class="pill">'+esc(course.category)+'</span>'+(course.source==="mentor"?'<span class="pill">Mentor-published</span>':'')+'<span>'+esc(course.level)+' · '+esc(course.duration)+'</span></div><h3>'+esc(course.title)+'</h3><p class="muted">'+esc(course.summary)+'</p><div class="tad-course-progress"><div><b>'+p.percent+'% · '+status+'</b><span>'+p.done+' of '+p.total+' activities</span></div><div class="bar-track"><div class="bar-fill" style="width:'+p.percent+'%"></div></div></div><button type="button" class="btn primary" data-open-course="'+course.id+'">'+(p.isComplete?"Review course":enrolled?"Continue course":"Start course")+'</button></article>';
    }).join("");
    if (!visible.length) host.innerHTML = '<p class="muted">No courses match this search.</p>';
    const course = courses.find(c => c.id === selected);
    if (!course) {
      detail.hidden = true;
      detail.innerHTML = "";
      return;
    }
    detail.hidden = false;
    const p = progressFor(course,state);
    const enrolled = !!p.record.enrolledAt;
    const lessonMarkup = course.lessons.map((lesson,i) => {
      const done = p.completed.includes(i);
      return '<article class="tad-lesson"><div><span class="pill">LESSON '+(i+1)+'</span><h4>'+esc(lesson.title)+'</h4></div><div class="tad-lesson-body">'+lesson.body.map(par=>'<p>'+esc(par)+'</p>').join("")+'<p class="tad-task"><b>Try it:</b> '+esc(lesson.task)+'</p></div><button type="button" class="btn '+(done?"":"primary")+'" data-complete-lesson="'+i+'">'+(done?"Completed ✓":"Mark lesson complete")+'</button></article>';
    }).join("");
    const quiz = (course.quiz || []).map((item,i) => '<fieldset class="tad-quiz-question"><legend>'+(i+1)+'. '+esc(item.q)+'</legend>'+item.options.map((option,j)=>'<label><input type="radio" name="tad-course-q-'+i+'" value="'+j+'" required> '+esc(option)+'</label>').join("")+'</fieldset>').join("");
    const best = Number.isInteger(p.record.quizBest) ? p.record.quizBest : null;
    const history = Array.isArray(p.record.quizHistory) ? p.record.quizHistory.slice().reverse() : [];
    const historyMarkup = history.length ? '<div class="tad-assessment-history"><h4>Assessment history</h4>'+history.slice(0,10).map((attempt,index) => {
      const when = attempt.at ? new Date(attempt.at) : null;
      const date = when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : "Earlier attempt";
      const score = Number.isFinite(attempt.score) ? attempt.score : 0;
      const total = Number.isFinite(attempt.total) ? attempt.total : course.quiz.length;
      return '<article class="tad-assessment-row"><div><b>Attempt '+(history.length-index)+'</b><span>'+esc(date)+'</span></div><strong>'+score+' / '+total+'</strong></article>';
    }).join("")+'</div>' : '<p class="muted">Your quiz attempts will appear here after your first submission.</p>';
    const assessmentMarkup = p.hasQuiz
      ? '<div class="card"><h3>Knowledge check</h3><p class="muted">Answer all questions. Your best score is saved to your learning progress.</p><form id="tadCourseQuiz">'+quiz+'<button type="submit" class="btn primary">Submit quiz</button><p id="tadQuizFeedback" class="tad-quiz-feedback" aria-live="polite"></p></form>'+(best!==null?'<p class="muted">Best score: '+best+' / '+course.quiz.length+'</p>':'')+historyMarkup+'</div>'
      : '<div class="card"><h3>Course completion</h3><p class="muted">This mentor-published course currently uses lesson completion as its progress measure. No quiz has been added.</p></div>';
    const completedDate = p.record.completedAt && !Number.isNaN(new Date(p.record.completedAt).getTime()) ? new Date(p.record.completedAt).toLocaleDateString() : "";
    const completionMarkup = p.isComplete ? '<p class="tad-course-complete" role="status">Course completed'+(completedDate ? ' on '+esc(completedDate) : '')+'. You can revisit the course at any time.</p>' : '<p class="muted">'+(p.hasQuiz ? 'Complete every lesson and submit the knowledge check to finish this course.' : 'Complete every lesson to finish this course.')+'</p>';
    detail.innerHTML = '<div class="card gold-top"><div class="tad-course-meta"><span class="pill">'+esc(course.category)+'</span><span>'+esc(course.level)+' · '+esc(course.duration)+'</span></div><h2>'+esc(course.title)+'</h2><p class="muted">'+esc(course.summary)+'</p><h3>What you will learn</h3><ul>'+course.outcomes.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul><div class="tad-course-progress"><div><b>'+p.percent+'% complete</b><span>'+p.done+' / '+p.total+' activities</span></div><div class="bar-track"><div class="bar-fill" style="width:'+p.percent+'%"></div></div></div>'+(enrolled?'':'<button type="button" class="btn primary" data-enrol-course>Enrol in this course</button>')+'</div><div class="card"><h3>Lessons</h3><div class="tad-lessons">'+lessonMarkup+'</div></div>'+assessmentMarkup+completionMarkup+'</div><button type="button" class="btn" data-back-catalog>← Back to course catalogue</button>';
  }
  document.addEventListener("input", event => {
    if (event.target.id === "courseSearch") {
      searchTerm = event.target.value.trim().toLowerCase();
      render();
      const input = document.getElementById("courseSearch");
      if (input) { input.focus(); input.setSelectionRange(input.value.length,input.value.length); }
    }
  });
  document.addEventListener("change", event => {
    if (event.target.id === "courseCategoryFilter") {
      categoryFilter = event.target.value || "ALL";
      render();
    }
    if (event.target.id === "courseStatusFilter") {
      statusFilter = event.target.value || "ALL";
      render();
    }
  });
  document.addEventListener("click", event => {
    const open = event.target.closest("[data-open-course]");
    if (open) { selected = open.dataset.openCourse; const state=readCourseState(), record=state[selected]||{}; if(!record.enrolledAt){record.enrolledAt=new Date().toISOString();state[selected]=record;writeCourseState(state);} render(); document.getElementById("courseDetail").scrollIntoView({behavior:"smooth",block:"start"}); return; }
    if (event.target.closest("[data-back-catalog]")) { selected=""; render(); document.getElementById("courseCatalog").scrollIntoView({behavior:"smooth",block:"start"}); return; }
    if (event.target.closest("[data-enrol-course]")) { const state=readCourseState(), record=state[selected]||{}; record.enrolledAt=record.enrolledAt||new Date().toISOString();state[selected]=record;writeCourseState(state);render();return; }
    const done = event.target.closest("[data-complete-lesson]");
    if (done) {
      const state=readCourseState(),record=state[selected]||{},course=courses.find(c=>c.id===selected);
      record.enrolledAt=record.enrolledAt||new Date().toISOString();
      const list=Array.isArray(record.completedLessons)?record.completedLessons:[];
      const n=Number(done.dataset.completeLesson);
      if(!list.includes(n))list.push(n);
      record.completedLessons=list;
      if(course && list.length>=course.lessons.length && (!(course.quiz || []).length || Number.isInteger(record.quizBest) || (Array.isArray(record.quizHistory)&&record.quizHistory.length))) record.completedAt=record.completedAt||new Date().toISOString();
      state[selected]=record;writeCourseState(state);render();return;
    }
  });
  document.addEventListener("submit", event => {
    if (event.target.id !== "tadCourseQuiz") return;
    event.preventDefault();
    const course=courses.find(c=>c.id===selected);if(!course)return;
    const state=readCourseState(),record=state[selected]||{};
    let score=0, missing=false;
    const answers=[];
    course.quiz.forEach((item,i)=>{
      const chosen=event.target.querySelector('input[name="tad-course-q-'+i+'"]:checked');
      if(!chosen){missing=true;answers.push(null);}
      else {const answer=Number(chosen.value);answers.push(answer);if(answer===item.answer)score++;}
    });
    const feedback=document.getElementById("tadQuizFeedback");
    if(missing){feedback.textContent="Please answer every question before submitting.";return;}
    const attemptedAt=new Date().toISOString();
    const previous=Number.isInteger(record.quizBest)?record.quizBest:0;
    record.quizBest=Math.max(previous,score);
    record.quizAttempts=(record.quizAttempts||0)+1;
    record.lastQuizAt=attemptedAt;
    record.enrolledAt=record.enrolledAt||attemptedAt;
    const history=Array.isArray(record.quizHistory)?record.quizHistory:[];
    history.push({score,total:course.quiz.length,at:attemptedAt,answers});
    record.quizHistory=history.slice(-20);
    if(Array.isArray(record.completedLessons) && record.completedLessons.length>=course.lessons.length) record.completedAt=record.completedAt||attemptedAt;
    state[selected]=record;writeCourseState(state);
    feedback.textContent="You scored "+score+" / "+course.quiz.length+". "+course.quiz.map((q,i)=>"Q"+(i+1)+": "+q.why).join(" ");
    render();
    const updated=document.getElementById("tadQuizFeedback");if(updated)updated.textContent="Latest score: "+score+" / "+course.quiz.length+". "+course.quiz.map((q,i)=>"Q"+(i+1)+": "+q.why).join(" ");
  });
  async function loadPublishedCourses(context) {
    courseSupabase = context && context.supabase || null;
    courseUser = context && context.user || null;
    const version = ++publishedLoadVersion;
    if (!courseSupabase || !courseUser) {
      courses = starterCourses.slice();
      render();
      return;
    }
    try {
      const { data, error } = await courseSupabase.from("courses")
        .select("id,title,summary,category,level,duration_minutes,outcomes,lessons,status")
        .eq("status", "published").order("created_at", { ascending: false });
      if (version !== publishedLoadVersion) return;
      if (error) throw error;
      const community = (data || []).map(row => ({
        id: "mentor-" + row.id,
        source: "mentor",
        title: row.title || "Untitled course",
        category: row.category || "Community",
        level: row.level || "Beginner",
        duration: (Number(row.duration_minutes) || 0) + " minutes",
        summary: row.summary || "",
        outcomes: Array.isArray(row.outcomes) ? row.outcomes : [],
        lessons: (Array.isArray(row.lessons) ? row.lessons : []).map(lesson => ({
          title: lesson.title || "Lesson",
          body: Array.isArray(lesson.body) ? lesson.body.map(String) : [String(lesson.body || "")],
          task: lesson.task || ""
        })),
        quiz: []
      }));
      courses = starterCourses.concat(community);
      render();
    } catch (error) {
      if (version !== publishedLoadVersion) return;
      courses = starterCourses.slice();
      render();
      const host = document.getElementById("courseCatalog");
      if (host) host.insertAdjacentHTML("afterbegin", '<p class="muted" role="status">Community courses could not be refreshed. Your starter courses remain available.</p>');
      console.warn("Could not load published courses", error);
    }
  }

  window.addEventListener("tad:authStateChanged", event => loadPublishedCourses(event.detail));
  window.addEventListener("tad:publishedCoursesChanged", () => {
    // Use the latest context received through tad:authStateChanged. The global
    // context can briefly lag during sign-in/sign-out transitions.
    loadPublishedCourses({supabase:courseSupabase,user:courseUser});
  });
  if (window.DESK_AUTH_CONTEXT) loadPublishedCourses(window.DESK_AUTH_CONTEXT);
  window.addEventListener("tad:learningHubLoaded",render);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});else render();
})();