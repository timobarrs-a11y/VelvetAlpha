/*
# Goals, assistants and the new arrival

See docs/goals-and-coaches/plan.md and docs/onboarding/questionnaire-plan.md.

1. Assistants
   - `companions.relationship_type` allows 'assistant' alongside 'friend', 'romantic' and
     'mentor' (coaches). An assistant helps the user get a goal done; a coach teaches a skill.
     One assistant per goal.

2. Plan steps with days
   - `coach_plan_steps.scheduled_for` (date): the day a step is planned for, so the calendar
     can show which days hold what.
   - `coach_plan_steps.duration_minutes` (integer): how long it takes, so a plan can estimate
     its finish date and how long it runs.
   - `coach_plan_steps.phase` (text): the stage a step belongs to ("Get the money ready"), so the
     goal board can group steps into phases.

3. The arrival (onboarding)
   - `user_profiles.someday` (jsonb, default '[]'): things they've always wanted to try,
     picked on the Someday screen, as a list of { tab, value, custom }.
   - `user_profiles.address_style` (text): how Atlas and every AI address them. 'formal'
     ("Master Tim" / "Miss Ana") or 'first_name'. Null until they choose; Atlas then uses the
     formal style for men and women and first names for everyone else.
   - `user_profiles.arrival_choices` (jsonb, default '{}'): what they chose by hand while
     making their avatar and house, so Atlas can remark on one thing that's theirs:
     { avatar: [{ field, value }], house: { style, color, chosen } }.
   - `user_profiles.setup_step` allows the arrival's steps ('arrival_look', 'arrival_home',
     'arrival_town', 'arrival_atlas'), so someone who leaves part-way is brought back to the
     same step.

4. Security
   - `user_profiles` updates are limited to granted columns
     (20261009131910_restrict_user_profiles_privileged_columns.sql), so the three new columns
     are granted to `authenticated`. None of them is privileged.
   - The new `coach_plan_steps` columns are covered by its existing RLS policies.
*/

ALTER TABLE companions DROP CONSTRAINT IF EXISTS companions_relationship_type_check;
ALTER TABLE companions
  ADD CONSTRAINT companions_relationship_type_check
  CHECK (relationship_type IN ('friend', 'romantic', 'mentor', 'assistant'));

ALTER TABLE coach_plan_steps ADD COLUMN IF NOT EXISTS scheduled_for date;
ALTER TABLE coach_plan_steps ADD COLUMN IF NOT EXISTS duration_minutes integer
  CHECK (duration_minutes IS NULL OR duration_minutes > 0);
ALTER TABLE coach_plan_steps ADD COLUMN IF NOT EXISTS phase text;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS someday jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS address_style text
  CHECK (address_style IS NULL OR address_style IN ('formal', 'first_name'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS arrival_choices jsonb NOT NULL DEFAULT '{}'::jsonb;

GRANT UPDATE (someday, address_style, arrival_choices) ON public.user_profiles TO authenticated;

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_setup_step_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_setup_step_check
  CHECK (setup_step IS NULL OR setup_step IN (
    'atlas', 'coach_avatar', 'coach_environment', 'coach_ready', 'companion_in_progress',
    'choose_conversation', 'complete',
    'arrival_look', 'arrival_home', 'arrival_town', 'arrival_atlas'
  ));
