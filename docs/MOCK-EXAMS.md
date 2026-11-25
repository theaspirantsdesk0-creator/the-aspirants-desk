# Full-length mock examinations

The Mock Examinations workspace is available from the learner sidebar. It uses the existing Supabase sign-in and role model.

## Paper catalogue

The workspace reserves these full-length UPSC formats:

| Paper | Questions | Duration | Marks |
|---|---:|---:|---:|
| Prelims GS Paper I | 100 | 120 minutes | 200 |
| Prelims CSAT Paper II | 80 | 120 minutes | 200 |
| Mains GS I, II, III and IV | 20 each | 180 minutes | 250 each |
| Anthropology Paper I and II | 20 each | 180 minutes | 250 each |

A paper is not available to learners until an owner/admin imports and publishes its question set. This prevents placeholder or unverified questions from being presented as a finished mock exam.

## Owner import format

Open **Owner · Mock paper publishing** and paste a JSON object:

```json
{
  "code": "UPSC-PRELIMS-GS1",
  "title": "UPSC Prelims GS Paper I · Mock 01",
  "exam_stage": "prelims",
  "paper_type": "GS Paper I",
  "duration_minutes": 120,
  "total_marks": 200,
  "optional_subject": null,
  "sections": [
    { "key": "history", "title": "History", "duration_minutes": 20 }
  ],
  "questions": [
    {
      "section_key": "history",
      "question_no": 1,
      "question_type": "mcq",
      "prompt": "Insert a reviewed question here.",
      "options": [
        { "key": "A", "text": "Option A" },
        { "key": "B", "text": "Option B" },
        { "key": "C", "text": "Option C" },
        { "key": "D", "text": "Option D" }
      ],
      "correct_answer": "A",
      "explanation": "Explain why A is correct, including the relevant concept.",
      "source": "Original practice question",
      "marks": 2,
      "negative_marks": 0.66
    }
  ]
}
```

For Mains, use `"question_type": "written"`, provide a `word_limit`, `marks`, a `source` provenance note, and a `rubric` array with at least two criteria. A `model_answer` may be included for later review. For MCQs, provide exactly four non-empty A–D options, a valid `correct_answer`, an explanation of at least 20 characters, and a `source` note. Use `"source": "Original practice question"` for newly authored practice questions; for an official PYQ, cite the official exam/year or a reliable primary source. The importer validates all question data before replacing an existing paper, and publishing checks answer keys, explanations, provenance and written rubrics. A matching full-length paper code must contain its required question count. Written answers are stored, but are not automatically graded.

For Anthropology papers set `optional_subject` to `"Anthropology"`. Learner visibility follows the optional subject saved in their profile data. Do not mark a paper published until its question count matches the full-length format and every MCQ has a non-empty answer key.

## Learner features

- One paper countdown, with automatic submission at expiry.
- Question palette, previous/next navigation, answer state and review flags.
- Autosave to the learner's Supabase attempt and a local recovery draft.
- Resume unfinished attempts after signing in again.
- Objective scoring is calculated server-side. Answer keys are stored in a separate admin-only table and are not returned with learner questions.
- Section-wise objective score, correct, incorrect and unanswered counts.
- Written responses are preserved for rubric-based review; no automatic marks are claimed.

## Data and access control

- `mock_exam_papers`: paper metadata and publication state.
- `mock_exam_questions`: learner-visible prompts/options and owner-managed question content.
- `mock_exam_answer_keys`: owner/admin-only answer keys, explanations and model answers.
- `mock_exam_attempts`: per-user saved answers, timer expiry, review flags and final analytics.
- RLS restricts attempts to their owner (plus owner/admin oversight). Only published papers can be attempted.
- `public.submit_mock_exam` checks the authenticated user's attempt and calculates objective marks server-side.

The exam engine and secure publishing path are in place. Individual full-length papers are made available only after their complete question set and answer-key/rubric checks pass. Section metadata is retained for section-level grouping and reporting; independent section countdown/locking remains a follow-up enhancement.


## Published full-length paper

**UPSC Mains · Anthropology Paper I · Full-Length Mock 01** is now published for eligible learner accounts that have selected Anthropology as their optional subject. It contains 20 original written practice questions, a 3-hour timer, 250 total marks, 10 questions carrying 10 marks and 10 questions carrying 15 marks. Each question includes a marking rubric and a model-answer outline for review. These are original practice questions, not official UPSC previous-year questions. Written responses are saved but are not automatically graded; the rubric and model outline are reference material for self-review or mentor feedback.

The full-length Prelims GS Paper I is also published as a 100-question, 120-minute, 200-mark original practice mock. Its questions cover Indian Polity and Constitution, Modern Indian History, Geography, Economy and Environment/Ecology. Each item has four options, an answer key, an explanation and a provenance note. This is original practice material, not an official UPSC PYQ bank.


## Published full-length Prelims GS Paper I

**UPSC Prelims · General Studies Paper I** is now published as a 100-question, 120-minute, 200-mark original practice mock. It contains four-option MCQs across Indian Polity and Constitution, Modern Indian History, Geography, Economy and Environment/Ecology. Each item has an answer key, an explanatory note and a source/provenance note. The scoring configuration awards 2 marks for a correct answer and deducts 0.67 marks for an incorrect answer (the one-third penalty rounded to the database's two-decimal precision). Unattempted questions receive no penalty. These are original practice questions, not official UPSC previous-year questions.


## Published full-length CSAT Paper II

**UPSC Prelims · CSAT Paper II** is published as an 80-question, 120-minute, 200-mark original practice mock. It contains four sections of 20 questions each: reading comprehension, logical reasoning and analytical ability, basic numeracy, and data interpretation. Each question has four options, an answer key and an explanatory note. The scoring configuration is 2.5 marks for a correct answer and 0.83 marks deducted for an incorrect answer (the one-third penalty rounded to two decimal places); unanswered questions receive no penalty. These are original practice questions, not official UPSC previous-year questions.


## Published full-length Mains GS Paper I

**UPSC Mains · General Studies Paper I · Full-Length Mock 01** is published as a 20-question, 180-minute, 250-mark original written practice paper. It contains 10 questions carrying 10 marks and 10 questions carrying 15 marks, arranged across two sections: Indian Heritage, Culture and History; and Indian Society and Geography. Every question includes a marking rubric and a model-answer outline for self-review. Written answers are saved for review and are not automatically awarded marks. These are original practice questions, not official UPSC previous-year questions.


## Published full-length Mains GS Paper II

**UPSC Mains · General Studies Paper II · Full-Length Mock 01** is published as a 20-question, 180-minute, 250-mark original written practice paper. It contains 10 questions carrying 10 marks and 10 questions carrying 15 marks across two sections: Constitution, polity and governance; and social justice and international relations. Every question includes a marking rubric and a model-answer outline for self-review. Written answers are saved for review and are not automatically awarded marks. These are original practice questions, not official UPSC previous-year questions.


## Published full-length Mains GS Paper III

**UPSC Mains · General Studies Paper III · Full-Length Mock 01** is published as a 20-question, 180-minute, 250-mark original written practice paper. It contains 10 questions carrying 10 marks and 10 questions carrying 15 marks across two sections: Economy, agriculture and science & technology; and environment, disaster management and internal security. Every question includes a marking rubric and a model-answer outline for self-review. Written answers are saved for review and are not automatically awarded marks. These are original practice questions, not official UPSC previous-year questions.


## Published full-length Mains GS Paper IV

**UPSC Mains · General Studies Paper IV · Full-Length Mock 01** is published as a 20-question, 180-minute, 250-mark original written practice paper. It contains 10 questions carrying 10 marks and 10 questions carrying 15 marks across two sections: ethics, attitude, aptitude, emotional intelligence and probity; and applied ethics and case studies. Every question includes a marking rubric and model-answer outline. Written answers require review and are not automatically awarded marks. These are original practice questions, not official UPSC previous-year questions.


## Published full-length Anthropology Paper II

**UPSC Mains · Anthropology Paper II · Full-Length Mock 01** is published as a 20-question, 180-minute, 250-mark original written practice paper, available to learners whose selected optional subject is Anthropology. It contains 10 questions carrying 10 marks and 10 questions carrying 15 marks across two sections: Indian culture, society and social institutions; and tribal communities, social change and applied anthropology. Every question includes a marking rubric and model-answer outline. Written answers are not automatically awarded marks. These are original practice questions, not official UPSC previous-year questions.


## Learner mock performance analytics

The mock examination workspace includes a private performance panel for the signed-in account. It summarises completed and expired attempts, separates Prelims, Mains GS and Anthropology optional papers, reports average objective accuracy only where MCQ analytics exist, and identifies weaker objective sections from recorded correct/wrong counts. Written responses are explicitly labelled as requiring separate rubric-based review; they are not treated as zero-scored answers or automatically graded. The report reads only attempts filtered by the current authenticated user and can be refreshed. A learner-facing end-to-end test with real submitted attempts is still required.


## Anbuu evaluation for submitted Mains mock answers

After submitting a written mock examination, learners can request a separate Anbuu evaluation for each answered written question. The workflow sends the question, response, paper/section context, marks and word limit to the existing authenticated Mains evaluation action, then saves the returned rubric feedback to that learner's private answer-evaluation history. Supported full-length Mains formats are 10 marks/150 words and 15 marks/250 words. Empty or very short answers are not sent. Each evaluation uses the learner's daily AI allowance and requires the site AI provider to be configured. Estimates are formative learning feedback, not official UPSC marks; objective mock scores remain separate. A real learner attempt and provider-backed evaluation are still required for end-to-end validation.


## Mock improvement tracker

The private performance panel compares the two most recent completed attempts for each paper using objective accuracy derived from correct and incorrect MCQ counts. It also compares the two most recent saved formative AI estimates for matching subject/section labels when both use the same maximum mark. It reads the signed-in learner's own mock attempts and their own answer-evaluation history. Comparisons are descriptive and should be interpreted alongside question difficulty and attempt conditions; they do not establish mastery or predict UPSC results. At least two completed attempts or two saved evaluations in the same comparison group are needed.


## Personalised UPSC Study Command Centre

The home dashboard now provides a private summary of the signed-in learner's saved study hours, selected-exam syllabus checklist, due spaced-revision topics, topic mastery, optional-subject selection, saved answer evaluations and recent completed mock attempts. It derives revision priorities from overdue scheduled topics and the weakest recorded objective section where attempt analytics exist. It links to the relevant study modules and refreshes when the learner's study state is saved or when manually requested. Mock attempt data is queried with the authenticated user ID filter. The dashboard does not invent progress: missing records are shown as zero or not yet recorded. Live multi-account/browser testing remains necessary.


## Adaptive Daily UPSC Learning Engine

The Anbuu daily-plan workflow now accepts a 90-, 120-, 150- or 180-minute study window and a Tamil + English, English or Tamil response preference. It receives a limited, current-account study context from the home command centre: selected exam and optional subject, syllabus checklist progress, topic mastery counts, due spaced-revision topics, recent mock-attempt count and weakest recorded objective section, plus the existing Anbuu evidence for mistakes, answer feedback, lessons and pending tasks. The prompt directs Anbuu to prioritise evidence-backed needs, fit the chosen duration, avoid adding an unselected optional, avoid duplicating tasks, and save only through the existing server-confirmed plan/task workflow. The context is cleared in guest mode. The browser-side integration and syntax are checked; provider-backed plan generation and real account task persistence still require a configured AI provider and learner test.


## UPSC Learning Intelligence Dashboard

The Study Command Centre includes a topic mastery heatmap for the selected exam, a seven-day study-hours chart, a consecutive-day study streak, and a seven-day revision outlook. Mastery tiles read only saved topic statuses; untracked topics remain neutral. Streak and weekly activity use dated session records (`dateKey`). Older sessions containing only a time are excluded rather than assigned guessed dates. New study logs store the local calendar date. Revision outlook uses saved `topicRevisionSchedule.dueAt` dates. The report is account-scoped and does not predict exam scores. Browser interaction and multi-account testing remain necessary.


## Personalised UPSC Weekly Review System

The Study Command Centre now includes a seven-day review. It reads dated study sessions from the signed-in user's saved state, completed/expired mock attempts filtered by `user_id`, available objective scores and section breakdowns, saved answer evaluations, the selected exam's unfinished syllabus areas, and due spaced-revision records. The review displays dated answer evaluations only when a record contains a usable timestamp; otherwise it reports the total saved count and states that weekly dates are unavailable. Mock averages are shown only for attempts with a positive maximum score. Suggested priorities are generated from observed due revisions, recorded weak sections, incomplete syllabus areas, and missing dated answer-evaluation activity. It is a descriptive study aid, not an official UPSC assessment. Browser and real-user validation remain required.


## Weakness-to-Mastery Engine

The Study Command Centre now includes a learner-scoped improvement queue built from saved mistake notebook records, active topic revision schedules, topic mastery statuses, and saved Mains evaluation feedback. Topic-tagged mistakes are grouped by topic and sorted by frequency. Learners can self-mark a queue topic as practised or schedule a one-day revision reminder; these actions use the existing user-state save/sync path. Exact syllabus-topic matches link back to the preparation tracker; unrecognised tags are not silently mapped to unrelated syllabus topics. The system does not automatically infer mastery or generate new questions, and the learner's practice status is self-assessed. Browser and multi-account validation remain required.


## Smart Topic Practice Generator

The Mock Examinations workspace includes a focused MCQ practice builder using active questions from published papers. Learners select a paper, its available section, and a set size (5, 10, or 15); the app randomises a subset, runs a one-minute-per-question practice timer, and requests each answer check through the authenticated `check_published_practice_answer` RPC. The RPC returns the correct answer and explanation only after an answer is submitted; the browser never selects the answer-key table directly. Practice results are saved into the learner's existing `user_data.payload` state through the current state-save path. Accuracy below 70% schedules a one-day revision item. These are practice questions from published mock papers, not newly generated or asserted official PYQs. A provider API key is not needed. Real signed-in browser interaction and cross-device sync still need end-to-end testing.
