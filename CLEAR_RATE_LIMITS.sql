-- Clear Rate Limits Script
-- Run this in Supabase SQL Editor to unblock chat when you hit rate limits

-- Option 1: Clear ALL rate limit entries (nuclear option)
-- DELETE FROM rate_limits;

-- Option 2: Clear entries older than 10 minutes (recommended)
DELETE FROM rate_limits
WHERE called_at < NOW() - INTERVAL '10 minutes';

-- Option 3: Clear entries older than 1 hour
-- DELETE FROM rate_limits
-- WHERE called_at < NOW() - INTERVAL '1 hour';

-- Check remaining entries after cleanup
SELECT
  endpoint,
  COUNT(*) as count,
  MAX(called_at) as most_recent,
  MIN(called_at) as oldest
FROM rate_limits
GROUP BY endpoint
ORDER BY count DESC;

-- If you want to see your current rate limit status:
SELECT
  user_id,
  endpoint,
  COUNT(*) as requests_count,
  MAX(called_at) as last_request,
  CASE
    WHEN COUNT(*) >= 100 AND MAX(called_at) > NOW() - INTERVAL '5 minutes' THEN 'BLOCKED'
    ELSE 'OK'
  END as status
FROM rate_limits
WHERE called_at > NOW() - INTERVAL '5 minutes'
GROUP BY user_id, endpoint
ORDER BY requests_count DESC;
