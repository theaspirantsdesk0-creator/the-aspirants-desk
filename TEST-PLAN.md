# Verification checklist (tick each; keep this as your progress record)

## Stage 4 — Push
- [ ] Hard-refreshed site shows no "missing VAPID key" warning
- [ ] Enable push creates a row in push_subscriptions (enabled=true, timezone Asia/Kolkata)
- [ ] Edge Function log shows a run with sent >= 1 at the reminder time
- [ ] cron.job_run_details status = succeeded; net._http_response status 200
- [ ] Notification arrives with the app CLOSED (Android Chrome, desktop Chrome/Edge)
- [ ] iPhone: installed to Home Screen first, then notification received
- [ ] Disable push removes the row; sign-out removes this device's row

## Stage 5 — Sync matrix (Device A + Device B, same account)
For each: create on A, sync, see on B; edit on B, see on A; delete on A, gone on B.
- [ ] Learning Hub milestones — tick on Device A, confirm on Device B; edit on B and confirm on A
- [ ] Mistake notebook  - [ ] Reading history  - [ ] Answer drafts  - [ ] Study hours & streak
- [ ] Mock/daily test history  - [ ] Revision planner  - [ ] Goals/settings
- [ ] Offline edit on A, reconnect: nothing lost
- [ ] Same item edited on both while offline: result is predictable and documented
- [ ] Sign out and in as a DIFFERENT account on one device: no data from the first account appears

## Stage 6 — PYQ
- [ ] Coverage report shows no missing years 2001-2025 (Prelims GS I, CSAT, Mains Essay, GS I-IV, optionals)
- [ ] Every published row has source_reference and source_verified = true
- [ ] Learner cannot SELECT pyq_answer_keys directly; get_pyq_answer works

## Stage 7 — Current affairs
- [ ] Workflow runs daily (Actions tab green) and new English items appear
- [ ] Each item has source link, date, review status

## Stage 8 — Security
- [ ] 03-security-tests.sql: every "must_be_0" is 0
- [ ] Owner row in profiles has role='admin'; a second test account has no Admin desk
- [ ] Learner cannot insert into updates/notes/press/pyq_questions
- [ ] Password reset, sign-out, account deletion tested

## Stage 9 — Launch
- [ ] Lighthouse (mobile) Performance / Accessibility / SEO / PWA reviewed
- [ ] Install + offline + update behaviour after a new sw.js version
- [ ] Chrome, Edge, Firefox, Safari (iOS) pass
- [ ] Backup of index.html, config.js, sw.js, manifest, SQL taken
- [ ] sitemap.xml lists more than the home page; Search Console indexing checked


## Mentor course authoring and owner review
- Sign in with an account whose database profile role is `mentor`; confirm Course Studio is visible and learner/guest accounts cannot see it.
- Create a draft with a title, summary, outcomes and at least one lesson; confirm it appears only in the mentor's course list.
- Submit the draft for review; confirm the mentor can no longer edit it while it is pending.
- Sign in as the site owner; confirm the pending course appears in the review queue.
- Publish the course; confirm it appears in the learner-facing Published community courses catalogue.
- Reject a second test course with a review note; confirm the mentor can edit the rejected draft and resubmit it.
- Verify that a learner cannot insert or update course records, and a mentor cannot publish or edit another mentor's course.
- Confirm course data is still protected by Supabase RLS and the course table has no anonymous grants.
- The database RLS workflow was tested in a rolled-back transaction using a temporary mentor role; no test course or role change was retained.
