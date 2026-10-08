/*
# Co-Author v2: Templates and Outline Support

1. Modified Tables
- `co_author_sessions`: add `template_id` (text, nullable) to store which template was selected.
- `co_author_sessions`: add `outline` (jsonb, nullable) to store the AI-generated outline sections.
- `co_author_sessions`: add `outline_completed` (boolean, default false) to track whether the user has finished the outline phase.

2. Notes
- All columns are nullable/defaulted so existing sessions remain valid.
- `template_id` is a plain text string (e.g. 'resume', 'cover_letter', 'blog_post') rather than a foreign key, since templates are defined in frontend config.
- `outline` stores an array of { id, title, status } objects for the outline-first workflow.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'co_author_sessions' AND column_name = 'template_id') THEN
    ALTER TABLE co_author_sessions ADD COLUMN template_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'co_author_sessions' AND column_name = 'outline') THEN
    ALTER TABLE co_author_sessions ADD COLUMN outline jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'co_author_sessions' AND column_name = 'outline_completed') THEN
    ALTER TABLE co_author_sessions ADD COLUMN outline_completed boolean NOT NULL DEFAULT false;
  END IF;
END $$;
