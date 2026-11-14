import { useEffect } from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import { InputManager } from '@/input/InputManager';
import { useGameStore } from '@/state/store';

/**
 * Cria o `AudioContext` no primeiro gesto do jogador (clique, tecla ou botão do
 * controle), como exigem os navegadores (REQ-AUD-001), e aplica os volumes das
 * configurações (REQ-AUD-003).
 */
export function AudioDriver() {
  useEffect(() => {
    const engine = AudioEngine.get();
    const apply = () => {
      const { masterVolume, sfxVolume, muted } = useGameStore.getState().settings;
      engine.setVolumes(masterVolume, sfxVolume, muted);
    };
    apply();
    const offSettings = useGameStore.subscribe((state, prev) => {
      if (state.settings !== prev.settings) apply();
    });

    const events = ['pointerdown', 'keydown'] as const;
    const unlock = () => {
      engine.unlock();
      events.forEach((type) => window.removeEventListener(type, unlock, true));
      offPad();
    };
    events.forEach((type) => window.addEventListener(type, unlock, true));
    // Botão do controle: o dispositivo ativo passa a ser um gamepad.
    const offPad = InputManager.get().subscribe((device) => {
      if (device !== 'KEYBOARD') unlock();
    });

    return () => {
      offSettings();
      offPad();
      events.forEach((type) => window.removeEventListener(type, unlock, true));
    };
  }, []);

  return null;
}
