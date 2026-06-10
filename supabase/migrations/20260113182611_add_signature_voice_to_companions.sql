/*
  # Add Signature Voice to Companions

  1. Changes
    - Add `signature_voice` column to `companions` table
      - Type: TEXT
      - Default: 'classic' (the free voice option)
      - Stores the voice ID that determines how the companion speaks
  
  2. Purpose
    - Enable companions to have distinct speaking styles (The Homie, The Poet, etc.)
    - Separate from personality traits (which define WHAT they do)
    - Voice defines HOW they speak (rhythm, slang, delivery)
    
  3. Notes
    - 'classic' is the only free voice
    - All other voices require premium subscription
    - Voice IDs: classic, homie, poet, pirate, sage, drill_sergeant, southern_belle, tech_bro, chaos_agent, scholar
*/

-- Add signature_voice column to companions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companions' AND column_name = 'signature_voice'
  ) THEN
    ALTER TABLE companions 
    ADD COLUMN signature_voice TEXT DEFAULT 'classic';
  END IF;
END $$;

-- Add index for voice lookups
CREATE INDEX IF NOT EXISTS idx_companions_signature_voice 
ON companions(signature_voice);

-- Add comment for documentation
COMMENT ON COLUMN companions.signature_voice IS 'The voice style ID that determines how the companion speaks (rhythm, slang, delivery). Separate from personality traits.';
