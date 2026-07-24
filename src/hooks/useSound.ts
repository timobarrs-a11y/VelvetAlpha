import { useState, useEffect, useCallback, useRef } from 'react';

const SOUND_ENABLED_KEY = 'sound_notifications_enabled';

function createNotificationSound(): AudioBuffer | null {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const duration = 0.3;
    const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 8);
      const frequency1 = 800;
      const frequency2 = 1200;

      const tone =
        Math.sin(2 * Math.PI * frequency1 * t) * 0.3 +
        Math.sin(2 * Math.PI * frequency2 * t) * 0.2;

      channel[i] = tone * envelope;
    }

    return buffer;
  } catch (error) {
    console.error('Error creating notification sound:', error);
    return null;
  }
}

export function useSound() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem(SOUND_ENABLED_KEY);
    return saved === null ? true : saved === 'true';
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioBufferRef.current = createNotificationSound();
        isInitializedRef.current = true;
        console.log('Sound notification ready');
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        audioBufferRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SOUND_ENABLED_KEY, soundEnabled.toString());
  }, [soundEnabled]);

  const playSound = useCallback(() => {
  }, []);

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
