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

## Setup
1. Create a Supabase project at https://supabase.com/.
2. In Supabase, open SQL Editor > New query. Paste and run `supabase-schema.sql`.
3. Open Project Settings > API (or API Keys). Copy the Project URL and the publishable/anon public key.
4. Put those two values in `config.js`. Do not use a `service_role` or secret key in the browser.
5. Create your learner account on the website and confirm your email if Supabase requests it.
6. In Supabase > Authentication > Users, copy your user UUID.
7. In SQL Editor run: `update public.profiles set role='admin' where id='YOUR-USER-UUID';` Replace the placeholder with your UUID. This gives only your account administrator permissions.
8. Refresh the website and sign in. The Admin desk should appear for your account.

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
- Email confirmation and password reset settings should be configured in Supabase Auth. Add your final GitHub Pages URL to the Supabase Auth allowed redirect URLs.

## Important testing note
The site package is prepared, but cloud functionality cannot be fully live-tested until you create your own Supabase project and enter its URL and public key in `config.js`. The browser-only trackers can be tested immediately by opening `index.html` in a browser. For Supabase sign-in and realtime, use the published HTTPS site rather than opening the file directly.
