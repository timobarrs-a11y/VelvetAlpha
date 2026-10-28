// Pins tasks to a person's own Google Calendar.
//
// POST (from the app, signed in): { action: "status" | "start" | "add" | "remove" | "disconnect", ... }
// GET  (Google sending the browser back after sign-in): ?code=...&state=...
// verify_jwt is off because the GET comes from Google; the POSTs check the caller's token themselves.
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and optionally APP_URL (default https://projectvelvet.bolt.host).
// Without the Google ones the function answers { configured: false } and the app keeps its plain calendar links.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { buildAuthUrl, buildEvent, needsReconnect, safeReturnPath, signState, verifyState } from "../_shared/googleCalendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "https://projectvelvet.bolt.host").replace(/\/+$/, "");
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar`;
const configured = !!(CLIENT_ID && CLIENT_SECRET);

const admin = () => createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

class Reconnect extends Error {}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const text = await res.text();
  if (!res.ok) {
    if (needsReconnect(res.status, text)) throw new Reconnect();
    throw new Error(`token_${res.status}`);
  }
  return JSON.parse(text) as { access_token: string; expires_in: number; refresh_token?: string; id_token?: string; scope?: string };
}

/** A working access token for this person, refreshed when it's about to run out. */
async function accessTokenFor(userId: string): Promise<string> {
  const db = admin();
  const { data: conn } = await db.from("google_calendar_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn) throw new Reconnect();
  if (conn.access_token && conn.access_expires_at && Date.parse(conn.access_expires_at) - Date.now() > 60_000) return conn.access_token;
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
    await db.from("google_calendar_connections").update({
      access_token: t.access_token,
      access_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    return t.access_token;
  } catch (err) {
    // The token stopped working (revoked, or a test-mode one past its week): forget it so the app offers to connect again.
    if (err instanceof Reconnect) await db.from("google_calendar_connections").delete().eq("user_id", userId);
    throw err;
  }
}

const eventsUrl = (id?: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/primary/events${id ? `/${encodeURIComponent(id)}` : ""}`;

async function calendarCall(userId: string, method: string, url: string, body?: unknown) {
  const token = await accessTokenFor(userId);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function handleCallback(url: URL): Promise<Response> {
  const back = (path: string, result: string) => Response.redirect(`${APP_URL}${safeReturnPath(path)}?calendar=${result}`, 302);
  const state = await verifyState(url.searchParams.get("state") ?? "", CLIENT_SECRET);
  if (!state) return Response.redirect(`${APP_URL}/coaching-commitments?calendar=error`, 302);
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return back(state.returnPath, "denied");
  try {
    const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
    if (!t.refresh_token) return back(state.returnPath, "error");
    let email: string | null = null;
    try {
      const payload = t.id_token?.split(".")[1];
      if (payload) email = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).email ?? null;
    } catch { /* the address is only for display */ }
    await admin().from("google_calendar_connections").upsert({
      user_id: state.userId,
      refresh_token: t.refresh_token,
      access_token: t.access_token,
      access_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      scope: t.scope ?? null,
      google_email: email,
      updated_at: new Date().toISOString(),
    });
    return back(state.returnPath, "connected");
  } catch {
    return back(state.returnPath, "error");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  if (req.method === "GET") {
    if (!configured) return Response.redirect(`${APP_URL}/coaching-commitments?calendar=error`, 302);
    return handleCallback(new URL(req.url));
  }

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin().auth.getUser(token);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const db = admin();

    if (body.action === "status") {
      const { data: conn } = await db.from("google_calendar_connections").select("google_email").eq("user_id", user.id).maybeSingle();
      return json({ configured, connected: !!conn, email: conn?.google_email ?? null });
    }

    if (!configured) return json({ error: "not_configured" }, 503);

    if (body.action === "start") {
      const state = await signState(user.id, safeReturnPath(body.returnPath), CLIENT_SECRET);
      return json({ url: buildAuthUrl({ clientId: CLIENT_ID, redirectUri: REDIRECT_URI, state }) });
    }

    if (body.action === "disconnect") {
      const { data: conn } = await db.from("google_calendar_connections").select("refresh_token").eq("user_id", user.id).maybeSingle();
      if (conn) {
        // Tell Google too, so the app disappears from their account's connected apps.
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh_token)}`, { method: "POST" }).catch(() => {});
        await db.from("google_calendar_connections").delete().eq("user_id", user.id);
      }
      return json({ ok: true });
    }

    if (body.action === "add" || body.action === "remove") {
      const ids: string[] = Array.isArray(body.commitmentIds) ? body.commitmentIds.filter((x: unknown) => typeof x === "string").slice(0, 50) : [];
      if (ids.length === 0) return json({ error: "bad_request" }, 400);
      const link = `${APP_URL}/coaching-commitments`;

      const { data: tasks } = await db
        .from("coaching_commitments")
        .select("id, description, due_date, goal_id, companion_id, google_event_id")
        .eq("user_id", user.id)
        .in("id", ids);
      const results: Record<string, "added" | "updated" | "removed" | "failed"> = {};

      const goalIds = [...new Set((tasks ?? []).map(t => t.goal_id).filter(Boolean))];
      const companionIds = [...new Set((tasks ?? []).map(t => t.companion_id).filter(Boolean))];
      const [{ data: goals }, { data: companions }] = await Promise.all([
        goalIds.length ? db.from("user_goals").select("id, title").in("id", goalIds) : Promise.resolve({ data: [] }),
        companionIds.length ? db.from("companions").select("id, name").in("id", companionIds) : Promise.resolve({ data: [] }),
      ]);
      const goalTitle = new Map((goals ?? []).map((g: { id: string; title: string }) => [g.id, g.title]));
      const companionName = new Map((companions ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

      try {
        for (const task of tasks ?? []) {
          try {
            if (body.action === "remove") {
              if (task.google_event_id) {
                const res = await calendarCall(user.id, "DELETE", eventsUrl(task.google_event_id));
                if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`delete_${res.status}`);
                await db.from("coaching_commitments").update({ google_event_id: null }).eq("id", task.id);
              }
              results[task.id] = "removed";
              continue;
            }
            const event = buildEvent(
              { id: task.id, description: task.description, due_date: task.due_date, companion_name: task.companion_id ? companionName.get(task.companion_id) : null },
              task.goal_id ? goalTitle.get(task.goal_id) : null,
              link,
            );
            let res = task.google_event_id ? await calendarCall(user.id, "PATCH", eventsUrl(task.google_event_id), event) : null;
            // Someone deleted it from their calendar: make a fresh one.
            const updated = !!res?.ok;
            if (!res || res.status === 404 || res.status === 410) res = await calendarCall(user.id, "POST", eventsUrl(), event);
            if (!res.ok) throw new Error(`insert_${res.status}`);
            const saved = await res.json();
            await db.from("coaching_commitments").update({ google_event_id: saved.id }).eq("id", task.id);
            results[task.id] = updated ? "updated" : "added";
          } catch (err) {
            if (err instanceof Reconnect) throw err;
            results[task.id] = "failed";
          }
        }
      } catch (err) {
        if (err instanceof Reconnect) return json({ error: "reconnect", results }, 409);
        throw err;
      }
      return json({ results });
    }

    return json({ error: "bad_request" }, 400);
  } catch (err) {
    if (err instanceof Reconnect) return json({ error: "reconnect" }, 409);
    console.error("[google-calendar]", err instanceof Error ? err.message : err);
    return json({ error: "failed" }, 500);
  }
});
