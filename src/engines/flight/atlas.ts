/**
 * Comportamento do Atlas (survey-flight §5.15, catalog §8): distração seedada por linha e o
 * consumo de milho. Puro e determinístico.
 */
import { CROP_CAPACITY } from '@/domain/sorties';
import type { Rng } from '@/lib/rng';

export const DISTRACTION_CHANCE = 0.15;
export const DISTRACTION_WARNING_S = 1;
export const DISTRACTION_FORCE_MS = 4;
export const DISTRACTION_MIN_S = 2;
export const DISTRACTION_MAX_S = 3;
/** Contrabalanço: segurar o lado oposto com intensidade > 0,7 por 0,5 s anula a distração. */
export const COUNTER_INTENSITY = 0.7;
export const COUNTER_HOLD_S = 0.5;
export const SECONDS_PER_CORN = 60;

export interface DistractionPlan {
  /** Instante (s desde o início da linha) em que o aviso começa. */
  atS: number;
  /** +1 para a direita, −1 para a esquerda. */
  side: 1 | -1;
  /** Duração da força lateral. */
  forceS: number;
}

/**
 * Ao iniciar a linha, sorteia (p = 0,15) uma distração: um instante aleatório da linha
 * e um lado. `lineDurationS` é a duração estimada da linha.
 */
export function planDistraction(rng: Rng, lineDurationS: number): DistractionPlan | null {
  if (rng.next() >= DISTRACTION_CHANCE) return null;
  return {
    atS: rng.range(0, Math.max(0, lineDurationS - DISTRACTION_WARNING_S - DISTRACTION_MAX_S)),
    side: rng.next() < 0.5 ? -1 : 1,
    forceS: rng.range(DISTRACTION_MIN_S, DISTRACTION_MAX_S),
  };
}

export type DistractionPhase = 'IDLE' | 'WARNING' | 'PUSHING' | 'DONE';

export interface DistractionState {
  phase: DistractionPhase;
  /** Segundos na fase corrente. */
  t: number;
  /** Tempo seguido contrabalançando. */
  counterS: number;
}

export const initialDistraction = (): DistractionState => ({ phase: 'IDLE', t: 0, counterS: 0 });

/**
 * Avança a distração: aviso de 1 s e depois a força de 4 m/s para o lado sorteado por
 * `forceS`, até o contrabalanço. Devolve o novo estado e a velocidade lateral extra.
 */
export function stepDistraction(
  state: DistractionState,
  plan: DistractionPlan | null,
  lineT: number,
  dtS: number,
  moveX: number,
): { state: DistractionState; lateralMs: number } {
  if (!plan || state.phase === 'DONE') return { state, lateralMs: 0 };
  if (state.phase === 'IDLE') {
    return lineT >= plan.atS
      ? { state: { phase: 'WARNING', t: 0, counterS: 0 }, lateralMs: 0 }
      : { state, lateralMs: 0 };
  }
  const t = state.t + dtS;
  if (state.phase === 'WARNING') {
    return t >= DISTRACTION_WARNING_S
      ? { state: { phase: 'PUSHING', t: 0, counterS: 0 }, lateralMs: 0 }
      : { state: { ...state, t }, lateralMs: 0 };
  }
  // PUSHING: o jogador segura o lado oposto com mais de 0,7 por 0,5 s para encerrar antes.
  const countering = moveX * plan.side < -COUNTER_INTENSITY;
  const counterS = countering ? state.counterS + dtS : 0;
  if (counterS >= COUNTER_HOLD_S || t >= plan.forceS) {
    return { state: { phase: 'DONE', t, counterS }, lateralMs: 0 };
  }
  return { state: { phase: 'PUSHING', t, counterS }, lateralMs: DISTRACTION_FORCE_MS * plan.side };
}

/** O Atlas está distraído (aviso ou empurrão) e o alerta deve aparecer? */
export const isDistracted = (s: DistractionState): boolean =>
  s.phase === 'WARNING' || s.phase === 'PUSHING';

/** Energia inicial da surtida: o papo (0–10 unidades) como fração da capacidade. */
export const cropEnergy = (crop: number): number => Math.max(0, Math.min(1, crop / CROP_CAPACITY));

/** Unidades de milho que a surtida consumiu: `energia usada × 10`, arredondada para cima. */
export function cornUsed(startEnergy: number, endEnergy: number): number {
  return Math.max(0, Math.ceil((startEnergy - endEnergy) * CROP_CAPACITY - 1e-9));
}

/** Milho restante no papo para o HUD (`🌽 × n`). */
export const cornLeft = (energy: number): number =>
  Math.ceil(Math.max(0, energy) * CROP_CAPACITY - 1e-9);
