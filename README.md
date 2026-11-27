# The Aspirant's Desk — publishing package

This package contains the original site design, repaired local tools, and a Supabase backend integration for accounts and shared features.

## What works locally without an account
- Study-hour tracker (daily entries, 7-day chart, totals and streak)
- Mock-test tracker (scores, average, best and latest result)
- Revision planner (1, 3, 7, 21 and 45-day review cycle)
- Daily learning notes and answer-writing archive
- Mentor/network list and the other browser-based preferences

Local data is stored in the browser. Sign in after configuring Supabase to synchronise your study data privately to your account across devices.

## What needs Supabase configuration
- Learner sign-up, email confirmation, sign-in and sign-out
- Private learner data synchronisation
- Shared aggregate progress dashboard (administrator only)
- Live state notifications and real-time refresh
- Admin publishing/deleting of updates, subject notes, daily press and PIB items
- Administrator-only private notes

## Supabase setup and operations

**Important:** `supabase-schema.sql` is an older initial setup script and is not a complete bootstrap for the current release. Do not paste it over an existing live project. The current database also contains PYQ, answer-key, push-subscription and test-history tables that were added after that initial file was written.

For the existing production project:
- The database hardening migrations are recorded in `supabase/migrations/`:
  - `20261121135933_harden_profiles_signup_and_rls.sql`
  - `20261121140048_move_security_helpers_to_private_schema.sql`
- These two migrations have already been applied to the existing `theaspirantsdesk` Supabase project. Do not apply them a second time manually.
- The `public.test_results` table already exists. Do not run a separate table-creation script for it.
- Keep the active `desk_on_auth_user_created` trigger. The obsolete duplicate signup trigger was removed.
- The admin-check and answer-key helper functions live in the non-API `private` schema. Do not move them back to `public` or grant them to `anon`.

For a future fresh Supabase project, first take a schema backup and create a reviewed, complete baseline from the current live database before applying migrations. Do not assume the legacy `supabase-schema.sql` file alone creates every table in the current application.

## Browser configuration
1. Open Project Settings > API (or API Keys). Use the Project URL and publishable key (legacy anon key is supported for compatibility).
2. Put only those public values in `config.js`. The VAPID **public** key may also be in `config.js`.
3. Never place a Supabase service-role/secret key, database password, cron secret, or VAPID **private** key in browser code or GitHub-tracked files.

## Password recovery and redirect configuration

The sign-in dialog includes a **Forgot password?** flow. A learner enters the account email, receives Supabase's recovery email, opens the link on the published site, and sets a new password with confirmation. The browser flow uses Supabase `resetPasswordForEmail`, listens for the `PASSWORD_RECOVERY` auth event, and saves the new password with `updateUser`. Passwords and recovery tokens must never be pasted into support chats or committed to the repository.

**Required one-time Supabase Dashboard setting:** open Authentication > URL Configuration and add this exact URL under **Redirect URLs**:

`https://theaspirantsdesk0-creator.github.io/the-aspirants-desk/`

Keep the Site URL set to the canonical published site. If a custom domain is introduced later, add its exact recovery redirect URL too. The application code cannot override Supabase's redirect allow-list. Real email delivery and the full recovery round trip still require a real account and must be tested from the published HTTPS site.

## Accounts and administrator access
- Create learner accounts through the website and confirm email if Supabase requests it.
- Administrator roles are stored in `public.profiles`. Do not expose a public admin-registration form.
- Learners can update their own display name but cannot change their own `role` column.
- The admin dashboard can read learner progress summaries; private learner state remains restricted by RLS.

## Remaining dashboard / owner-only security checks

- **Leaked-password protection:** Supabase Security Advisor currently reports this as the one remaining security warning. It can be enabled in the project's Authentication password-security settings if the subscription plan supports it. Supabase documents this protection as available on the Pro plan and above. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security).
- **Future object default grants:** the current database tool was not authorised to change the default ACLs owned by the database roles. This does not change the current tables: all 14 public tables have RLS enabled and the existing grants/policies have been tightened. Optional SQL for the project owner to review and run is in `supabase/manual/secure-public-default-privileges.sql`. Do not try to bypass a permission error.

## Current deployment notes (27 November 2026)

The current production project has the following deployed Edge Functions:
- `ai-assistant`: version 48 (JWT verification enabled).
- `send-study-reminders`: version 8 (called by the active scheduled job).
- `send-test-study-notification`: version 4 (JWT verification enabled).

The mock examination database currently contains 10 published papers and 320 active questions. The live `pyq_questions` table currently contains one draft and zero published records. The verified official-PDF catalogue is a small, curated subset; the paper-level inventory is a discovery tracker, not proof that every historical paper has been located. Never fill the public PYQ bank with generated or third-party questions.

Supabase security review:
- The two public `SECURITY DEFINER` RPCs used for mock practice and submission require authentication, verify the current user's identity/attempt ownership, and are executable by `authenticated` but not `anon`. Their definer privileges are intentional for the protected database operations; review their function bodies before changing grants.
- The private `ai_daily_usage` table has RLS enabled without policies and remains inaccessible through the public API; retain that private boundary.
- Enable leaked-password protection in Supabase Auth when available for the project's plan.

Provider generation, cross-device user flows, and push delivery must be verified with real signed-in sessions and a registered browser device. Do not describe deployment or an HTTP 2xx response as proof of end-user delivery.

## Daily push reminders
- The `send-study-reminders` Edge Function is deployed as version 8 and is called by an active `pg_cron` job.
- The `send-test-study-notification` Edge Function is deployed as version 4. A successful function invocation alone does not prove a device received a notification; verify with a registered browser subscription.
- The `ai-assistant` Edge Function is deployed as version 48 with JWT verification enabled. Gemini 2.5 Flash is the primary provider and Groq is an optional fallback. The live provider secret must be configured in Supabase Edge Function secrets; deployment does not prove that Gemini generation works.
- The AI Mains evaluator derives the final practice mark from its five rubric scores (each out of four), then scales that total to the requested question marks. Feedback remains formative and is not an official UPSC score.
- The authentication listener in `index.html` schedules learner-data refresh outside the synchronous Supabase auth callback to avoid refresh-lock deadlocks.
- Sign-in and sign-up preserve the exact password entered (including intentional leading/trailing spaces). Sign-out is scoped to the current browser/device so it does not unexpectedly log the learner out elsewhere. If local session removal fails, the signed-in state is retained; a remote revocation warning is logged when the local session has already been cleared.
- The service-worker cache version is `desk-v51-auth-session-safety`.
- The browser subscribes from the Dashboard's **Daily study reminder** card after a learner signs in and grants browser notification permission.
- Each browser/device needs its own subscription. Reminders are sent at the selected local time and are skipped when the account has saved study activity that day.
- The VAPID private key and cron secret must remain in Supabase Edge Function secrets. Never commit them.


## Publish on GitHub Pages
- Extract the ZIP.
- Upload the CONTENTS of this folder to the root of a GitHub repository (so `index.html` is at the repository root, not one folder deeper).
- Commit the files.
- In repository Settings > Pages, choose Deploy from a branch, `main`, and `/(root)`, then Save.
- Wait for GitHub Pages to finish deploying. The URL appears in Settings > Pages.

## Security and privacy notes
- Supabase Row Level Security is enabled by the SQL setup. Learners can read/write only their own private study data. The admin can read aggregate progress summaries, but not learner personal notes or written answers.
- Public visitors can read published notices, study notes, press and PIB posts. Only an administrator can publish or delete them.
- Keep `config.js` restricted to the project URL and public anon/publishable key. Never put a service-role key, database password, or other secret in the website.
- Before making the website public, review the About and Connect sections and remove any personal details you do not want publicly visible.
- Email confirmation and password reset settings should be configured in Supabase Auth. The exact recovery redirect URL is documented in the Password recovery section above.

## Important testing note
The site package is prepared, but cloud functionality cannot be fully live-tested until you create your own Supabase project and enter its URL and public key in `config.js`. The browser-only trackers can be tested immediately by opening `index.html` in a browser. For Supabase sign-in and realtime, use the published HTTPS site rather than opening the file directly.


## Official PYQ publication status

The official PYQ view now merges the static verified archive with live Supabase rows from `public.pyq_questions`. Only records explicitly marked published and source-verified, with a direct HTTPS UPSC-hosted PDF URL and complete question-level verification evidence, are eligible for display. The database publication constraint requires a question number, verification timestamp, verification method, and official UPSC source URL. The admin-only answer-key table is not exposed to ordinary learners.

Current database audit: **0 published PYQ records**. The existing draft test record remains unpublished and unverified. No generated or coaching questions have been promoted as official UPSC PYQs. Coverage targets remain a planning inventory, not a claim of completed transcription.

The PYQ UI and publication rules are checked by the project quality workflow. Latest service-worker shell version: `desk-v51-auth-session-safety`.
