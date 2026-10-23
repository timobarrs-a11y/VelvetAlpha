/*
# Lock down bot posting and inner feed functions

Already applied to the live project (version 20261023202708). This file is the record.

bot_create_post and bot_create_comment take any author id and never check the caller,
and they were executable by anyone (even signed out). Only the community-bot edge
function (service role) should call them.

get_member_posts_inner and get_trending_posts_inner trust a caller-supplied viewer id
and show the owner's private detail when it matches. Only the wrappers
(get_member_posts, get_progress_feed, get_trending_posts) should call them; those pass
auth.uid() and run as the owner, so they keep working.
*/
REVOKE EXECUTE ON FUNCTION public.bot_create_post(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bot_create_comment(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_member_posts_inner(uuid[], uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trending_posts_inner(uuid[], uuid, integer, timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bot_create_post(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_create_comment(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_member_posts_inner(uuid[], uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_trending_posts_inner(uuid[], uuid, integer, timestamptz) TO service_role;
