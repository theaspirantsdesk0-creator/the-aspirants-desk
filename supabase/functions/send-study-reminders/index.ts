import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type PushRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  reminder_time: string;
  enabled: boolean;
  last_sent_local_date: string | null;
};

type UserDataRow = {
  user_id: string;
  payload: Record<string, unknown> | null;
  updated_at: string | null;
};

type MentorStateRow = {
  user_id: string;
  pending_tasks: unknown[] | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const cronSecret = Deno.env.get("DESK_CRON_SECRET") ?? "";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:theaspirantsdesk0@gmail.com";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function zonedParts(timezone: string, now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function safeZonedParts(timezone: string, now = new Date()) {
  try {
    return zonedParts(timezone || "Asia/Kolkata", now);
  } catch {
    return zonedParts("Asia/Kolkata", now);
  }
}

/*
 * The current website saves its study state to public.user_data and refreshes
 * updated_at whenever a study action is saved. Treat a save on the user's
 * current local date as study activity. Keep the legacy checks for older
 * payloads that may still be present in existing accounts.
 */
function studiedToday(row: UserDataRow | null, date: string, timezone: string): boolean {
  if (!row) return false;

  if (row.updated_at) {
    const updated = new Date(row.updated_at);
    if (!Number.isNaN(updated.getTime()) && safeZonedParts(timezone, updated).date === date) {
      return true;
    }
  }

  const payload = row.payload;
  if (!payload) return false;

  const hasDate = (key: string, test: (item: Record<string, unknown>) => boolean) => {
    const rows = payload[key];
    return Array.isArray(rows) && rows.some((item) => {
      if (!item || typeof item !== "object") return false;
      const itemRow = item as Record<string, unknown>;
      return itemRow.d === date && test(itemRow);
    });
  };

  const reading = payload["desk-read"];
  const readToday = !!reading && typeof reading === "object" && !Array.isArray(reading)
    && Array.isArray((reading as Record<string, unknown>)[date])
    && ((reading as Record<string, unknown>)[date] as unknown[]).length > 0;

  const mission = payload["desk-mission"] as Record<string, unknown> | null;
  const missionDone = !!mission && mission.d === date && !!mission.done
    && typeof mission.done === "object"
    && Object.values(mission.done as Record<string, unknown>).some(Boolean);

  const drafts = payload["desk-mains-drafts"];
  const savedDraftToday = Array.isArray(drafts) && drafts.some((item) => {
    if (!item || typeof item !== "object") return false;
    const itemRow = item as Record<string, unknown>;
    return itemRow.d === date && typeof itemRow.text === "string" && itemRow.text.trim().length > 0;
  });

  return hasDate("desk-hours", (item) => Number(item.h) > 0)
    || hasDate("desk-dtests", () => true)
    || hasDate("desk-mocks", () => true)
    || hasDate("desk-mockrun", () => true)
    || readToday
    || missionDone
    || savedDraftToday;
}

function dueRevisionCounts(row: MentorStateRow | null, date: string): { due: number; overdue: number } {
  let due = 0;
  let overdue = 0;
  const tasks = Array.isArray(row?.pending_tasks) ? row.pending_tasks : [];
  for (const task of tasks) {
    if (!task || typeof task !== "object" || Array.isArray(task)) continue;
    const item = task as Record<string, unknown>;
    const dueDate = typeof item.due_date === "string" ? item.due_date : "";
    if (item.status !== "pending" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(dueDate)) continue;
    const parsed = new Date(dueDate + "T00:00:00.000Z");
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) continue;
    if (dueDate <= date) {
      due++;
      if (dueDate < date) overdue++;
    }
  }
  return { due, overdue };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "Missing Supabase or VAPID function secrets" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data: subscriptions, error: subError } = await admin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,timezone,reminder_time,enabled,last_sent_local_date")
    .eq("enabled", true)
    .limit(1000);
  if (subError) return json({ error: subError.message }, 500);

  const rows = (subscriptions ?? []) as PushRow[];
  if (!rows.length) return json({ checked: 0, sent: 0, skipped: 0, expired: 0, errors: [] });

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const [{ data: userData, error: dataError }, { data: mentorStates, error: mentorError }] = await Promise.all([
    admin.from("user_data")
      .select("user_id,payload,updated_at")
      .in("user_id", userIds),
    admin.from("anbuu_mentor_state")
      .select("user_id,pending_tasks")
      .in("user_id", userIds),
  ]);
  if (dataError || mentorError) return json({ error: "Could not load reminder activity and revision tasks." }, 500);

  const activityByUser = new Map<string, UserDataRow>();
  for (const row of (userData ?? []) as UserDataRow[]) activityByUser.set(row.user_id, row);
  const mentorStateByUser = new Map<string, MentorStateRow>();
  for (const row of (mentorStates ?? []) as MentorStateRow[]) mentorStateByUser.set(row.user_id, row);

  let sent = 0;
  let skipped = 0;
  let expired = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const local = safeZonedParts(row.timezone);
    const dueAt = String(row.reminder_time || "19:00").slice(0, 5);
    if (local.time < dueAt || row.last_sent_local_date === local.date) {
      skipped++;
      continue;
    }

    const revisions = dueRevisionCounts(mentorStateByUser.get(row.user_id) ?? null, local.date);
    let notification: string;
    if (revisions.due > 0) {
      const dueLabel = revisions.due === 1 ? "1 revision task is due" : `${revisions.due} revision tasks are due`;
      const overdueLabel = revisions.overdue > 0
        ? `, including ${revisions.overdue} overdue`
        : "";
      notification = JSON.stringify({
        title: "Anbuu revision reminder",
        body: `${dueLabel}${overdueLabel}. Open Anbuu's Revision Planner to review them.`,
        url: "./#anbuu",
        tag: "desk-revision-reminder",
      });
    } else {
      if (studiedToday(activityByUser.get(row.user_id) ?? null, local.date, row.timezone)) {
        const { error } = await admin.from("push_subscriptions")
          .update({ last_sent_local_date: local.date, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (error) errors.push(`activity-mark:${row.id}:${error.message}`);
        skipped++;
        continue;
      }
      notification = JSON.stringify({
        title: "Time to study",
        body: "You have not logged study activity today. Open Today's Desk and complete one focused task.",
        url: "./#today",
        tag: "desk-daily-reminder",
      });
    }

    try {
      await webpush.sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }, notification, { TTL: 3600, urgency: "normal" });

      const { error } = await admin.from("push_subscriptions")
        .update({ last_sent_local_date: local.date, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) errors.push(`sent-mark:${row.id}:${error.message}`);
      sent++;
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await admin.from("push_subscriptions").delete().eq("id", row.id);
        if (deleteError) errors.push(`expired-delete:${row.id}:${deleteError.message}`);
        expired++;
      } else {
        errors.push(`push:${row.id}:${String(error)}`);
      }
    }
  }

  return json({ checked: rows.length, sent, skipped, expired, errors: errors.slice(0, 20) });
});
