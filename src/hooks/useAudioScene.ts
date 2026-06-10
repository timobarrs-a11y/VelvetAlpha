import { useState, useCallback, useEffect } from 'react';
import { audioManager, AudioScene } from '../services/audioManager';

export function useAudioScene() {
  const [muted, setMutedState] = useState(() => audioManager.getMuted());
  const [volume, setVolumeState] = useState(() => audioManager.getVolume());

  useEffect(() => {
    const handler = () => {
      audioManager.onUserInteraction();
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
    };
    window.addEventListener('click', handler);
    window.addEventListener('keydown', handler);
    window.addEventListener('touchstart', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
    };
  }, []);

  const playScene = useCallback((scene: AudioScene) => {
    audioManager.play(scene);
  }, []);

  const stopAudio = useCallback(() => {
    audioManager.stop();
  }, []);

  const toggleMute = useCallback(() => {
    const next = !audioManager.getMuted();
    audioManager.setMuted(next);
    setMutedState(next);
  }, []);

  const setVolume = useCallback((v: number) => {
    audioManager.setVolume(v);
    setVolumeState(v);
  }, []);

  return { muted, volume, playScene, stopAudio, toggleMute, setVolume };
}
