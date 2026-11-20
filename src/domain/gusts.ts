/**
 * Rajadas e entrada de faixa — domain-math §5.1 (ADR-030). Puro e determinístico pela seed.
 *
 * O vento médio é compensado pela aeronave; o que empurra são as rajadas: de 1 a 3 por linha,
 * cada uma com rampa, patamar e direção própria, avisadas 1,5 s antes. Os tempos são segundos
 * desde o início da linha; os ângulos são relativos ao sentido da linha (0 = de cauda,
 * +π/2 = empurra para a direita).
 */
import { clamp } from '@/lib/math';
import type { Rng } from '@/lib/rng';
import type { Aircraft, Contract } from '@/types';

const DEG = Math.PI / 180;

/** Antecedência do aviso de rajada. */
export const GUST_WARN_S = 1.5;
/** Toda rajada tem pelo menos esta força de pico, mesmo em contrato sem vento. */
export const GUST_MIN_PEAK_MS = 4;
/** A rajada do contrato mais isto: o pico base da rajada (antes do sorteio de 0,8 a 1,3). */
export const GUST_EXTRA_MS = 2;
export const GUST_RAMP_S = 0.5;
export const GUST_HOLD_S = [1.5, 2.5] as const;
export const GUST_PEAK_FACTOR = [0.8, 1.3] as const;
/** Abertura da direção da rajada em torno do vento médio. */
export const GUST_SPREAD_RAD = 50 * DEG;
/** Fração mínima da força que fica na transversal (|sen θ|). */
export const GUST_MIN_LATERAL = 0.7;
/** Uma rajada a cada tantos segundos de linha (de 1 a 6 por linha). */
export const GUST_PERIOD_S = 10;
export const GUST_MAX_PER_LINE = 6;
/** A primeira rajada não vem antes de a entrada de faixa terminar, mais esta folga. */
export const GUST_AFTER_ENTRY_S = 1;
/** Nenhuma rajada começa nos últimos segundos da linha. */
export const GUST_BEFORE_END_S = 4;
/** Tempo que uma rajada ocupa no máximo, com o aviso: 2 rampas, o patamar mais longo e o aviso. */
export const GUST_FOOTPRINT_S = 2 * GUST_RAMP_S + GUST_HOLD_S[1] + GUST_WARN_S;
/**
 * Parte mínima da janela por rajada: a rajada inteira com o aviso e 1 s de calma. A rajada
 * começa nos primeiros `parte − footprint` segundos da sua parte, então o aviso da seguinte
 * nunca cruza a anterior.
 */
export const GUST_MIN_SLOT_S = GUST_FOOTPRINT_S + 1;

/** Erro de entrada de faixa: fração do espaçamento `S`. */
export const ENTRY_OFFSET_FRACTION = [0.3, 0.4] as const;
/** O erro de entrada nunca passa desta fração do que a aeronave corrige até lá. */
export const ENTRY_CORRECTABLE_FRACTION = 0.9;
/**
 * Tempo de correção do erro de entrada além do lead-in: as primeiras amostras da AOI ainda
 * podem sair fora. Sem essa folga, a asa fixa (lenta de lado e com lead-in curto) entraria
 * quase alinhada e o jogador parado passaria.
 */
export const ENTRY_GRACE_S = 2;
/** Proa máxima da asa fixa em relação à linha (a mesma de `flightPhysics`). */
const FIXED_WING_MAX_HEADING_RAD = 30 * DEG;

export interface Gust {
  startS: number;
  rampS: number;
  holdS: number;
  /** Força de pico do vento da rajada (m/s), antes do `driftFactor` da aeronave. */
  peakMs: number;
  /** Para onde a rajada empurra, em relação ao sentido da linha. */
  angleRad: number;
}

/** Rajadas por linha: `clamp(round(T/10), 1, 6)`. */
export function gustCount(lineDurationS: number): number {
  return clamp(Math.round(lineDurationS / GUST_PERIOD_S), 1, GUST_MAX_PER_LINE);
}

export function gustDurationS(gust: Gust): number {
  return 2 * gust.rampS + gust.holdS;
}

/**
 * Ângulo, em relação à linha, do sentido para onde o vento sopra. O vento vem de
 * `directionDeg` (0 = norte, 90 = leste) e vai para o lado oposto; no frame da AOI,
 * leste é +u e sul é +v.
 */
export function windRelativeRad(
  directionDeg: number,
  dir: { u: number; v: number },
  right: { u: number; v: number },
): number {
  const to = (directionDeg + 180) * DEG;
  const wu = Math.sin(to);
  const wv = -Math.cos(to);
  return Math.atan2(wu * right.u + wv * right.v, wu * dir.u + wv * dir.v);
}

/** Leva o ângulo ao mais próximo com |sen θ| ≥ 0,5, mantendo os sinais. */
function withMinLateral(angleRad: number, sideIfZero: 1 | -1): number {
  const s = Math.sin(angleRad);
  if (Math.abs(s) >= GUST_MIN_LATERAL) return angleRad;
  const c = Math.cos(angleRad);
  const side = Math.abs(s) < 1e-12 ? sideIfZero : Math.sign(s);
  const along = Math.sqrt(1 - GUST_MIN_LATERAL * GUST_MIN_LATERAL);
  return Math.atan2(side * GUST_MIN_LATERAL, (c < 0 ? -1 : 1) * along);
}

/**
 * Agenda de rajadas de uma passada. A janela `[leadIn + 1, T − 4]` é dividida em partes
 * iguais e cada rajada começa nos primeiros `parte − footprint` segundos da sua parte.
 */
export function planGusts(
  rng: Rng,
  wind: Contract['wind'],
  windRelRad: number,
  lineDurationS: number,
  leadInS: number,
): Gust[] {
  const from = leadInS + GUST_AFTER_ENTRY_S;
  const windowS = Math.max(0, lineDurationS - GUST_BEFORE_END_S - from);
  let n = gustCount(lineDurationS);
  while (n > 1 && windowS < n * GUST_MIN_SLOT_S) n--;
  const slotS = windowS / n;
  const gusts: Gust[] = [];
  for (let i = 0; i < n; i++) {
    const startS = from + slotS * i + rng.range(0, Math.max(0, slotS - GUST_FOOTPRINT_S));
    const holdS = rng.range(GUST_HOLD_S[0], GUST_HOLD_S[1]);
    const peakMs =
      Math.max(GUST_MIN_PEAK_MS, wind.gustMs + GUST_EXTRA_MS) *
      rng.range(GUST_PEAK_FACTOR[0], GUST_PEAK_FACTOR[1]);
    const raw =
      wind.meanMs >= 1
        ? windRelRad + rng.range(-GUST_SPREAD_RAD, GUST_SPREAD_RAD)
        : rng.range(-Math.PI, Math.PI);
    const sideIfZero = rng.next() < 0.5 ? -1 : 1;
    gusts.push({
      startS,
      rampS: GUST_RAMP_S,
      holdS,
      peakMs,
      angleRad: withMinLateral(raw, sideIfZero),
    });
  }
  return gusts;
}

/** Envelope da rajada em `tS`: sobe em `rampS`, patamar de `holdS`, desce em `rampS`. */
export function gustEnvelope(gust: Gust, tS: number): number {
  const t = tS - gust.startS;
  const total = gustDurationS(gust);
  if (t <= 0 || t >= total) return 0;
  if (t < gust.rampS) return t / gust.rampS;
  if (t <= gust.rampS + gust.holdS) return 1;
  return (total - t) / gust.rampS;
}

/** Vento das rajadas em `tS`, decomposto na transversal e ao longo da linha (m/s). */
export function gustPushAt(
  gusts: readonly Gust[],
  tS: number,
): { lateralMs: number; alongMs: number } {
  let lateralMs = 0;
  let alongMs = 0;
  for (const g of gusts) {
    const e = gustEnvelope(g, tS);
    if (e === 0) continue;
    lateralMs += g.peakMs * e * Math.sin(g.angleRad);
    alongMs += g.peakMs * e * Math.cos(g.angleRad);
  }
  return { lateralMs, alongMs };
}

/**
 * A rajada avisada ou em curso em `tS`: `inS` é o tempo até ela começar (≤ 0 quando já
 * sopra). `null` fora do aviso e do sopro.
 */
export function gustWarningAt(
  gusts: readonly Gust[],
  tS: number,
): { gust: Gust; inS: number } | null {
  for (const gust of gusts) {
    if (tS >= gust.startS - GUST_WARN_S && tS < gust.startS + gustDurationS(gust)) {
      return { gust, inS: gust.startS - tS };
    }
  }
  return null;
}

/**
 * Deslocamento lateral que a aeronave faz em `timeS`, parando no fim. Multirrotor e ave
 * respondem direto; a asa fixa acelera e freia com `a = v²/R` até `v·sen 30°`.
 */
export function maxCorrectableM(
  aircraft: Pick<Aircraft, 'lateralSpeedMaxMs' | 'turnRadiusM'>,
  speedMs: number,
  timeS: number,
): number {
  const t = Math.max(0, timeS);
  if (aircraft.turnRadiusM <= 0) return aircraft.lateralSpeedMaxMs * t;
  const a = (speedMs * speedMs) / aircraft.turnRadiusM;
  const vMax = speedMs * Math.sin(FIXED_WING_MAX_HEADING_RAD);
  if (a <= 0) return 0;
  return t <= (2 * vMax) / a ? (a * t * t) / 4 : vMax * (t - vMax / a);
}

/** Erro de entrada de faixa, com sinal: de 30 % a 40 % de `S`, limitado ao corrigível. */
export function entryOffsetM(rng: Rng, spacingM: number, maxCorrectable: number): number {
  const wanted = rng.range(ENTRY_OFFSET_FRACTION[0], ENTRY_OFFSET_FRACTION[1]) * spacingM;
  const side = rng.next() < 0.5 ? -1 : 1;
  return side * Math.min(wanted, ENTRY_CORRECTABLE_FRACTION * Math.max(0, maxCorrectable));
}
