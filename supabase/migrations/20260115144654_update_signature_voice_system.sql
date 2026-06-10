/*
  # Update Signature Voice System with New Voices

  1. Changes
    - Update default signature_voice from 'classic' to 'classic_male'
    - Migrate existing 'classic' values to 'classic_male'
    - Add support for new voice IDs:
      - Free tier: classic_male, classic_female, hippie_male, hippie_female
      - Premium: homie, gangbanger, shakespearean (M/F), victorian (M/F), 
                 1930s (M/F), pirate (M/F), mafia_hitman, noir_detective (M/F),
                 cowboy (M/F), drill_sergeant (M/F), pastor (M/F), poet (M/F),
                 scholar (M/F), southern_belle, wise_grandmother
  
  2. Purpose
    - Expand signature voice system with gender-specific and period-specific voices
    - Each voice has distinct speech patterns that Claude can consistently replicate
    - Free tier gets 4 voices to showcase the feature
    
  3. Voice Categories
    - FREE: Classic (M/F), 1960s Hippie (M/F)
    - PREMIUM Urban/Street: The Homie, The Street (gangbanger)
    - PREMIUM Historical: Shakespearean (M/F), Victorian (M/F), 1930s (M/F)
    - PREMIUM Character: Pirate (M/F), Noir Detective (M/F), Cowboy (M/F), etc.
    - PREMIUM Gender-Specific: Italian Hitman, Southern Belle, Wise Grandmother
*/

-- Update existing 'classic' values to 'classic_male'
UPDATE companions 
SET signature_voice = 'classic_male' 
WHERE signature_voice = 'classic';

-- Update the default value for new companions
ALTER TABLE companions 
ALTER COLUMN signature_voice SET DEFAULT 'classic_male';

-- Update the column comment
COMMENT ON COLUMN companions.signature_voice IS 'The voice style ID that determines how the companion speaks (rhythm, slang, delivery). Now includes gender-specific and period-specific voices. Free tier: classic_(male|female), hippie_(male|female). Premium: 20+ unique voices.';