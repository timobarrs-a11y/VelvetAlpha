import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Probes whether a page can be shown inside our in-app <iframe> browser.
// The two things that block framing — `X-Frame-Options` and a CSP
// `frame-ancestors` directive — are response headers, so they can only be
// read server-side (the browser hides them from the embedding page and the
// iframe itself is cross-origin). This function fetches the headers and
// reports back, so the client can show an honest "opens in your browser"
// state instead of a spinner that never resolves.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmbedResult {
  url: string;
  embeddable: boolean;
  reason: string;
}

// Does a `frame-ancestors` directive permit an arbitrary third-party origin
// (i.e. us) from framing the page? Anything other than a wildcard means no.
function frameAncestorsAllowsUs(csp: string): boolean {
  const match = csp
    .toLowerCase()
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("frame-ancestors"));
  if (!match) return true; // directive absent — CSP doesn't restrict framing
  const sources = match.replace("frame-ancestors", "").trim();
  // 'none' or an explicit allow-list (self / specific hosts) all exclude us.
  return sources === "*" || sources === "" || sources.split(/\s+/).includes("*");
}

async function checkOne(rawUrl: string): Promise<EmbedResult> {
  const url = (rawUrl || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return { url: rawUrl, embeddable: false, reason: "invalid-url" };
  }

  try {
    // Some servers reject HEAD, so use GET but abandon the body early.
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        // Present as a normal browser so we get the headers a real embed sees.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(7000),
    });

    // We only need headers; free the connection.
    res.body?.cancel().catch(() => {});

    const xfo = res.headers.get("x-frame-options");
    if (xfo) {
      const v = xfo.toLowerCase();
      if (v.includes("deny") || v.includes("sameorigin") || v.includes("allow-from")) {
        return { url, embeddable: false, reason: `x-frame-options:${v.trim()}` };
      }
    }

    const csp = res.headers.get("content-security-policy");
    if (csp && !frameAncestorsAllowsUs(csp)) {
      return { url, embeddable: false, reason: "csp-frame-ancestors" };
    }

    if (!res.ok) {
      return { url, embeddable: false, reason: `http-${res.status}` };
    }

    return { url, embeddable: true, reason: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch-failed";
    // A network/timeout failure server-side means the client iframe would very
    // likely fail too — treat as non-embeddable so we show the fallback.
    return { url, embeddable: false, reason: `unreachable:${msg}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body.urls)
      ? body.urls
      : body.url
      ? [body.url]
      : [];

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "Provide `url` or `urls`" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap the batch so a single request can't hammer us or hang forever.
    const capped = urls.slice(0, 40);
    const results = await Promise.all(capped.map(checkOne));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
