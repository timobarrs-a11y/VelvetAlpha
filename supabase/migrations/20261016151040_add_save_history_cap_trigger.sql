-- Replace client-side capping with a server-side trigger that enforces
-- "last 10 rows per (user_id, companion_id)" on every INSERT.
-- This is the authoritative cap — the client-side range(10,100) delete
-- is now a belt-and-suspenders fallback.

-- Drop any existing trigger first (idempotent)
DROP TRIGGER IF EXISTS velvet_house_save_history_cap ON velvet_house_save_history;

-- The function deletes all but the 10 most recent rows for the
-- (user_id, companion_id) pair of the row just inserted.
CREATE OR REPLACE FUNCTION cap_velvet_house_save_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  DELETE FROM velvet_house_save_history
  WHERE user_id = NEW.user_id
    AND companion_id = NEW.companion_id
    AND id NOT IN (
      SELECT id FROM velvet_house_save_history
      WHERE user_id = NEW.user_id
        AND companion_id = NEW.companion_id
      ORDER BY saved_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER velvet_house_save_history_cap
  AFTER INSERT ON velvet_house_save_history
  FOR EACH ROW
  EXECUTE FUNCTION cap_velvet_house_save_history();