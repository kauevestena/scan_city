import { flushSave, saveSettings, useGameStore } from './store';

export const AUTOSAVE_DEBOUNCE_MS = 1000;
export const AUTOSAVE_INTERVAL_S = 30;

/**
 * Autosave (REQ-CORE-004):
 *  - 1 s depois de cada troca de tela (debounce);
 *  - a cada 30 s de jogo não pausado;
 *  - ao fechar a aba (`beforeunload`).
 * As configurações são gravadas na hora em que mudam. Retorna a função que desliga tudo.
 */
export function startAutosave(target: Window = window): () => void {
  let debounce: number | undefined;
  let unpausedS = 0;

  const unsubscribe = useGameStore.subscribe((state, prev) => {
    if (state.session.screen !== prev.session.screen) {
      target.clearTimeout(debounce);
      debounce = target.setTimeout(flushSave, AUTOSAVE_DEBOUNCE_MS);
    }
    if (state.settings !== prev.settings) saveSettings();
  });

  const ticker = target.setInterval(() => {
    if (useGameStore.getState().session.paused) return;
    unpausedS += 1;
    if (unpausedS >= AUTOSAVE_INTERVAL_S) {
      unpausedS = 0;
      flushSave();
    }
  }, 1000);

  const onBeforeUnload = () => {
    flushSave();
  };
  target.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    unsubscribe();
    target.clearTimeout(debounce);
    target.clearInterval(ticker);
    target.removeEventListener('beforeunload', onBeforeUnload);
  };
}
