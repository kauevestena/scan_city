/**
 * Passada por uma linha (survey-flight §5.7, §5.13, §5.19 e §5.20): o que o motor sorteia e
 * calcula ao começar cada linha (o corredor, as rajadas e o erro de entrada) e a contagem
 * das notas enquanto ela é voada. Determinístico pela missão, surtida, linha e passada.
 */
import {
  corridorProfile,
  gatePositions,
  plannedSamples,
  type CorridorProfile,
} from '@/domain/corridor';
import { addGrade, emptyCounts, passAccepted } from '@/domain/execution';
import {
  ENTRY_GRACE_S,
  entryOffsetM,
  maxCorrectableM,
  planGusts,
  windRelativeRad,
  type Gust,
} from '@/domain/gusts';
import { hashString, mulberry32 } from '@/lib/rng';
import type {
  Aircraft,
  Contract,
  FlightLine,
  FlightPlan,
  GradeCounts,
  LinePass,
  ShotGrade,
} from '@/types';
import type { RunFrame } from './runFrame';

export interface LinePassInput {
  missionId: string;
  sortie: number;
  /** 0 na primeira passada da linha na missão, 1 no primeiro revoo… */
  pass: number;
  line: FlightLine;
  frame: RunFrame;
  plan: FlightPlan;
  aircraft: Aircraft;
  contract: Pick<Contract, 'wind' | 'ceilingM'>;
  /** Elevação do terreno ao longo do eixo da linha. */
  elevationAlong: (s: number) => number;
  /** Sem rajadas e sem erro de entrada (testes de outros sistemas e `?calm=1`). */
  calm: boolean;
}

export interface LinePassState {
  lineIndex: number;
  pass: number;
  gusts: Gust[];
  profile: CorridorProfile;
  /** Posição `s` de cada portal. */
  gates: number[];
  /** Amostras planejadas (portais a partir do início da AOI). */
  planned: number;
  /** Deslocamento lateral com que a aeronave entra na linha. */
  entryOffsetM: number;
  counts: GradeCounts;
  /** Índice do próximo portal a cruzar. */
  nextGate: number;
  /** `s` da foto automática anterior desta passada (para o avanço). */
  lastAutoS: number | null;
}

/** Semente da passada: a mesma missão, surtida, linha e passada repetem o sorteio. */
export function passSeed(missionId: string, sortie: number, lineIndex: number, pass: number) {
  return hashString(`${missionId}:${sortie}:${lineIndex}:${pass}`);
}

/** Corredor, rajadas e erro de entrada de uma passada. */
export function beginLinePass(i: LinePassInput): LinePassState {
  const { plan, aircraft, frame, line } = i;
  const speed = Math.max(0.1, plan.params.speedMs);
  const rng = mulberry32(passSeed(i.missionId, i.sortie, line.index, i.pass));
  const leadInS = line.aoiStartS / speed;
  const profile = corridorProfile(i.elevationAlong, frame.lengthM, {
    heightM: plan.params.heightM,
    speedMs: speed,
    climbRateMs: aircraft.climbRateMs,
    ceilingAglM: Math.min(aircraft.hMaxM, i.contract.ceilingM),
  });
  const gusts = i.calm
    ? []
    : planGusts(
        rng.fork('gusts'),
        i.contract.wind,
        windRelativeRad(i.contract.wind.directionDeg, frame.dir, frame.right),
        frame.lengthM / speed,
        leadInS,
      );
  const entry = i.calm
    ? 0
    : entryOffsetM(
        rng.fork('entry'),
        plan.stats.spacingM,
        maxCorrectableM(aircraft, speed, leadInS + ENTRY_GRACE_S),
      );
  return {
    lineIndex: line.index,
    pass: i.pass,
    gusts,
    profile,
    gates: gatePositions(line, plan.stats.baseM),
    planned: plannedSamples(line, plan.stats.baseM),
    entryOffsetM: entry,
    counts: emptyCounts(),
    nextGate: 0,
    lastAutoS: null,
  };
}

/** Soma uma amostra à contagem da passada. */
export function tallyGrade(state: LinePassState, grade: ShotGrade): void {
  state.counts = addGrade(state.counts, grade);
}

/** Fecha a passada: o resumo que vai para a missão e se a linha foi aceita. */
export function closeLinePass(
  state: LinePassState,
  sortie: number,
  complete: boolean,
): { pass: LinePass; accepted: boolean } {
  const pass: LinePass = {
    lineIndex: state.lineIndex,
    pass: state.pass,
    sortie,
    counts: state.counts,
    complete,
  };
  return { pass, accepted: passAccepted(pass, state.planned) };
}
