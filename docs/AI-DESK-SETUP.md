# AI Desk setup and operating guide

The AI Desk adds a role-aware assistant to The Aspirant's Desk.

## Included

- Floating AI Desk widget in the static GitHub Pages frontend.
- Supabase Edge Function `ai-assistant`; browser code never receives provider API keys.
- Server-side account authentication and role lookup from `public.profiles`.
- Learner, mentor and admin prompt modes.
- A 20-message-per-user-per-UTC-day quota enforced in a private schema.
- Gemini-first provider selection and Groq fallback for Gemini HTTP 429 or 5xx responses.
- AI-generated MCQs use the site's question JSON fields and are explicitly drafts, not approved/published questions.

## Required provider secrets

Open Supabase Dashboard → Project `theaspirantsdesk` → Edge Functions → Secrets. Add at least one provider key:

- `GEMINI_API_KEY` — recommended primary provider key.
- `GROQ_API_KEY` — optional fallback provider key.
- `GEMINI_MODEL` — optional; default `gemini-2.5-flash`.
- `GROQ_MODEL` — optional; default `llama-3.3-70b-versatile`.

The Supabase runtime supplies the project's Supabase URL and server keys. Do not put provider keys, service-role keys, or private keys in `index.html`, `config.js`, GitHub commits, or browser storage.

The app can be used with one configured provider. With both configured, Gemini is tried first and Groq is used when Gemini returns a rate-limit (429) or server (5xx) response. A provider's free quota, model availability, age/region eligibility, and terms are controlled by that provider and may change. This code does not guarantee $0 usage or a permanent free tier.

## Daily PIB automation secrets

The scheduled PIB workflow is separate from the chat Edge Function and reads GitHub Actions repository secrets. Open the repository's Settings → Secrets and variables → Actions and add:

- `GEMINI_API_KEY` — optional primary provider for PIB explanations.
- `GROQ_API_KEY` — optional fallback provider.

These are separate secret stores: add the same provider keys to Supabase Edge Function Secrets for interactive AI Desk chat, and to GitHub Actions secrets for scheduled PIB explanations. Do not put either key in `config.js`, `index.html`, or a committed workflow file. If no GitHub Actions key is configured, the PIB updater still saves official headlines and source links but leaves the AI explanation fields at their safe fallback text.

## Role assignment

New accounts default to `learner`. The current administrator account was checked and is already assigned `admin`.

To assign a trusted, approved mentor account, use Supabase SQL Editor as the project owner and substitute the mentor account's email address locally:

```sql
UPDATE public.profiles
SET role = 'mentor'
WHERE id = (
  SELECT id FROM auth.users
  WHERE lower(email) = lower('MENTOR_ACCOUNT_EMAIL')
);
```

The `role` column cannot be changed by normal authenticated browser requests. Do not grant mentor/admin roles to untrusted accounts. The assistant verifies the role from the database on every request; it does not trust a role supplied by the browser.

## Daily quota

The quota is 20 messages per account per UTC calendar day. Usage is stored in `private.ai_daily_usage`; ordinary authenticated users cannot read or modify this table. Requests made while no provider key is configured do not consume quota.

## What each mode does

- Learner: explanations, study planning, revision priorities based on available saved study-state/test summaries, and formative answer feedback.
- Mentor: study plans and feedback based on de-identified progress summaries explicitly supplied in the chat. This first release does not let mentors browse other learners' private accounts.
- Admin: drafts MCQs in the repository's `id, subject, difficulty, q, a, w, e, status, reference_hint, review_note` format, chapter notes and source-based UPSC angles. It does not publish or commit content.

AI responses can be wrong. Verify all factual claims, official PYQs, answer keys and references before publication. Do not submit names, email addresses, passwords, confidential learner records or other personal information.

## Local development

The widget is loaded by `index.html` from:

- `assets/css/ai-desk.css`
- `assets/js/ai-desk.js`

The Edge Function source is `supabase/functions/ai-assistant/index.ts`. The database migration files are under `supabase/migrations/`.

The production website is not updated until the pull request is reviewed and merged and GitHub Pages finishes deploying. After deployment, sign in with each test role and check the browser console and the Edge Function logs. Verify quota exhaustion and provider fallback with test accounts before inviting learners.

## Known limitations in this first release

- The assistant now retrieves a small set of relevant published question-bank records and matching entries from `data/current-affairs.json` and `data/pib.json` for each request. Retrieval uses topic keywords, caches public source files for five minutes per warm Edge Function instance, and is not a full-text search engine; it does not yet index every lesson, textbook, library document, PDF or all UPSC official PYQ papers. Supply source text when a topic is not found.
- Learner context is limited to a de-identified study-state summary and the five most recent test-result records available in the current schema. Missing or differently named fields are omitted; the assistant should not infer absent progress data.
- Mentor-to-learner private progress access and automated content publishing are intentionally not enabled.


## Anbuu personal mentor

The learner experience is branded as Anbuu and adds a structured teaching workflow:

- Summarises multiple doubts before teaching, asks for clarification only when necessary, and teaches in short stages with understanding checks.
- Builds realistic study plans and assigns 1–3 manageable tasks.
- Opens a fresh session by referring to the learner's saved pending tasks.
- Provides three chat shortcuts: make a study plan, summarise doubts, and give today's tasks.
- Shows the active plan, pending/completed tasks, and recurring doubts in a progress sidebar.

### Persistent state and privacy

The private table `private.anbuu_mentor_state` stores one row per learner: `active_study_plan`, `doubt_log`, `pending_tasks`, and `updated_at`. It is deliberately in the non-exposed `private` schema. Browser clients cannot read or write it directly. The authenticated `ai-assistant` Edge Function verifies the caller, checks the database-assigned role, and uses the caller's user ID for all state reads and writes. The UI receives only that learner's state. Task completion is saved immediately.

The model emits a machine-readable state block that the Edge Function validates and strips before returning the visible answer. Invalid or missing state blocks are ignored; existing saved state is retained. Do not place learner names or contact details in doubt logs or task descriptions.

### Smoke test

1. Sign in with a learner account and open Anbuu. Confirm the saved state loads and the welcome message reflects pending tasks.
2. Use **Make Me a Study Plan** and complete a plan. Confirm it appears in the sidebar.
3. Ask two related questions. Confirm Anbuu summarises the doubts before explaining.
4. Ask for today's tasks. Mark one task complete and reload the page; confirm its completed status persists.
5. Sign out and sign in as a different learner test account. Confirm the first learner's plan, tasks, and doubts are not visible.
6. Confirm mentor/admin roles still receive their existing role-specific assistant and do not receive learner state.

The provider free-tier limits and model availability are controlled by the provider; a permanent $0 operating cost is not guaranteed.
