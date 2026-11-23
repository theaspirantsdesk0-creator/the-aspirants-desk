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

The site links to UPSC PDFs rather than republishing complete paper documents. Check applicable reuse/copyright terms before reproducing question text. Any editorial explanation must be labelled as editorial, not an official UPSC answer key.

