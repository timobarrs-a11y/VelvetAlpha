import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_CONTENT_LENGTH = 15000;

/**
 * Strips HTML tags and normalizes whitespace from a string.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Attempts multiple extraction strategies in order of quality:
 * 1. JSON-LD structured data (most reliable, used by NYT, ESPN, etc.)
 * 2. <article> tag
 * 3. Common content div patterns
 * 4. <main> tag
 * 5. Meta description fallback
 */
function extractContent(html: string): string | null {
  // Strategy 1: JSON-LD structured article body
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const json = JSON.parse(match[1]);
      const entries = Array.isArray(json) ? json : [json];
      for (const entry of entries) {
        const articleBody = entry?.articleBody || entry?.["@graph"]?.find?.((n: any) => n?.articleBody)?.articleBody;
        if (articleBody && articleBody.length > 200) {
          return articleBody.substring(0, MAX_CONTENT_LENGTH);
        }
      }
    } catch {
      // parse failed, try next
    }
  }

  // Strategy 2: OpenGraph / meta description as last resort placeholder
  // (we'll try real extraction first)

  // Strategy 3: Prioritized CSS selector patterns — order matters
  const contentPatterns = [
    // Named article body containers (highest quality)
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    // ESPN, Yahoo Sports specific
    /<div[^>]*class="[^"]*article[_-]body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*story[_-]body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // Generic news content divs
    /<div[^>]*class="[^"]*article[_-]content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*post[_-]content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*entry[_-]content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*body[_-]content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*news[_-]body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*content[_-]body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*story[_-]content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*page[_-]content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="article[_-]body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="story[_-]body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // Fallback: main
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ];

  let best: string | null = null;

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const stripped = stripHtml(match[1]);
      // Must be meaningful — at least 300 chars of real text
      if (stripped.length > 300 && (!best || stripped.length > best.length)) {
        best = stripped;
        // If we have a lot of content from a high-quality pattern, stop early
        if (best.length > 1000) break;
      }
    }
  }

  if (best) return best.substring(0, MAX_CONTENT_LENGTH);

  // Strategy 4: Extract all <p> tags (paragraph soup — works on most news sites)
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => stripHtml(m[1]).trim())
    .filter(p => p.length > 40);

  if (paragraphs.length >= 3) {
    const combined = paragraphs.join("\n\n");
    if (combined.length > 300) {
      return combined.substring(0, MAX_CONTENT_LENGTH);
    }
  }

  return null;
}

async function scrapeArticleContent(url: string, timeout = 12000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    if (!html || html.length < 500) return null;

    const content = extractContent(html);
    if (!content || content.length < 150) return null;

    return content;
  } catch {
    return null;
  }
}

async function processScrapingQueue() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const jobId = crypto.randomUUID();

  try {
    await supabase.from("background_job_log").insert({
      id: jobId,
      job_name: "scrape_articles_batch",
      status: "running",
      started_at: new Date().toISOString(),
      articles_processed: 0,
    });

    const { data: queueItems } = await supabase
      .from("article_scrape_queue")
      .select("id, article_id, url, attempt_count")
      .eq("processing", false)
      .lt("attempt_count", 3)
      .order("priority", { ascending: true })
      .order("queued_at", { ascending: true })
      .limit(10);

    if (!queueItems || queueItems.length === 0) {
      await supabase
        .from("background_job_log")
        .update({ status: "success", completed_at: new Date().toISOString(), articles_processed: 0 })
        .eq("id", jobId);
      return;
    }

    let processedCount = 0;

    for (const item of queueItems) {
      try {
        await supabase
          .from("article_scrape_queue")
          .update({ processing: true, last_attempt: new Date().toISOString() })
          .eq("id", item.id);

        const content = await scrapeArticleContent(item.url);

        if (content) {
          const { data: cached } = await supabase
            .from("article_scrape_cache")
            .select("id")
            .eq("article_id", item.article_id)
            .maybeSingle();

          if (cached) {
            await supabase
              .from("article_scrape_cache")
              .update({
                full_content: content,
                scrape_timestamp: new Date().toISOString(),
                scrape_success: true,
                scrape_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", cached.id);
          } else {
            await supabase.from("article_scrape_cache").insert({
              article_id: item.article_id,
              full_content: content,
              scrape_timestamp: new Date().toISOString(),
              scrape_success: true,
              scrape_error: null,
            });
          }

          await supabase.from("article_scrape_queue").delete().eq("id", item.id);
          processedCount++;
        } else {
          const newCount = (item.attempt_count || 0) + 1;
          if (newCount >= 3) {
            await supabase.from("article_scrape_cache").upsert({
              article_id: item.article_id,
              full_content: null,
              scrape_timestamp: new Date().toISOString(),
              scrape_success: false,
              scrape_error: "Content extraction failed after 3 attempts",
            }, { onConflict: "article_id" });
            await supabase.from("article_scrape_queue").delete().eq("id", item.id);
          } else {
            await supabase
              .from("article_scrape_queue")
              .update({ processing: false, attempt_count: newCount })
              .eq("id", item.id);
          }
        }
      } catch (error) {
        await supabase
          .from("article_scrape_queue")
          .update({ processing: false, attempt_count: (item.attempt_count || 0) + 1 })
          .eq("id", item.id);
      }
    }

    await supabase
      .from("background_job_log")
      .update({ status: "success", completed_at: new Date().toISOString(), articles_processed: processedCount })
      .eq("id", jobId);
  } catch (error) {
    await supabase
      .from("background_job_log")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", jobId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      EdgeRuntime.waitUntil(processScrapingQueue());

      return new Response(
        JSON.stringify({ success: true, message: "Scraping batch queued" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
