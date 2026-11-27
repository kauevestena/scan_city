/**
 * Cruzeiro automático (survey-flight §5.14, REQ-FLT-023, ADR-031): o tempo acelera sozinho
 * quando a aeronave está estável no corredor e nada pede atenção, e volta a ×1 no instante em
 * que uma condição cai. O fator multiplica o ritmo base do voo (`FLIGHT_TEMPO`, ADR-034).
 * Puro: o motor monta o contexto a cada passo.
 */
import { clamp } from '@/lib/math';
import type { FlightPhase } from './hudPublisher';

/** Tempo estável seguido antes de acelerar. */
export const CRUISE_ARM_S = 1;
/** O fator sobe tanto por segundo de tempo real. */
export const CRUISE_RAMP_PER_S = 4;
/**
 * Fator máximo: uma unidade a cada tantos segundos **reais** de linha, de ×2 a ×4 (sobre o ritmo
 * ×1,75, o mundo chega a ×7, perto do ×8 do autopilot de depuração).
 */
export const CRUISE_SECONDS_PER_STEP = 12;
export const CRUISE_MIN_MAX = 2;
export const CRUISE_MAX_MAX = 4;
/**
 * O cruzeiro cai este tempo (de simulação) antes de a frente de vento aparecer: a rajada chega
 * sempre no ritmo base, nunca acelerada.
 */
export const CRUISE_GUST_LEAD_S = 0.5;
/** Distância (m) e afastamento lateral (m) do objeto sólido que derruba o cruzeiro. */
export const CRUISE_OBJECT_AHEAD_M = 150;
export const CRUISE_OBJECT_LATERAL_M = 15;
/** Distância ao holofote mais próximo que derruba o cruzeiro. */
export const CRUISE_SEARCHLIGHT_M = 100;
/** Antecedência com que um pico elétrico derruba o cruzeiro. */
export const CRUISE_SPIKE_LEAD_S = 1.5;
/**
 * O cruzeiro cai este tempo (real, no ritmo base) antes do fim da linha quando há outra linha:
 * a manobra da curva acontece sempre no ritmo base, e o aviso da curva (3 s antes) já aparece
 * com o mundo em ×1.
 */
export const CRUISE_TURN_LEAD_S = 3.5;
/** Sem TF, o corredor não pode mudar mais que esta fração de H à frente. */
export const CRUISE_CORRIDOR_CHANGE = 0.05;

/** Fator máximo da linha: `clamp(round(T/12), 2, 4)`, com `T` a duração real da linha. */
export function cruiseMaxFor(lineDurationS: number): number {
  return clamp(Math.round(lineDurationS / CRUISE_SECONDS_PER_STEP), CRUISE_MIN_MAX, CRUISE_MAX_MAX);
}

export interface CruiseContext {
  phase: FlightPhase;
  /** O jogador deixou o cruzeiro ligado (`TIME_WARP`). */
  on: boolean;
  /** A nota do instante é Boa ou Perfeita. */
  steady: boolean;
  /** Rajada ou corrente vertical avisada (ou prestes a ser) ou em curso. */
  gust: boolean;
  /** A curva para a próxima linha está a menos de 3 s (ou já pedida). Padrão: falso. */
  turnSoon?: boolean;
  /** Objeto sólido a menos de 150 m à frente, a menos de 15 m de lado. */
  solidAhead: boolean;
  criticalAlert: boolean;
  /** Distância ao holofote mais próximo. */
  searchlightM: number;
  /** Atlas avisado ou distraído. */
  atlasDistracted: boolean;
  /** Pico elétrico em curso ou nos próximos 1,5 s. */
  spikeSoon: boolean;
  /** Sem TF: a maior mudança da altitude do corredor à frente, sobre H. `0` com TF. */
  corridorChange: number;
}

/** Todas as condições do cruzeiro (survey-flight §5.14). */
export function cruiseEligible(c: CruiseContext): boolean {
  return (
    c.phase === 'RUN' &&
    c.on &&
    c.steady &&
    !c.gust &&
    c.turnSoon !== true &&
    !c.solidAhead &&
    !c.criticalAlert &&
    c.searchlightM >= CRUISE_SEARCHLIGHT_M &&
    !c.atlasDistracted &&
    !c.spikeSoon &&
    c.corridorChange <= CRUISE_CORRIDOR_CHANGE
  );
}

export interface CruiseState {
  factor: number;
  /** Tempo real seguido com todas as condições. */
  steadyS: number;
}

export const initialCruise = (): CruiseState => ({ factor: 1, steadyS: 0 });

/**
 * Um passo do cruzeiro em tempo real: sem as condições, ×1 na hora; com elas por 1 s, o
 * fator sobe a 4 por segundo até o máximo da linha.
 */
export function stepCruise(
  state: CruiseState,
  eligible: boolean,
  dtRealS: number,
  maxFactor: number,
): CruiseState {
  if (!eligible) return initialCruise();
  const steadyS = state.steadyS + dtRealS;
  if (steadyS < CRUISE_ARM_S) return { factor: 1, steadyS };
  return { factor: Math.min(maxFactor, state.factor + CRUISE_RAMP_PER_S * dtRealS), steadyS };
}

/** Objeto sólido à frente: `0 < Z < 150 m` e `|X − Xobj| < 15 m` (frame do run). */
export function solidAheadOf(
  objects: ReadonlyArray<{ solid: boolean; X: number; Z: number }>,
  x: number,
): boolean {
  return objects.some(
    (o) =>
      o.solid &&
      o.Z > 0 &&
      o.Z < CRUISE_OBJECT_AHEAD_M &&
      Math.abs(o.X - x) < CRUISE_OBJECT_LATERAL_M,
  );
}
