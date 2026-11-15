import { useEffect } from 'react';
import { STRINGS } from '@/data/strings';
import { InputManager } from '@/input/InputManager';
import { useGameStore } from '@/state/store';

/**
 * Liga o `InputManager` à janela, faz o `poll` a cada frame (os loops de jogo também
 * pedem o poll; a segunda chamada no mesmo frame é ignorada), avisa as conexões de
 * controle e marca o dispositivo ativo na raiz do documento (anel de foco do gamepad).
 */
export function InputDriver() {
  useEffect(() => {
    const manager = InputManager.get();
    manager.attach(window);

    const root = document.documentElement;
    const markDevice = () => {
      root.dataset.inputDevice = manager.activeDevice === 'KEYBOARD' ? 'KEYBOARD' : 'GAMEPAD';
    };
    markDevice();
    const offDevice = manager.subscribe(markDevice);

    const offConnection = manager.onConnection((c) => {
      const { pushToast } = useGameStore.getState();
      const family = STRINGS.input.families[c.family];
      if (!c.connected) {
        pushToast({ type: 'info', title: STRINGS.input.padDisconnected(family) });
        return;
      }
      pushToast({ type: 'info', title: STRINGS.input.padConnected(family) });
      if (!c.standard) pushToast({ type: 'warn', title: STRINGS.input.nonStandardMapping });
    });

    let handle = requestAnimationFrame(function frame(timeMs) {
      manager.poll(timeMs);
      handle = requestAnimationFrame(frame);
    });

    return () => {
      cancelAnimationFrame(handle);
      offDevice();
      offConnection();
      manager.detach();
    };
  }, []);

  return null;
}
