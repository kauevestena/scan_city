/**
 * Voo de uma missão inteira sem render (ADR-032): as surtidas que a aeronave permite, com o
 * plano de referência, um piloto simulado e a avaliação de verdade no fim. A missão é
 * atualizada como a store faz em `endSortie` (fotos, passadas e LiDAR da surtida perdida
 * descartados).
 */
import { CATALOG, getAircraft, HARDWARE } from '@/data/catalog';
import { createCoverageGrid } from '@/domain/coverage';
import { computePayment, computeRewards } from '@/domain/economy';
import { missionExecution, passAccepted } from '@/domain/execution';
import { plannedSamples } from '@/domain/corridor';
import { evaluateMission } from '@/domain/mission';
import { neutralModifiers } from '@/domain/modifiers';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams, referencePoints } from '@/domain/referencePlan';
import { FlightEngine, type SortieResult } from '@/engines/flight/FlightEngine';
import { mulberry32 } from '@/lib/rng';
import type { Contract, LidarGrid, MissionData, QualityReport, Shot } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { idlePilot, MediumPilot, PILOT_STEP_S, type PilotKind } from './pilots';

export interface FlownMission {
  contractId: string;
  pilot: PilotKind;
  mission: MissionData;
  report: QualityReport;
  execution: number;
  outcomes: string[];
  /** Linhas recusadas em alguma passada. */
  refused: number;
  /** Duração de cada surtida (tempo de jogo, em s). */
  sortieS: number[];
  /** Tempo real de cada surtida, com o fator de tempo de cada passo. */
  wallS: number[];
  /** Amostras Fracas ou Rejeitadas por eixo que derrubou a nota (diagnóstico). */
  missesByAxis: Record<string, number>;
}

function emptyGrid(contract: Contract): LidarGrid {
  const g = createCoverageGrid(contract.aoi);
  const n = g.cols * g.rows;
  return {
    cols: g.cols,
    rows: g.rows,
    pulses: new Array<number>(n).fill(0),
    firstAbove: new Array<number>(n).fill(0),
    ground: new Array<number>(n).fill(0),
    cellAreaM2: g.cellLengthM * g.cellWidthM,
  };
}

/** Funde o resultado de uma surtida na missão, como a store (`endSortie`). */
function applySortie(
  contract: Contract,
  m: MissionData,
  r: SortieResult,
  shots: Shot[],
  index: number,
): MissionData {
  const lost = r.outcome === 'CRASH' || r.outcome === 'ENERGY_DEPLETED';
  let lidar = m.lidar;
  if (!lost && r.lidar) {
    const grid = lidar?.grid ?? emptyGrid(contract);
    const pulses = [...grid.pulses];
    const firstAbove = [...grid.firstAbove];
    const ground = [...grid.ground];
    for (const [k, p, f, g] of r.lidar.cells) {
      pulses[k] = (pulses[k] ?? 0) + p;
      firstAbove[k] = (firstAbove[k] ?? 0) + f;
      ground[k] = (ground[k] ?? 0) + g;
    }
    lidar = { grid: { ...grid, pulses, firstAbove, ground }, samples: [] };
  }
  return {
    ...m,
    shots: lost ? m.shots : [...m.shots, ...shots],
    completedLines: lost
      ? m.completedLines
      : [...new Set([...m.completedLines, ...r.completedLines])].sort((a, b) => a - b),
    linePasses: [...(m.linePasses ?? []), ...(lost ? [] : r.linePasses)],
    sorties: [...m.sorties, { index, outcome: r.outcome, durationS: r.durationS }],
    events: {
      collisions: m.events.collisions + r.collisions,
      crashes: m.events.crashes + (r.outcome === 'CRASH' ? 1 : 0),
      detected: m.events.detected || r.detected,
      featuresCaptured: lost
        ? m.events.featuresCaptured
        : [...new Set([...m.events.featuresCaptured, ...r.featuresCaptured])],
      ringsCollected: m.events.ringsCollected + (lost ? 0 : r.rings),
    },
    ...(lidar ? { lidar } : {}),
  };
}

/** Quantas surtidas a missão permite: 1 + reservas; o Atlas, três papos cheios. */
export function sortiesAllowed(aircraftId: string): number {
  const a = getAircraft(aircraftId as Parameters<typeof getAircraft>[0]);
  return a.kind === 'BIRD' ? 3 : 1 + a.spareBatteries;
}

export function flyMission(contract: Contract, pilot: PilotKind, seed = 1): FlownMission {
  const terrain = createTerrain(contract);
  const plan = buildFlightPlan(referenceParams(contract), contract, CATALOG);
  let mission: MissionData = {
    id: `${contract.id}-${pilot}-${seed}`,
    contractId: contract.id,
    createdAt: 0,
    rivalAdjustment: 1,
    isReplay: false,
    plan,
    groundPoints: referencePoints(contract, terrain),
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: [],
    completedLines: [],
    linePasses: [],
    shots: [],
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
    status: 'IN_FLIGHT',
  };
  const outcomes: string[] = [];
  const missesByAxis: Record<string, number> = {};
  const sortieS: number[] = [];
  const wallS: number[] = [];
  const allowed = sortiesAllowed(plan.params.aircraftId);
  let now = 0;
  for (let sortie = 0; sortie < allowed; sortie++) {
    if (mission.completedLines.length >= plan.lines.length) break;
    const shots: Shot[] = [];
    let result: SortieResult | undefined;
    const medium =
      pilot === 'MEDIUM' || pilot === 'ALIGN'
        ? new MediumPilot(
            seed * 7919 + sortie,
            {
              speedMs: plan.params.speedMs,
              spacingM: plan.stats.spacingM,
              heightM: plan.params.heightM,
            },
            pilot === 'ALIGN',
          )
        : null;
    const e = new FlightEngine({
      mission,
      contract,
      terrain,
      catalog: CATALOG,
      input: medium ?? idlePilot,
      mods: neutralModifiers(),
      ownsRtkKit: true,
      autopilot: pilot === 'GOOD',
      quality: () => 'LOW',
      reduceFlashes: () => true,
      colors: { primary: '#fff', secondary: '#000' },
      sortie,
      shotOffset: mission.shots.length,
      onShots: (b) => shots.push(...b),
      onSortieEnd: (r) => (result = r),
      onGrade: (g) => {
        if (g.grade === 'WEAK' || g.grade === 'REJECTED') {
          const k = g.axis ?? 'blur';
          missesByAxis[k] = (missesByAxis[k] ?? 0) + 1;
        }
      },
      now: () => (now += 16),
    });
    medium?.attach(e);
    let wall = 0;
    let steps = 0;
    const ended = () => e.phase === 'POST_FLIGHT';
    for (let t = 0; t < 4000 && !ended();) {
      // O piloto (mediano ou parado) volta à base quando o alarme toca.
      if (pilot !== 'GOOD' && e.phase === 'RUN' && e.rthRecommended()) {
        e.requestRth();
        e.requestRth();
      }
      // Um quadro de 60 Hz: o ritmo do voo vezes o cruzeiro (fracionário) dá quantos passos de
      // física ele tem; cada passo vale 1/(60·escala) s de tempo real para o piloto.
      const scale = e.timeScale;
      steps += scale;
      while (steps >= 1 && !ended()) {
        medium?.tick(PILOT_STEP_S / scale);
        e.update(PILOT_STEP_S);
        t += PILOT_STEP_S;
        steps -= 1;
      }
      wall += PILOT_STEP_S;
    }
    if (!result) throw new Error(`${contract.id}: a surtida ${sortie} não terminou`);
    const r: SortieResult = result;
    outcomes.push(r.outcome);
    sortieS.push(r.durationS);
    wallS.push(wall);
    mission = applySortie(contract, mission, r, shots, sortie);
  }
  mission = { ...mission, status: 'PENDING_PROCESSING' };
  const report = evaluateMission(mission, contract, {
    catalog: CATALOG,
    terrain,
    ownsRtkKit: true,
    modifiers: neutralModifiers(),
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    hardware: HARDWARE[0] as (typeof HARDWARE)[number],
    inField: false,
    firstApproval: true,
    rng: mulberry32(7),
    deps: { computePayment, computeRewards },
  });
  const planned = plan.lines.map((l) => plannedSamples(l, plan.stats.baseM));
  return {
    contractId: contract.id,
    pilot,
    mission,
    report,
    execution: missionExecution(mission.linePasses, planned),
    outcomes,
    refused: (mission.linePasses ?? []).filter(
      (p) => p.complete && !passAccepted(p, planned[p.lineIndex] ?? 0),
    ).length,
    sortieS,
    wallS,
    missesByAxis,
  };
}
