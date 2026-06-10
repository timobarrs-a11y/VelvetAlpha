/*
  # Expand Calendar Event Types

  ## Changes
  - Drops the existing `valid_event_type` CHECK constraint on `user_events`
  - Replaces it with an expanded set that includes:
    - All original 8 types (preserved as-is)
    - 2 relationship types that existed in TypeScript but were missing from the DB constraint
    - 7 new semantic family/personal/community types
    - 1 fun national day type (for user-saved entries; auto national days come from client-side data)

  ## New Event Types Added
  - Family: vacation, kids_event, graduation, doctor_appointment
  - Personal: personal_holiday
  - Community/Identity: community_holiday
  - Fun: national_day

  ## Notes
  - No data migration needed — only the constraint definition changes
  - Existing rows with relationship_anchor / relationship_milestone continue to be valid
*/

ALTER TABLE user_events DROP CONSTRAINT valid_event_type;

ALTER TABLE user_events ADD CONSTRAINT valid_event_type CHECK (event_type IN (
  -- original types
  'reminder', 'appointment', 'anniversary', 'birthday',
  'milestone', 'date_idea', 'task', 'goal_deadline',
  -- relationship types (were in TS but missing from constraint)
  'relationship_anchor', 'relationship_milestone',
  -- family types
  'vacation', 'kids_event', 'graduation', 'doctor_appointment',
  -- personal types
  'personal_holiday',
  -- community/identity types
  'community_holiday',
  -- fun national days (user-saved; auto days are client-side only)
  'national_day'
));
