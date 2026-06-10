import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function triggerArticleRefresh() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const newsApiKey = Deno.env.get("NEWS_API_KEY");
    if (!newsApiKey) {
      throw new Error("NEWS_API_KEY not configured");
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existingArticles } = await supabase
      .from("news_articles")
      .select("url")
      .gte("published_at", fourteenDaysAgo)
      .limit(2000);

    const processedUrls = new Set<string>();
    if (existingArticles) {
      existingArticles.forEach(a => processedUrls.add(a.url));
    }

    const categories = [
      "Science & Technology",
      "Politics",
      "Business & Finance",
      "Entertainment",
      "Health & Wellness",
      "Sports",
    ];

    const KEYWORD_TO_SEARCH_TERMS: Record<string, string[]> = {
      "Science & Technology": ["AI technology", "science innovation"],
      "Politics": ["US Congress Senate", "White House election"],
      "Business & Finance": ["US economy Wall Street", "Federal Reserve stock market"],
      "Entertainment": ["Hollywood entertainment", "movies music celebrity"],
      "Health & Wellness": ["health wellness fitness", "medical nutrition"],
      "Sports": ["American sports championship", "sports tournament"],
    };

    let articlesAdded = 0;

    for (const category of categories) {
      const searchTerms = KEYWORD_TO_SEARCH_TERMS[category] || [category];

      for (const searchTerm of searchTerms) {
        try {
          const newsUrl = new URL("https://newsapi.org/v2/everything");
          newsUrl.searchParams.set("q", searchTerm);
          newsUrl.searchParams.set("apiKey", newsApiKey);
          newsUrl.searchParams.set("sortBy", "publishedAt");
          newsUrl.searchParams.set("pageSize", "10");
          newsUrl.searchParams.set("language", "en");

          const response = await fetch(newsUrl.toString());
          if (!response.ok) continue;

          const data = await response.json() as any;
          if (!data.articles) continue;

          for (const article of data.articles) {
            if (processedUrls.has(article.url)) continue;
            if (!article.title || !article.description || !article.url) continue;

            try {
              await supabase.from("news_articles").insert({
                title: article.title,
                description: article.description,
                url: article.url,
                image_url: article.urlToImage || null,
                source: article.source?.name || "Unknown",
                author: article.author || null,
                published_at: article.publishedAt,
                categories: [category],
                content: article.content || null,
              });

              const { data: insertedArticle } = await supabase
                .from("news_articles")
                .select("id")
                .eq("url", article.url)
                .maybeSingle();

              if (insertedArticle) {
                await supabase.from("article_scrape_queue").insert({
                  article_id: insertedArticle.id,
                  url: article.url,
                  priority: 100,
                });
              }

              processedUrls.add(article.url);
              articlesAdded++;
            } catch {
            }
          }
        } catch {
        }
      }
    }

    const jobId = crypto.randomUUID();
    await supabase.from("background_job_log").insert({
      id: jobId,
      job_name: "article_refresh_scheduler",
      status: "success",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      articles_processed: articlesAdded,
    });

    return {
      success: true,
      articlesAdded,
      message: `Refreshed articles and queued ${articlesAdded} for scraping`,
    };
  } catch (error) {
    const jobId = crypto.randomUUID();
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabase.from("background_job_log").insert({
      id: jobId,
      job_name: "article_refresh_scheduler",
      status: "failed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "POST") {
    const result = await triggerArticleRefresh();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.success ? 200 : 500,
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
