# Question bank editorial and publication policy

This directory contains topic-wise practice question data. It is not the official UPSC previous-year-question archive.

## Publication states

- `draft`: content is awaiting factual and editorial verification. It must not be presented as a published question.
- `review`: answer, distractors, explanation, subject mapping and source have been checked by a reviewer but still need final approval.
- `published`: every field has been checked against a traceable, authoritative source and the question is approved for learners.
- `archived`: retained for audit history but excluded from active practice.

A generic `reference_hint` is not proof of verification. Add a traceable `source_url` and, where useful, a `source_title`, `source_section` or page reference. Do not mark content published merely because it has four options and an explanation.

## Required checks before publishing an MCQ

1. Confirm the correct answer against an authoritative primary source or a reliable standard reference.
2. Check that all distractors are plausible but unambiguously incorrect.
3. Confirm that the explanation actually supports the answer and does not contain outdated facts.
4. Check subject, topic and difficulty labels.
5. Check duplicate wording and near-duplicate concepts across all question files.
6. Label original practice questions as practice. Never label them as official UPSC PYQs.
7. For official PYQs, verify exam year, stage, paper and exact wording against the linked UPSC paper. Prefer linking to the official PDF; do not infer an answer key.

## Audit correction — 2026-11-28

Eight topic batch files contained records whose `review_note` explicitly said that the question was a draft and that its answer/explanation still needed verification, while the record status was incorrectly set to `published`. All 309 such records have now been changed to `draft`:

- Economy batch 1: 38
- Environment batch 2: 40
- Geography batch 1: 38
- Indian Society batch 2: 38
- Internal Security batch 2: 40
- Modern History batch 1: 36
- Polity batch 1: 39
- Science batch 2: 40

These records are retained for review and are not certified as factually wrong; their previous publication status was unsupported by their own review notes. They should only be republished after the checks above are completed.


## Human review workflow

The repository includes two helper tools:

- `python tools/question_bank_audit.py` checks JSON structure, duplicate IDs, possible duplicate wording, status values, source URLs, review metadata and publication readiness. Add `--json` for machine-readable output or `--output report.json` to save a report. The GitHub quality workflow uploads this report as the `question-bank-audit` artifact.
- `python tools/question_bank_review.py data/questions/<file>.json --id <question-id> --reviewer "<reviewer>" --source-url "https://..." --check-answer --check-distractors --check-explanation --check-metadata --check-duplicates` records a human review and moves a draft into `review`.
- After a separate final inspection, run the same command again with `--publish` to move a `review` record into `published`.

The five check flags are explicit human attestations, not automated fact checks. The reviewer must open the source, verify that it supports the answer and explanation, inspect distractors and metadata, and search for duplicates. Never run the publish step just to make a question appear in the learner interface. Keep uncertain records in `draft` or `review`.

The audit report flags published records without an HTTPS source, all five recorded checks, reviewer identity/timestamp, or where the review note still says verification is pending. A clean structural audit does not prove factual accuracy.

## Supabase owner review dashboard

The owner-only **Practice Question Review** dashboard is available inside Mock Examinations → Owner · Mock paper publishing. It stores new and reviewed practice questions in `public.practice_question_bank` rather than requiring JSON edits.

- Drafts and review-stage records are visible only to the owner/admin account.
- Learners and anonymous visitors can read published records only.
- The database requires a traceable HTTPS source, source title, reviewer identity/time and all five manual review checks before review or publication.
- Publication requires a separate transition from `review` to `published`; published content must be moved back to draft before its content can be edited.
- Published database records are loaded into the learner-facing practice bank. The official UPSC PYQ archive remains separate.

The checklist records human attestations. It does not independently establish factual accuracy; the reviewer must actually inspect the cited material.

## Version history, activity and bulk import

The live owner dashboard also includes an immutable version timeline and a reviewer activity log. Question content/status changes create a database snapshot and activity event; the owner-only history tables cannot be written directly through the browser API. Archived/deleted question records retain their history reference.

Bulk JSON import accepts an array, or an object with a `questions` or `records` array. It supports the same compact fields used by the topic JSON files (`subject`, `q`, `a`, `w`, `e`, `difficulty`) and expanded names (`question_text`, `correct_answer`, `wrong_options`, `explanation`). Each import is limited to 100 questions. The preview checks every row for required fields, three distinct distractors, supported difficulty, invalid optional HTTPS sources, exact duplicates in the database and within the file, plus high-similarity wording warnings. Invalid and exact-duplicate rows are excluded from import. Similar-wording rows are flagged for manual review but can only enter the bank as drafts. An Excel-friendly CSV review report can be exported before or after importing. Every imported question is saved as a draft, with all five review checks reset to false; input status and reviewer flags are ignored. Exact active duplicates are rejected by a database unique index as a final safeguard.

The version and activity records are retained by database triggers and are readable only by the owner/admin role. They are not exposed to anonymous visitors or learner accounts.

## Official PYQ source

Use the [UPSC Previous Year Question Papers archive](https://www.upsc.gov.in/examinations/previous-question-papers) and its [archived question-paper collection](https://www.upsc.gov.in/archived-exam-documents/question-papers/). The presence of a PDF link in a discovery manifest is only `source_found`; it is not proof that question text has been checked or is ready for publication.
