/*
  # Add Expanded Personality Dimensions to Companions Table

  ## Overview
  Adds 7 new personality dimension columns to enable more granular AI personality customization
  based on an expanded 15-question questionnaire system.

  ## New Personality Dimensions Added

  1. **Flirting Style** (flirting_style)
     - Direct & Bold - Makes The First Move
     - Playful Teasing - Flirts Through Banter
     - Subtle & Sweet - Small Gestures & Eye Contact
     - Mysterious & Reserved - Keeps You Guessing

  2. **Humor Style** (humor_style)
     - Witty & Clever - Smart Jokes & Wordplay
     - Goofy & Random - Silly & Unpredictable
     - Sarcastic & Dry - Subtle & Deadpan
     - Warm & Light - Positive & Feel-Good Humor

  3. **Communication Directness** (communication_style)
     - Very Direct & Straightforward - Says Exactly What They Mean
     - Diplomatic & Tactful - Gentle, Considers Feelings
     - Playfully Indirect - Hints, Teases, Makes You Guess
     - Subtle & Suggestive - Reads Between Lines

  4. **Emotional Openness** (emotional_openness)
     - Open Book - Shares Everything Freely
     - Opens Up Over Time - Shares More As Trust Builds
     - Selectively Vulnerable - Shares Deep Stuff Occasionally
     - Private & Guarded - Keeps Feelings Mostly To Self

  5. **Conversation Depth Preference** (conversation_depth)
     - Fun & Light-Hearted - Memes, Trends, Daily Life
     - Deep & Meaningful - Life, Dreams, Philosophy
     - Perfect Mix Of Both - Sometimes Deep, Sometimes Silly
     - Whatever The Moment Feels Like - No Preference

  6. **Expressiveness** (expressiveness)
     - Very Animated - Lots Of Emojis & Actions, Super Expressive
     - Balanced Expression - Uses Emojis & Actions Naturally
     - Subtle & Minimal - Occasional Emoji When It Matters
     - Words Over Symbols - Expresses Through What Said

  7. **Initiative/Conversation Leadership** (initiative)
     - Leads - Starts Topics, Asks Questions, Takes Initiative
     - Both Share - Back-And-Forth, Equal Engagement
     - Follows Lead - Responds Well, Lets You Steer
     - Spontaneous & Random - Sometimes Lead, Sometimes Follow

  ## Impact
  - Enables 32,768 possible personality combinations (2×4×4×3×4×3×4×4×4×4×4×4×4×4×4)
  - Each dimension is independently mappable to specific AI behaviors
  - System prompt builder will use these to create highly personalized companions

  ## Database Changes
  - Adds 7 new text columns to companions table
  - All columns allow NULL for backward compatibility
  - Existing companions unaffected
*/

-- Add new personality dimension columns to companions table
DO $$
BEGIN
  -- Flirting Style
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'flirting_style'
  ) THEN
    ALTER TABLE companions ADD COLUMN flirting_style text;
  END IF;

  -- Humor Style
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'humor_style'
  ) THEN
    ALTER TABLE companions ADD COLUMN humor_style text;
  END IF;

  -- Communication Style
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'communication_style'
  ) THEN
    ALTER TABLE companions ADD COLUMN communication_style text;
  END IF;

  -- Emotional Openness
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'emotional_openness'
  ) THEN
    ALTER TABLE companions ADD COLUMN emotional_openness text;
  END IF;

  -- Conversation Depth
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'conversation_depth'
  ) THEN
    ALTER TABLE companions ADD COLUMN conversation_depth text;
  END IF;

  -- Expressiveness
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'expressiveness'
  ) THEN
    ALTER TABLE companions ADD COLUMN expressiveness text;
  END IF;

  -- Initiative/Conversation Leadership
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'initiative'
  ) THEN
    ALTER TABLE companions ADD COLUMN initiative text;
  END IF;
END $$;
