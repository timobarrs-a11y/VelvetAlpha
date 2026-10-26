-- "This or that": the old onboarding swipe deck, now one pair a day in the feed.
-- Keys are "Left / Right"; values are the label they picked. Companions read it.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS taste_picks jsonb NOT NULL DEFAULT '{}'::jsonb;
GRANT UPDATE (taste_picks) ON user_profiles TO authenticated;
