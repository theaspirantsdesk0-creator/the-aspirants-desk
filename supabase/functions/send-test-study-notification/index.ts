import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:theaspirantsdesk0@gmail.com";
const ALLOWED_ORIGINS = new Set([
  "https://theaspirantsdesk0-creator.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function json(data: unknown, status = 200, origin = ""): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";
  if (request.method === "OPTIONS") return json({}, 204, allowedOrigin);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, allowedOrigin);

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "Notification service is not fully configured." }, 500, allowedOrigin);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "Sign in to test notifications." }, 401, allowedOrigin);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser();
  if (userError || !userResult.user) {
    return json({ error: "Your session is invalid or expired. Please sign in again." }, 401, allowedOrigin);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: subscriptions, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userResult.user.id)
    .eq("enabled", true)
    .limit(10);

  if (subscriptionError) {
    return json({ error: "Could not read this account's notification subscription." }, 500, allowedOrigin);
  }
  if (!subscriptions?.length) {
    return json({ error: "No active notification subscription was found for this account and device. Enable the daily reminder first." }, 404, allowedOrigin);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  let sent = 0;
  let expired = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({
        title: "The Aspirant's Desk",
        body: "Test notification received. Your study reminders are connected on this device.",
        url: "./#today",
        tag: "desk-push-test",
      }), { TTL: 300, urgency: "normal" });
      sent++;
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await admin.from("push_subscriptions")
          .delete()
          .eq("id", subscription.id)
          .eq("user_id", userResult.user.id);
        if (deleteError) failed++;
        else expired++;
      } else {
        failed++;
      }
    }
  }

  if (sent > 0) return json({ sent, expired, failed }, 200, allowedOrigin);
  return json({ error: "No test notification could be delivered. Check browser permission and device connectivity.", sent, expired, failed }, 502, allowedOrigin);
});
