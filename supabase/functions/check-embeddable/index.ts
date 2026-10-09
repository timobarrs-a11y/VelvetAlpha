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

// Block anything that could be used to reach infrastructure rather than a public
// web page: non-http schemes, credentials in the URL, non-standard ports, and
// hostnames that resolve to loopback, private, link-local or internal ranges.
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

function isBlockedIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPublicHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") return false;

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || BLOCKED_HOSTNAMES.has(host)) return false;
  if (host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  if (!host.includes(".")) return false; // bare hostnames are internal by definition
  if (isBlockedIpv4(host)) return false;
  // IPv6 loopback, unique-local and link-local.
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;

  return true;
}

async function checkOne(rawUrl: string): Promise<EmbedResult> {
  const url = (rawUrl || "").trim();
  if (!url || !/^https?:\/\//i.test(url) || !isPublicHttpUrl(url)) {
    return { url: rawUrl, embeddable: false, reason: "invalid-url" };
  }

  try {
    // Follow redirects manually so each hop is re-validated against the same rules.
    let current = url;
    let res: Response | null = null;

    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          // Present as a normal browser so we get the headers a real embed sees.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(7000),
      });

      if (res.status < 300 || res.status > 399) break;

      const location = res.headers.get("location");
      res.body?.cancel().catch(() => {});
      if (!location) break;

      const next = new URL(location, current).toString();
      if (!isPublicHttpUrl(next)) {
        return { url, embeddable: false, reason: "invalid-url" };
      }
      current = next;
      res = null;
    }

    if (!res) {
      return { url, embeddable: false, reason: "unreachable" };
    }

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
      return { url, embeddable: false, reason: "not-ok" };
    }

    return { url, embeddable: true, reason: "ok" };
  } catch (_err) {
    // A network/timeout failure server-side means the client iframe would very
    // likely fail too — treat as non-embeddable so we show the fallback. The
    // underlying error is deliberately not returned to the caller.
    return { url, embeddable: false, reason: "unreachable" };
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
    const results = await Promise.all(capped.map((u) => checkOne(String(u))));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (_error) {
    return new Response(
      JSON.stringify({ error: "Unable to check these links" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
