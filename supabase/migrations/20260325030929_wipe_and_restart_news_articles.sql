
/*
  # Wipe all news articles and start fresh

  The existing article database was populated by the old fetch-news function
  which used the /v2/everything endpoint without country filtering, resulting
  in hundreds of non-US, low-quality, and irrelevant articles.

  The new fetch-news function uses /v2/top-headlines?country=us with a strict
  allowlist. We wipe everything and let it repopulate cleanly.

  Also clears dependent tables: article_scrape_queue, article_scrape_cache,
  article_views, article_conversations, news_fetch_log (to force immediate re-fetch).
*/

TRUNCATE TABLE article_scrape_queue CASCADE;
TRUNCATE TABLE article_scrape_cache CASCADE;
TRUNCATE TABLE article_views CASCADE;
TRUNCATE TABLE article_conversations CASCADE;
TRUNCATE TABLE news_fetch_log CASCADE;
TRUNCATE TABLE news_articles CASCADE;
