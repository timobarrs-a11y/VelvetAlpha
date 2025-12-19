import { useState, useEffect, useCallback, useRef } from 'react';

const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBR1nvejeoFYQCU6n4PGxYhsEL4Hs8MF4KwUfc8rx0ImYGQxPqOPwtV8dBDGG7PDGeSwGI3nN7tiRPwoUYLXq7KdWEwlEn+Hxt2MeBjWJ7fHGcysGJH3P79+VOAsYcL/v56JVFQk9me7pv2sgAjp4y/HVjiQGHWvA8N+VNwoTZrjs7aVXFAlBnN/yuWcdBDKB7fHFdisFJoLP79mQQQkSYLPp7KhYEwhBn+DwsmMdAy6A6/DDbygEJX7P8N2SPQoUYLTp6qdUEgdAm+DwuGQdBS+G7fDGeS0GJYDl8deNPQkSX7Lp66hVEgZAm9/pt2IdBSyD6+/EcykFJIHN8NqMPgkTX7Tp7KhVEgdBnd/pt2IdBS+H7+/FcisFI4HO7tmLPgkTYrfq7adVEglEoODptF8bAy2F7O/GcSgEJITO79iMPgkSYbfq7KdXEgpGo+HptF4bAy6H7e/EcCkFI4DN7taJPAcUYrnr66lYFApIpuPorFgVCUqm5O+uWRYKTKjk8bJdFwtOque5YBUJSZzc56FRDAg+lc3u0oQzBRt0xu/aoUILEGGz5+idTgwIT6Df77dmGwQug+nuw3AoAyR+zu7RgDgHEluz5+ecTAoIT6Hf8LdhHAQxg+nswW4mAyOAz+/TgzcIF2S46+mjVRIKT6Ti8LNcGgMtg+rtvGcdBSaC0O/WgjUHE2K06OejVRIKUKXi8LJbGgMrg+rtvGYdBSaB0O/Uf0AJFGGz6e2lVhMKT6Pg8LFaGgMtg+ruu2YdBSaB0O/Uf0AJFGGz6OylVRMKT6Ti8LFaGgMrhOrvu2YdBCaA0O/Uf0AJFGGz6OukVRMKT6Pi8LFaGgMrhOrvu2YdBCaB0O/Tf0AJFGGz6OukVRMKT6Pi8LFaGgMrhOruu2YcBCaA0O/Uf0AJFGG06OukVRMJT6Pi8LFaGgMrhOruu2YcBCaA0O/Uf0AJFGG06OukVRMJT6Pi8LFaGgMrhOruu2YcBCaA0O/Tf0AJFGGz6OukVRMJT6Pi8LFaGgMrhOruu2YcBCaA0O/Uf0AJFGG06OukVRMJT6Pi8LFaGgMrhOruu2YcBCaA0O/Tf0AJFGGz6OukVRMJT6Pi8LFaGgMrhOruu2YcBCaA0O/Tf0AJFGGz6OukVRMJT6Pi8LFaGgMrhOruu2YcBCaA0O/Tf0AJFGG06OukVRMJT6Pi8LFaGgMrhOruu2YcBCaA0O/Tf0AJ';

const SOUND_ENABLED_KEY = 'sound_notifications_enabled';

export function useSound() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem(SOUND_ENABLED_KEY);
    return saved === null ? true : saved === 'true';
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.volume = 0.5;
      audio.preload = 'auto';

      audio.addEventListener('canplaythrough', () => {
        isInitializedRef.current = true;
        console.log('Sound notification ready');
      });

      audio.load();
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SOUND_ENABLED_KEY, soundEnabled.toString());
  }, [soundEnabled]);

  const playSound = useCallback(() => {
    console.log('playSound called', { soundEnabled, hasAudio: !!audioRef.current });

    if (!soundEnabled) {
      console.log('Sound is disabled');
      return;
    }

    if (!audioRef.current) {
      console.log('Audio element not initialized');
      return;
    }

    try {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Sound played successfully');
          })
          .catch(err => {
            console.error('Error playing sound:', err);
          });
      }
    } catch (err) {
      console.error('Exception playing sound:', err);
    }
  }, [soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      console.log('Sound toggled:', newValue);
      return newValue;
    });
  }, []);

  return {
    soundEnabled,
    toggleSound,
    playSound
  };
}
