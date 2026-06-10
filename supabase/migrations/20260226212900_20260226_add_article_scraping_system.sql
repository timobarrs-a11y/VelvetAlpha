/*
  # Article Scraping and Caching System

  1. New Tables
    - `article_scrape_cache` - Stores full scraped article content with metadata
      - `id` (uuid, primary key)
      - `article_id` (uuid, foreign key to news_articles)
      - `full_content` (text, full scraped article body)
      - `scrape_timestamp` (timestamptz, when content was scraped)
      - `scrape_success` (boolean, whether scraping succeeded)
      - `scrape_error` (text, error message if scraping failed)
    - `article_scrape_queue` - Queue for articles pending scraping
      - `id` (uuid, primary key)
      - `article_id` (uuid, foreign key to news_articles)
      - `url` (text, the article URL to scrape)
      - `priority` (integer, lower = higher priority)
      - `queued_at` (timestamptz)
      - `processing` (boolean, whether currently being processed)
      - `last_attempt` (timestamptz, when last scrape was attempted)
      - `attempt_count` (integer, number of failed attempts)
    - `background_job_log` - Tracks background job execution for monitoring
      - `id` (uuid, primary key)
      - `job_name` (text, name of the job)
      - `status` (text, 'running', 'success', 'failed')
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `articles_processed` (integer)
      - `error_message` (text)

  2. Changes
    - No changes to existing tables - maintains backward compatibility
    
  3. Security
    - Enable RLS on all new tables
    - background_job_log is admin-only (service role access)
    - article_scrape_cache and article_scrape_queue are internal-only

  4. Notes
    - Scraping happens in background, not blocking user requests
    - Articles are queued as they arrive, processed asynchronously
    - Retry logic handles temporary failures (max 3 attempts)
    - Content cache reduces subsequent page loads to near-instant
*/

CREATE TABLE IF NOT EXISTS article_scrape_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  full_content text,
  scrape_timestamp timestamptz DEFAULT now(),
  scrape_success boolean DEFAULT false,
  scrape_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(article_id)
);

CREATE TABLE IF NOT EXISTS article_scrape_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  url text NOT NULL,
  priority integer DEFAULT 100,
  queued_at timestamptz DEFAULT now(),
  processing boolean DEFAULT false,
  last_attempt timestamptz,
  attempt_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(article_id)
);

CREATE TABLE IF NOT EXISTS background_job_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  articles_processed integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE article_scrape_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_scrape_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Background jobs are admin only"
  ON background_job_log FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Scrape cache is internal only"
  ON article_scrape_cache FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Scrape queue is internal only"
  ON article_scrape_queue FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_article_scrape_queue_priority 
  ON article_scrape_queue(priority ASC, queued_at ASC);

CREATE INDEX IF NOT EXISTS idx_article_scrape_queue_processing 
  ON article_scrape_queue(processing, last_attempt);

CREATE INDEX IF NOT EXISTS idx_article_scrape_cache_article_id 
  ON article_scrape_cache(article_id);

CREATE INDEX IF NOT EXISTS idx_background_job_log_job_name 
  ON background_job_log(job_name, created_at DESC);
