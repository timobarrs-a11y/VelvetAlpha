/*
# Fix: strip redirect footer from existing changelog cross-posts

## Problem
The previous migration used LIKE '%---\nSee...' which in Postgres LIKE
treats \n as literal backslash-n, not a newline char. The actual data
uses real newlines (0x0a), so zero rows matched. The redirect text
"---\nSee the full changelog at /changelog" is still on every post.

## Fix
Use split_part with E'\n\n---\nSee' as the delimiter (E'' interprets
escape sequences), which matches the real newline bytes in the data.
This trims everything from the redirect footer onward, leaving just
the category label + full changelog body.

## Safety
No data loss -- we only strip the appended redirect footer, which was
never part of the original changelog content.
*/

UPDATE community_posts
SET body = split_part(body, E'\n\n---\nSee the full changelog at /changelog', 1)
WHERE position(E'\n\n---\nSee the full changelog at /changelog' in body) > 0;