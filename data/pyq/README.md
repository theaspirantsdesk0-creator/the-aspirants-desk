# Verified UPSC Previous-Year Questions

This directory is reserved for official UPSC CSE previous-year questions (2001–2025).

- `questions.json` is the only public data file consumed by the site.
- Add a question only after matching its wording and paper metadata to a primary UPSC document.
- Each published record must include the official source ID, source document URL, year, stage, paper, question number, and verification metadata.
- Keep coaching-institute questions, paraphrases, generated questions, and practice material out of this directory.
- Do not infer or invent answer keys. A question may be published without an answer when UPSC has not officially published one; explanations must be clearly editorial.

Run `python tools/pyq.py validate` before publishing. See `sources.json` for the registered primary source.

## Coverage tracking (2001–2025)

`coverage.json` records the intended Civil Services coverage: Prelims GS I and CSAT; Mains Essay and GS I–IV; and both papers for optional subjects, including literature optionals. These are coverage targets, not assertions that every historical PDF has been located or transcribed.

Use the current and archived UPSC indexes recorded in the file. For each paper, record its exact official document URL and verification evidence before adding question records to `questions.json`. Do not mark a question published merely because a coaching or third-party page reproduces it. Keep practice questions in `data/questions/`.

The curated `verified-documents.json` list currently contains 28 individually checked official UPSC PDFs across the 2020–2025 Civil Services examinations, including both 2020 Prelims papers, including Prelims and Mains. It is intentionally a small verified subset, not a complete archive. The site links to UPSC PDFs rather than republishing complete paper documents. Check applicable reuse/copyright terms before reproducing question text. Any editorial explanation must be labelled as editorial, not an official UPSC answer key.


## Optional-subject coverage

The coverage map enumerates the 25 optional subjects and 23 literature choices in the UPSC Civil Services Examination 2026 notice. The report tracks each choice independently across Optional Paper I and Optional Paper II for every year in scope. This catalog is based on the current official notice and must be reviewed against the relevant year's notice when historical coverage is built.

For optional-subject records, use the exact canonical name in `optional_subject` and use `Optional Paper I` or `Optional Paper II` in `paper`. This produces separate Anthropology and literature coverage rather than combining all optionals into one total.

## Paper-level official document inventory

`documents.json` is the paper-by-paper discovery tracker for the 2001–2025 target. It contains 2,575 rows: seven common Prelims/Mains papers plus Paper I and Paper II for each of the 48 optional and literature choices, for every year.

All rows intentionally begin as `not_checked`. The official UPSC current and archived index pages are recorded as discovery starting points, not as proof that a particular PDF exists. Add a direct PDF URL only after locating the exact year, exam, subject, and paper in an official UPSC index. Move a row to `verified` only after opening the PDF and checking those details; add the title, verification date, and method at the same time. Use `published` only after the corresponding verified material is actually available in the site.

The current public UPSC index lists recent Civil Services Mains papers, while the archive index exposes older examination entries. Historical paper availability must therefore be checked year by year; never extrapolate a current subject list to earlier years. The tracker is not a claim that 2,575 PDFs are available.

The static quality check validates inventory size, unique IDs, status values, and the rule that direct document links require verification metadata.


## 2025 official-source discovery

`2025-source-discovery.json` records the official UPSC index links located for 2025 Prelims GS I and CSAT, Mains Essay and GS I–IV, and Anthropology Papers I–II. These entries are `source_found` only: the index listing identifies the documents, but each PDF still needs content-level inspection before question transcription or publication. A listed PDF is not a verified question record, and this manifest is not loaded into the public question bank. The 2025 Prelims PDFs are large; where automated inspection cannot retrieve them, use a controlled PDF review step rather than substituting third-party reproductions.

## Supabase publication path

The site reads the static, source-verified `questions.json` archive and also queries `public.pyq_questions` for live records. A database row is displayed only when both `is_published` and `source_verified` are true and `source_reference` is a direct HTTPS URL on `upsc.gov.in` or `www.upsc.gov.in`. Database answer keys remain separately permissioned; the public question view does not expose the admin-only answer-key table.

The database includes `question_number`, `source_verified_at`, and `source_verification_method` for auditability. Publishing is guarded by a database check requiring a non-empty question number, verification timestamp, verification method, and a verified UPSC-hosted source URL. Add and review question records through the authenticated admin workflow; never set publication flags to bypass source review. The public site does not treat generated or coaching questions as official PYQs.
