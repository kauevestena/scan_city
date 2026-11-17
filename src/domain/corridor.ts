/**
 * Corredor de voo — domain-math §10.3 (ADR-029). Puro.
 *
 * Cada linha tem portais nos pontos de disparo do plano e uma altitude-alvo que segue o
 * relevo com a regra do Terrain Following, limitada a uma rampa que a aeronave consegue
 * subir. Tudo é medido ao longo do eixo da linha (`s`, em metros desde o início).
 */
import { clamp } from '@/lib/math';
import type { FlightLine } from '@/types';

/** Meia largura do portal, em fração do espaçamento `S` (o limite da nota Boa). */
export const GATE_HALF_WIDTH = 0.1;
/** Meia altura do portal, em fração da altura de voo `H` (o limite da nota Boa). */
export const GATE_HALF_HEIGHT = 0.1;
/** Passo da grade do perfil ao longo da linha. */
export const CORRIDOR_STEP_M = 5;
/** Antecipação do relevo, a mesma do Terrain Following. */
export const CORRIDOR_LOOKAHEAD_S = 2;
/** A rampa do corredor usa esta fração da razão de subida da aeronave. */
export const CORRIDOR_CLIMB_FRACTION = 0.7;

type LineWindow = Pick<FlightLine, 'aoiStartS' | 'aoiEndS'>;

/** Portais da linha: `s_k = aoiStartS − B + k·B`, enquanto `s_k ≤ aoiEndS + B` (e `s_k ≥ 0`). */
export function gatePositions(line: LineWindow, baseM: number): number[] {
  if (!(baseM > 0)) return [];
  const out: number[] = [];
  const last = line.aoiEndS + baseM + 1e-9;
  for (let s = line.aoiStartS - baseM; s <= last; s += baseM) {
    if (s >= -1e-9) out.push(Math.max(0, s));
  }
  return out;
}

/** Amostras planejadas da linha: os portais a partir do início da AOI. */
export function plannedSamples(line: LineWindow, baseM: number): number {
  return gatePositions(line, baseM).filter((s) => s >= line.aoiStartS - 1e-9).length;
}

export interface CorridorOptions {
  /** Altura de voo do plano (AGL). */
  heightM: number;
  /** Velocidade do plano. */
  speedMs: number;
  climbRateMs: number;
  /** Teto acima do terreno: `min(hMaxM, ceilingM)`. */
  ceilingAglM: number;
}

export interface CorridorProfile {
  stepM: number;
  /** Altitude do corredor em `s = i · stepM`. */
  alts: number[];
}

/**
 * Altitude do corredor ao longo da linha:
 * 1. `T(s)`: a maior elevação nos próximos 2 s de trajeto, mais `H`;
 * 2. o envelope superior de `T` com rampa de no máximo 70 % da razão de subida;
 * 3. limitado ao teto acima do terreno.
 */
export function corridorProfile(
  elevationAlong: (s: number) => number,
  lengthM: number,
  opts: CorridorOptions,
): CorridorProfile {
  const step = CORRIDOR_STEP_M;
  const n = Math.max(1, Math.ceil(lengthM / step) + 1);
  const ahead = Math.max(0, Math.floor((CORRIDOR_LOOKAHEAD_S * Math.max(0, opts.speedMs)) / step));
  const elev: number[] = [];
  for (let i = 0; i < n + ahead; i++) elev.push(elevationAlong(i * step));

  const alts: number[] = [];
  for (let i = 0; i < n; i++) {
    let highest = elev[i] as number;
    for (let k = 1; k <= ahead; k++) highest = Math.max(highest, elev[i + k] as number);
    alts.push(highest + opts.heightM);
  }

  const rise =
    ((CORRIDOR_CLIMB_FRACTION * Math.max(0, opts.climbRateMs)) / Math.max(0.1, opts.speedMs)) *
    step;
  for (let i = 1; i < n; i++) {
    alts[i] = Math.max(alts[i] as number, (alts[i - 1] as number) - rise);
  }
  for (let i = n - 2; i >= 0; i--) {
    alts[i] = Math.max(alts[i] as number, (alts[i + 1] as number) - rise);
  }
  for (let i = 0; i < n; i++) {
    alts[i] = Math.min(alts[i] as number, (elev[i] as number) + opts.ceilingAglM);
  }
  return { stepM: step, alts };
}

/** Altitude do corredor em `s` (interpolação linear; fora da linha vale a ponta). */
export function corridorAltAt(profile: CorridorProfile, s: number): number {
  const last = profile.alts.length - 1;
  const f = clamp(s / profile.stepM, 0, last);
  const i = Math.min(last, Math.floor(f));
  const a = profile.alts[i] as number;
  const b = profile.alts[Math.min(last, i + 1)] as number;
  return a + (b - a) * (f - i);
}

/** Maior variação da altitude do corredor em `[s, s + distanceM]`, em relação à de `s`. */
export function corridorChangeAhead(
  profile: CorridorProfile,
  s: number,
  distanceM: number,
): number {
  const base = corridorAltAt(profile, s);
  let worst = 0;
  for (let d = profile.stepM; d <= distanceM + 1e-9; d += profile.stepM) {
    worst = Math.max(worst, Math.abs(corridorAltAt(profile, s + d) - base));
  }
  return worst;
}
