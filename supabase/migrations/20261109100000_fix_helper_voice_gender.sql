-- Helpers (coaches and assistants) made by Atlas and by sync-coach never got a signature voice, so the column's default
-- (classic_male) went to all of them, women too: a female coach was told to speak with "masculine energy". The code now
-- sets the voice from the gender; this fixes the ones already made. Only the two plain classic voices are touched, and
-- only where they don't match the gender. Their stored voice baseline is cleared so it is rebuilt from the right voice.

UPDATE public.companions
SET signature_voice = 'classic_female', voice_baseline = NULL
WHERE gender = 'female' AND signature_voice = 'classic_male';

UPDATE public.companions
SET signature_voice = 'classic_male', voice_baseline = NULL
WHERE gender = 'male' AND signature_voice = 'classic_female';
