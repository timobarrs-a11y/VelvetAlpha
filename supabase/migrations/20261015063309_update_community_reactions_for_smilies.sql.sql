/*
# Update community reactions to support smilie-based reactions

1. Changes
- Drop the CHECK constraint on community_reactions.reaction_type that restricted it to 'like', 'support', 'relate'
- Add a new CHECK constraint that allows any text value up to 60 characters (smilie shortcodes like 'facepalm', 'salty', 'wtf', etc.)
- This enables users to react to posts and comments with any smilie from the registry
2. Security
- No RLS changes. Existing policies remain intact.
3. Notes
- The reaction_type column data type remains text, no type change
- Existing reactions (like/support/relate) remain valid as they are short text strings
*/

ALTER TABLE community_reactions DROP CONSTRAINT IF EXISTS community_reactions_reaction_type_check;

ALTER TABLE community_reactions ADD CONSTRAINT community_reactions_reaction_type_check
  CHECK (char_length(reaction_type) <= 60);
