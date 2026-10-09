// Shared authorization guard for scheduled (cron-triggered) edge functions.
//
// These functions run privileged, project-wide work and must never be callable by
// an anonymous visitor or an ordinary signed-in user. pg_cron invokes them with
// `Authorization: Bearer <service_role_key>`, so we accept that, and also accept a
// dedicated CRON_SECRET when one is configured for external schedulers.
//
// Returns a 401 Response when the caller is not authorized, or null when it is.
export function requireCronAuth(req: Request, corsHeaders: Record<string, string>): Response | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const allowed = [
    Deno.env.get("CRON_SECRET"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  if (token.length > 0 && allowed.some((secret) => timingSafeEqual(token, secret))) {
    return null;
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
