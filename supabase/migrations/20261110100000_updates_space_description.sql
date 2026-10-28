/*
# "Changelog" is now "Updates"

The page is Updates at /updates (Tim, 28 October). The Updates space that every update is
cross-posted to still described itself as the "product changelog"; say Updates instead.
Safe to run more than once.
*/
UPDATE public.community_boards
SET description = 'Every feature, fix and improvement we ship, posted automatically. The same updates are on the Updates page.'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND description ILIKE '%changelog%';
