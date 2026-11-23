UPSC subject-wise question bank.

## Question-bank audit

Run the read-only audit before publishing content:

```bash
python tools/question_bank_audit.py
```

It reports question totals by file, subject, difficulty, and publication status; flags structural problems and duplicate IDs; and identifies missing or non-standard difficulty labels as warnings. It does not create or rewrite questions and does not assume that a subject is complete based on a target number.

For the official archive, run:

```bash
python tools/pyq.py --report
```

That report counts only verified published records. A non-zero count does not mean an entire PDF/paper has been fully transcribed or checked.
