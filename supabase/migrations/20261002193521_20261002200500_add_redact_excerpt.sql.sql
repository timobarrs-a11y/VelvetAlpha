/*
# Add redact_excerpt() helper for fleet-level reads

1. Purpose
- Provides a SQL function that redacts PII from text excerpts before they
  are read by the fleet dreaming pass (Pass B). Names, places, contact info,
  and numbers are replaced with typed placeholders like [NAME], [PLACE],
  [CONTACT], [NUMBER].

2. Function
- `redact_excerpt(input_text text) RETURNS text`
- Uses PostgreSQL regex functions to replace:
  - Email addresses → [CONTACT]
  - Phone numbers (various formats) → [CONTACT]
  - URLs → [URL]
  - Numbers (standalone digits, ages, dates) → [NUMBER]
  - Common name patterns (Capitalized pairs) → [NAME]
  - Common place patterns (street/avenue/road/etc.) → [PLACE]
- SECURITY DEFINER, search_path = public, immutable
- Granted EXECUTE to authenticated and service_role

3. Notes
- This is a best-effort regex-based redaction. For production use with
  sensitive data, consider a proper NER service. The function is designed
  to be called in SQL queries that feed excerpts to the fleet dreaming pass.
- The function is IMMUTABLE so it can be used in views and indexed
  expressions if needed.
*/

CREATE OR REPLACE FUNCTION redact_excerpt(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text;
BEGIN
  result := input_text;

  -- Email addresses
  result := regexp_replace(result, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[CONTACT]', 'g');

  -- Phone numbers (various formats: 123-456-7890, (123) 456-7890, +1 123 456 7890)
  result := regexp_replace(result, '\+?\d?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}', '[CONTACT]', 'g');

  -- URLs
  result := regexp_replace(result, 'https?://[^\s]+', '[URL]', 'g');

  -- Street addresses (123 Main Street, 456 Oak Avenue, etc.)
  result := regexp_replace(result, '\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl)\.?', '[PLACE]', 'g');

  -- Standalone numbers (ages, dates, IDs, etc.) — 2+ consecutive digits
  result := regexp_replace(result, '\b\d{2,}\b', '[NUMBER]', 'g');

  -- Common name pattern: two consecutive capitalized words (e.g., "John Smith")
  -- This is conservative — only matches pairs of capitalized words not preceded by a sentence start
  result := regexp_replace(result, '(?<![\.\!\?]\s)\b([A-Z][a-z]{1,15})\s([A-Z][a-z]{1,15})\b', '[NAME]', 'g');

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION redact_excerpt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redact_excerpt(text) TO authenticated;
GRANT EXECUTE ON FUNCTION redact_excerpt(text) TO service_role;
