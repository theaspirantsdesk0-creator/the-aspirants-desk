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
