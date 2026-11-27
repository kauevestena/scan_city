/**
 * Manobra de troca de faixa — domain-math §5.2 (ADR-035). Puro.
 *
 * No fim de cada linha a aeronave não troca de faixa sozinha: o jogador faz a curva para o lado
 * da próxima linha, dentro de uma janela de tempo em volta do **portal da curva**. A manobra tem
 * três toques, os de cada lado da mão no teclado:
 * - **direita:** frente (`W`), lado (`D`) e a tecla da curva (`E`), segurados juntos, ou em
 *   sequência `D` → `E` → `W` (alguns teclados não registram três teclas de uma vez);
 * - **esquerda:** `W`, `A` e `Q` juntos, ou `A` → `Q` → `W`.
 * No controle, o analógico para a frente e para o lado com o gatilho do mesmo lado (`RT` à
 * direita, `LT` à esquerda). O instante da manobra é o do toque que a completa, e é ele que a
 * janela julga. Os tempos são **reais** (os dedos do jogador), não de simulação.
 */
import type { AoiPoint } from '@/types';

/** Lado da curva: −1 esquerda, +1 direita. */
export type TurnSide = -1 | 1;

/** Julgamento da manobra (ou da falta dela) em relação à janela. */
export type TurnResult = 'ON_TIME' | 'EARLY' | 'LATE' | 'WRONG_SIDE';

/** Um eixo conta como tecla apertada acima disto (o analógico na diagonal dá ~0,7). */
export const MANEUVER_INPUT = 0.5;
/** Na sequência (lado → tecla da curva → frente), cada toque vem em até este tempo do anterior. */
export const SEQUENCE_GAP_S = 0.6;

/** A janela da curva em volta do portal: segundos reais antes (`earlyS`) e depois (`lateS`). */
export interface TurnWindow {
  earlyS: number;
  lateS: number;
}

/** Os comandos que entram na manobra, como eixos de 0 a 1 (−1 a 1 no lateral). */
export interface ManeuverInput {
  /** `MOVE_Y`: para a frente (`W`, analógico para cima). */
  forward: number;
  /** `MOVE_X`: para o lado (`A`/`D`, analógico). */
  lateral: number;
  /** Tecla da curva de cada lado: `Q`/`E` no teclado, `LT`/`RT` no controle. */
  turnLeft: number;
  turnRight: number;
}

interface Tokens {
  fwd: boolean;
  left: boolean;
  right: boolean;
  keyLeft: boolean;
  keyRight: boolean;
}

/** Progresso da sequência de um lado: 0 nada, 1 o lado, 2 o lado e a tecla da curva. */
interface SequenceProgress {
  step: 0 | 1 | 2;
  /** Instante (real) do último toque da sequência. */
  atS: number;
}

export interface ManeuverState {
  prev: Tokens;
  /** Sequência da esquerda (0) e da direita (1). */
  seq: [SequenceProgress, SequenceProgress];
}

const NO_TOKENS: Tokens = {
  fwd: false,
  left: false,
  right: false,
  keyLeft: false,
  keyRight: false,
};

export const initialManeuver = (): ManeuverState => ({
  prev: { ...NO_TOKENS },
  seq: [
    { step: 0, atS: 0 },
    { step: 0, atS: 0 },
  ],
});

function tokensOf(i: ManeuverInput): Tokens {
  return {
    fwd: i.forward > MANEUVER_INPUT,
    left: i.lateral < -MANEUVER_INPUT,
    right: i.lateral > MANEUVER_INPUT,
    keyLeft: i.turnLeft > MANEUVER_INPUT,
    keyRight: i.turnRight > MANEUVER_INPUT,
  };
}

const chordOf = (t: Tokens, side: TurnSide) =>
  t.fwd && (side > 0 ? t.right && t.keyRight : t.left && t.keyLeft);

/** Um passo da sequência de um lado, pelos toques (bordas de subida) deste passo. */
function stepSequence(
  p: SequenceProgress,
  side: boolean,
  key: boolean,
  fwd: boolean,
  realS: number,
): { next: SequenceProgress; done: boolean } {
  // A sequência que demorou demais entre dois toques recomeça.
  const live = p.step > 0 && realS - p.atS <= SEQUENCE_GAP_S ? p : { step: 0 as const, atS: 0 };
  if (live.step === 2 && fwd) return { next: { step: 0, atS: 0 }, done: true };
  if (live.step === 1 && key) return { next: { step: 2, atS: realS }, done: false };
  // O lado (re)começa a sequência; os outros toques fora de ordem são ignorados.
  if (side) return { next: { step: 1, atS: realS }, done: false };
  return { next: live, done: false };
}

/**
 * Um passo do detector: a manobra completa neste passo (acorde ou sequência), de que lado, ou
 * `'BOTH'` se os dois lados completaram juntos (apertar tudo de uma vez não vale). O acorde
 * conta no instante em que o último dos três toques desce; segurar os três desde antes não é
 * um começo novo.
 */
export function stepManeuver(
  st: ManeuverState,
  input: ManeuverInput,
  realS: number,
): { state: ManeuverState; done: TurnSide | 'BOTH' | null } {
  const now = tokensOf(input);
  const was = st.prev;
  const rise = (k: keyof Tokens) => now[k] && !was[k];
  const left = stepSequence(st.seq[0], rise('left'), rise('keyLeft'), rise('fwd'), realS);
  const right = stepSequence(st.seq[1], rise('right'), rise('keyRight'), rise('fwd'), realS);
  const doneLeft = left.done || (chordOf(now, -1) && !chordOf(was, -1));
  const doneRight = right.done || (chordOf(now, 1) && !chordOf(was, 1));
  const state: ManeuverState = { prev: now, seq: [left.next, right.next] };
  if (doneLeft && doneRight) return { state, done: 'BOTH' };
  if (doneLeft) return { state, done: -1 };
  if (doneRight) return { state, done: 1 };
  return { state, done: null };
}

/**
 * Julga a manobra completa a `toGateS` segundos (reais) do portal da curva (positivo: antes):
 * lado errado (ou os dois lados), cedo, tarde ou no tempo.
 */
export function judgeTurn(
  done: TurnSide | 'BOTH',
  required: TurnSide,
  toGateS: number,
  window: TurnWindow,
): TurnResult {
  if (done !== required) return 'WRONG_SIDE';
  if (toGateS > window.earlyS) return 'EARLY';
  if (toGateS < -window.lateS) return 'LATE';
  return 'ON_TIME';
}

/**
 * Lado da curva até a próxima linha: o sinal do deslocamento lateral do começo dela em relação
 * ao fim da linha atual, no frame dela (`right` é a direita do sentido de voo). Sem
 * deslocamento lateral (a próxima começa atrás, na mesma reta), à direita.
 */
export function turnSideTo(end: AoiPoint, right: AoiPoint, nextStart: AoiPoint): TurnSide {
  const lateral = (nextStart.u - end.u) * right.u + (nextStart.v - end.v) * right.v;
  return lateral < -1e-6 ? -1 : 1;
}

/** O centro da janela, em segundos reais antes do portal (o piloto bom completa aí). */
export function windowCenterS(window: TurnWindow): number {
  return (window.earlyS - window.lateS) / 2;
}
