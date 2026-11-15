import { useGameStore } from './store';

/** A renda do museu é creditada a cada 10 s de jogo não pausado (progression §10). */
export const MUSEUM_TICK_S = 10;

/**
 * Liga o relógio da renda passiva. Conta os segundos não pausados e, a cada 10, chama
 * `tickIncome`. Ao pausar, credita o que já correu e, enquanto durar a pausa, só avança o
 * relógio: tempo pausado não rende. Retorna a função que desliga.
 */
export function startMuseumIncome(
  target: Window = window,
  now: () => number = () => Date.now(),
): () => void {
  let unpausedS = 0;
  let wasPaused = false;
  const ticker = target.setInterval(() => {
    const { session, tickIncome, syncIncomeClock } = useGameStore.getState();
    if (session.paused) {
      if (!wasPaused) tickIncome(now());
      else syncIncomeClock(now());
      wasPaused = true;
      unpausedS = 0;
      return;
    }
    if (wasPaused) {
      // Voltou da pausa: o relógio recomeça daqui.
      syncIncomeClock(now());
      wasPaused = false;
      return;
    }
    unpausedS += 1;
    if (unpausedS >= MUSEUM_TICK_S) {
      unpausedS = 0;
      tickIncome(now());
    }
  }, 1000);
  return () => target.clearInterval(ticker);
}
