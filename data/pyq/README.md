# Verified UPSC Previous-Year Questions

This directory is reserved for official UPSC CSE previous-year questions (2001–2025).

- `questions.json` is the only public data file consumed by the site.
- Add a question only after matching its wording and paper metadata to a primary UPSC document.
- Each published record must include the official source ID, source document URL, year, stage, paper, question number, and verification metadata.
- Keep coaching-institute questions, paraphrases, generated questions, and practice material out of this directory.
- Do not infer or invent answer keys. A question may be published without an answer when UPSC has not officially published one; explanations must be clearly editorial.

Run `python tools/pyq.py validate` before publishing. See `sources.json` for the registered primary source.