/**
 * Elementos de fenda e aceleração de tempo (survey-flight §5.13, §5.14): holofotes,
 * anéis, picos elétricos e as regras de volta a ×1. Puro e determinístico.
 */
import { RULE_PARAMS } from '@/domain/specialRules';
import type { Rng } from '@/lib/rng';
import type { SpecialZone, WorldObject } from '@/types';
import type { FlightPhase } from './hudPublisher';

// --- Holofotes ----------------------------------------------------------------------

export const SEARCHLIGHT_DETECT_S = RULE_PARAMS.searchlights.detectS;
/** O Atlas é mais furtivo: 3 s. */
export const SEARCHLIGHT_DETECT_ATLAS_S = RULE_PARAMS.searchlights.detectAtlasS;

type Searchlight = Extract<SpecialZone, { kind: 'SEARCHLIGHT' }>;

/**
 * Mancha no chão: gira em torno do poste, com ângulo `sweepRad · sin(2π t / período)`,
 * a 50 % do raio da zona, e raio de 35 % do raio da zona.
 */
export function searchlightSpot(
  zone: Searchlight,
  tS: number,
): { u: number; v: number; r: number } {
  const angle = zone.sweepRad * Math.sin((2 * Math.PI * tS) / zone.periodS);
  return {
    u: zone.u + 0.5 * zone.radiusM * Math.cos(angle),
    v: zone.v + 0.5 * zone.radiusM * Math.sin(angle),
    r: 0.35 * zone.radiusM,
  };
}

export function insideSearchlight(
  zones: readonly SpecialZone[],
  u: number,
  v: number,
  tS: number,
): boolean {
  return zones.some((z) => {
    if (z.kind !== 'SEARCHLIGHT') return false;
    const s = searchlightSpot(z, tS);
    return Math.hypot(u - s.u, v - s.v) <= s.r;
  });
}

/** Distância (m) ao holofote mais próximo (para o time warp). */
export function nearestSearchlightM(zones: readonly SpecialZone[], u: number, v: number): number {
  let best = Infinity;
  for (const z of zones)
    if (z.kind === 'SEARCHLIGHT') best = Math.min(best, Math.hypot(u - z.u, v - z.v));
  return best;
}

export interface DetectionState {
  /** Tempo seguido dentro de um cone. */
  inS: number;
  detected: boolean;
}

export const initialDetection = (): DetectionState => ({ inS: 0, detected: false });

/** Acumula o tempo dentro do cone; passando do limite, `detected` fica verdadeiro (e o voo segue). */
export function stepDetection(
  s: DetectionState,
  inside: boolean,
  dtS: number,
  atlas: boolean,
): DetectionState {
  const inS = inside ? s.inS + dtS : 0;
  const limit = atlas ? SEARCHLIGHT_DETECT_ATLAS_S : SEARCHLIGHT_DETECT_S;
  return { inS, detected: s.detected || inS > limit };
}

export const detectionProgress = (s: DetectionState, atlas: boolean): number =>
  Math.min(1, s.inS / (atlas ? SEARCHLIGHT_DETECT_ATLAS_S : SEARCHLIGHT_DETECT_S));

// --- Anéis --------------------------------------------------------------------------

export const RING_COLLECT_M = RULE_PARAMS.rings.collectM;
/** Bônus por anel (R$ 50, em centavos). */
export const RING_BONUS_CENTS = RULE_PARAMS.rings.bonusCents;

/** Coletável quando a aeronave passa a menos de 3 m do centro do anel. */
export function ringCollected(
  o: Pick<WorldObject, 'u' | 'v' | 'heightM' | 'baseM'>,
  body: { u: number; v: number; alt: number },
  groundAt: (u: number, v: number) => number,
): boolean {
  const cy = groundAt(o.u, o.v) + (o.baseM ?? 0) + o.heightM / 2;
  return Math.hypot(body.u - o.u, body.v - o.v, body.alt - cy) < RING_COLLECT_M;
}

// --- Criaturas elétricas ------------------------------------------------------------

export const SPIKE_DURATION_S = RULE_PARAMS.electric.spikeS;
export const SPIKE_FORCE_MS = RULE_PARAMS.electric.forceMs;

export interface Spike {
  startS: number;
  endS: number;
  side: 1 | -1;
}

/** Picos seedados a cada 8–12 s: 2 s de empurrão lateral de 3 m/s. */
export class ElectricSchedule {
  private readonly spikes: Spike[] = [];
  private cursor: number;

  constructor(private readonly rng: Rng) {
    this.cursor = rng.range(...RULE_PARAMS.electric.intervalS);
  }

  private ensure(tS: number): void {
    while (this.cursor <= tS + 12) {
      this.spikes.push({
        startS: this.cursor,
        endS: this.cursor + SPIKE_DURATION_S,
        side: this.rng.next() < 0.5 ? -1 : 1,
      });
      this.cursor += SPIKE_DURATION_S + this.rng.range(...RULE_PARAMS.electric.intervalS);
    }
  }

  /** Pico ativo em `tS`, ou `null`. */
  at(tS: number): Spike | null {
    this.ensure(tS);
    return this.spikes.find((s) => tS >= s.startS && tS < s.endS) ?? null;
  }

  /** Velocidade lateral extra em `tS`. */
  lateralMs(tS: number): number {
    const s = this.at(tS);
    return s ? s.side * SPIKE_FORCE_MS : 0;
  }
}

// --- Time warp (§5.14) -------------------------------------------------------------

export type TimeWarp = 1 | 2 | 4;

/** O ciclo do jogador: ×1 → ×2 → ×4 → ×1. */
export const nextWarp = (w: TimeWarp): TimeWarp => (w === 1 ? 2 : w === 2 ? 4 : 1);

export const WARP_OBJECT_AHEAD_M = 150;
export const WARP_OBJECT_LATERAL_M = 15;
export const WARP_SEARCHLIGHT_M = 100;

export interface WarpContext {
  phase: FlightPhase;
  /** Há objeto sólido a menos de 150 m à frente com |X − Xobj| < 15 m? */
  solidAhead: boolean;
  /** Há alerta crítico ativo? */
  criticalAlert: boolean;
  /** Distância ao holofote mais próximo. */
  searchlightM: number;
}

/** Volta a ×1 quando algo exige atenção. */
export function shouldResetWarp(c: WarpContext): boolean {
  return (
    c.phase !== 'RUN' || c.solidAhead || c.criticalAlert || c.searchlightM < WARP_SEARCHLIGHT_M
  );
}

/** Objeto sólido à frente: `0 < Z < 150 m` e `|X − Xobj| < 15 m` (frame do run). */
export function solidAheadOf(
  objects: ReadonlyArray<{ solid: boolean; X: number; Z: number }>,
  x: number,
): boolean {
  return objects.some(
    (o) =>
      o.solid && o.Z > 0 && o.Z < WARP_OBJECT_AHEAD_M && Math.abs(o.X - x) < WARP_OBJECT_LATERAL_M,
  );
}
