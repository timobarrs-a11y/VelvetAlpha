/*
# Add moderator approval system for community boards

## Plain-English Summary
New boards created by regular users now require moderator (super user) approval before
becoming publicly visible and postable. Officially created boards (like Updates) are
auto-approved. The board creator can see their own pending board (locked, read-only)
but cannot post in it until approval. Rejected boards are permanently deleted.

## Changes

### 1. New column on community_boards
- `is_approved` (boolean, default true) — existing boards stay approved.
  New boards created by non-super-users will be inserted with is_approved=false.

### 2. Updated RLS policies on community_boards
- SELECT: approved boards visible to all authenticated users; pending boards
  visible only to the board owner or super users.
- INSERT: any authenticated user can insert (default auth.uid() for owner_id);
  super users get auto-approved, regular users get is_approved=false via
  a BEFORE INSERT trigger.
- UPDATE: only super users can change is_approved (approve/reject).
  Board owners cannot edit while pending.
- DELETE: owner can delete their own board; super users can delete (reject) any board.

### 3. BEFORE INSERT trigger
- `set_board_approval_on_insert()` — if the inserter is a super user, set
  is_approved=true; otherwise set is_approved=false.

### 4. community_posts INSERT policy update
- Posts can only be created in approved boards (or by super users).

## Security
- Regular users cannot see or post in unapproved boards.
- Only super users can approve or reject boards.
- Rejection = deletion by a super user.
*/

-- 1. Add is_approved column (default true so all existing boards stay visible)
ALTER TABLE community_boards
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT true;

-- 2. Create helper function to check if current user is super user
CREATE OR REPLACE FUNCTION is_current_user_super_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_super_user = true
  );
$$;

-- 3. BEFORE INSERT trigger: auto-set approval based on super user status
CREATE OR REPLACE FUNCTION set_board_approval_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_current_user_super_user() THEN
    NEW.is_approved := true;
  ELSE
    NEW.is_approved := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_board_approval ON community_boards;
CREATE TRIGGER trg_set_board_approval
  BEFORE INSERT ON community_boards
  FOR EACH ROW
  EXECUTE FUNCTION set_board_approval_on_insert();

-- 4. Update SELECT policy: approved boards visible to all, pending only to owner/super
DROP POLICY IF EXISTS "community_boards_select_all" ON community_boards;
CREATE POLICY "community_boards_select_visibility"
  ON community_boards FOR SELECT
  TO authenticated
  USING (
    is_approved = true
    OR owner_id = auth.uid()
    OR is_current_user_super_user()
  );

-- 5. Update INSERT policy: any authenticated user can create boards (trigger sets approval)
DROP POLICY IF EXISTS "community_boards_insert_own" ON community_boards;
CREATE POLICY "community_boards_insert_own"
  ON community_boards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- 6. Update UPDATE policy: only super users can approve/reject (change is_approved)
--    Board owners cannot edit while pending; super users can edit any board
DROP POLICY IF EXISTS "community_boards_update_own" ON community_boards;
CREATE POLICY "community_boards_update_moderator"
  ON community_boards FOR UPDATE
  TO authenticated
  USING (is_current_user_super_user())
  WITH CHECK (is_current_user_super_user());

-- 7. Update DELETE policy: owner can delete own board, super users can delete any
DROP POLICY IF EXISTS "community_boards_delete_own" ON community_boards;
CREATE POLICY "community_boards_delete_own_or_moderator"
  ON community_boards FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR is_current_user_super_user()
  );

-- 8. Update community_posts INSERT: only allow posts in approved boards (or by super users)
DROP POLICY IF EXISTS "community_posts_insert_own" ON community_posts;
CREATE POLICY "community_posts_insert_approved_boards"
  ON community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      EXISTS (
        SELECT 1 FROM community_boards
        WHERE community_boards.id = community_posts.board_id
        AND community_boards.is_approved = true
      )
      OR is_current_user_super_user()
    )
  );

-- 9. Backfill: ensure all existing boards are approved
UPDATE community_boards SET is_approved = true WHERE is_approved IS NULL OR is_approved = false;