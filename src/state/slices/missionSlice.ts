import type { StateCreator } from 'zustand';
import { CATALOG, FIELD_EQUIPMENT, getAircraft, getFieldEquipment } from '@/data/catalog';
import { SOUVENIRS } from '@/data/souvenirs';
import { STRINGS } from '@/data/strings';
import { gcpSigma } from '@/domain/accuracy';
import { createCoverageGrid } from '@/domain/coverage';
import { sectorIncomePerMin } from '@/domain/museum';
import { canStartNewSortie, feedCrop } from '@/domain/sorties';
import { getContract } from '@/data/contracts';
import { buildFlightPlan, defaultPlanParams } from '@/domain/flightPlanner';
import type { LidarGrid, MissionData } from '@/types';
import { selectModifiers } from '../selectors';
import type { GameStore, MissionActions, MissionState } from '../types';

/**
 * OQ-010: sem outro contrato jogável (disponível ou concluído), o roubo travaria o jogo,
 * porque o contrato só volta depois de concluir outro. Nesse caso a MegaMap não leva.
 */
export function canBeStolen(contracts: GameStore['contracts'], contractId: string): boolean {
  return Object.entries(contracts).some(
    ([id, p]) => id !== contractId && (p.status === 'AVAILABLE' || p.status === 'COMPLETED'),
  );
}

export const MAX_LIDAR_SAMPLES = 50_000;

function emptyLidarGrid(contractId: string): LidarGrid {
  const aoi = getContract(contractId).aoi;
  const g = createCoverageGrid(aoi);
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

export function initialMission(): MissionState {
  return { active: null, pending: [] };
}

export const createMissionSlice: StateCreator<
  GameStore,
  [],
  [],
  { mission: MissionState } & MissionActions
> = (set, get) => ({
  mission: initialMission(),

  beginMission: (mission) => set((s) => ({ mission: { ...s.mission, active: mission } })),

  startMission: (contractId, rivalAdjustment) => {
    const state = get();
    const contract = getContract(contractId);
    const params = defaultPlanParams(contract, state.inventory, CATALOG);
    const plan = buildFlightPlan(params, contract, CATALOG, {
      enduranceMod: selectModifiers(state).endurance,
    });
    const owned = FIELD_EQUIPMENT.filter((f) => state.inventory.fieldEquipment.includes(f.id));
    const now = Date.now();
    const mission: MissionData = {
      id: `${contractId}-${now}`,
      contractId,
      createdAt: now,
      rivalAdjustment,
      isReplay: state.contracts[contractId]?.status === 'COMPLETED',
      plan,
      groundPoints: [],
      fieldEquipmentId: owned[0]?.id ?? 'TOTAL_STATION',
      minigames: {},
      atlasCalibrated: false,
      sorties: [],
      completedLines: [],
      shots: [],
      events: {
        collisions: 0,
        crashes: 0,
        detected: false,
        featuresCaptured: [],
        ringsCollected: 0,
      },
      status: 'PLANNING',
    };
    set((s) => ({ mission: { ...s.mission, active: mission } }));
    return mission;
  },

  updatePlan: (params, options = {}) => {
    const state = get();
    const active = state.mission.active;
    if (!active) return;
    const plan = buildFlightPlan(params, getContract(active.contractId), CATALOG, {
      enduranceMod: selectModifiers(state).endurance,
      ...options,
    });
    set((s) => ({ mission: { ...s.mission, active: { ...active, plan } } }));
  },

  setGroundPoints: (points) =>
    set((s) =>
      s.mission.active
        ? { mission: { ...s.mission, active: { ...s.mission.active, groundPoints: points } } }
        : s,
    ),

  setFlightDifficulty: (difficulty) =>
    set((s) =>
      s.mission.active
        ? { mission: { ...s.mission, active: { ...s.mission.active, difficulty } } }
        : s,
    ),

  setFieldEquipment: (id) =>
    set((s) => {
      const active = s.mission.active;
      if (!active || !s.inventory.fieldEquipment.includes(id)) return s;
      return { mission: { ...s.mission, active: { ...active, fieldEquipmentId: id } } };
    }),

  recordMinigame: (kind, score) =>
    set((s) => {
      const active = s.mission.active;
      if (!active) return s;
      const key = kind === 'level' ? 'levelScore' : 'imuScore';
      const clamped = Math.max(0, Math.min(1, score));
      const best = Math.max(active.minigames[key] ?? 0, clamped);
      return {
        mission: {
          ...s.mission,
          active: { ...active, minigames: { ...active.minigames, [key]: best } },
        },
      };
    }),

  launchMission: () => {
    const { mission, inventory } = get();
    const active = mission.active;
    if (!active) return null;
    const equipment = getFieldEquipment(active.fieldEquipmentId);
    const sigma = gcpSigma(equipment.sigmaBaseM, equipment.id, active.minigames.levelScore);
    const atlas = getAircraft(active.plan.params.aircraftId).energyUnit === 'CORN';
    const calibrated = atlas && inventory.atlasCalibrationFlights > 0;
    // O pombo é alimentado antes de decolar: o papo enche com o estoque.
    const corn = atlas ? feedCrop(inventory.corn) : inventory.corn;
    const launched: MissionData = {
      ...active,
      groundPoints: active.groundPoints.map((p) => ({ ...p, sigmaM: sigma.xy })),
      atlasCalibrated: calibrated,
      status: 'IN_FLIGHT',
    };
    set((s) => ({
      mission: { ...s.mission, active: launched },
      inventory: {
        ...s.inventory,
        corn,
        atlasCalibrationFlights: calibrated
          ? s.inventory.atlasCalibrationFlights - 1
          : s.inventory.atlasCalibrationFlights,
      },
    }));
    return launched;
  },

  appendShots: (shots) =>
    set((s) => {
      const active = s.mission.active;
      if (!active || shots.length === 0) return s;
      return {
        mission: { ...s.mission, active: { ...active, shots: [...active.shots, ...shots] } },
      };
    }),

  mergeLidar: (batch) =>
    set((s) => {
      const active = s.mission.active;
      if (!active) return s;
      const grid = active.lidar?.grid ?? emptyLidarGrid(active.contractId);
      const pulses = [...grid.pulses];
      const firstAbove = [...grid.firstAbove];
      const ground = [...grid.ground];
      for (const [k, p, f, g] of batch.cells) {
        pulses[k] = (pulses[k] ?? 0) + p;
        firstAbove[k] = (firstAbove[k] ?? 0) + f;
        ground[k] = (ground[k] ?? 0) + g;
      }
      const samples = [...(active.lidar?.samples ?? []), ...batch.samples].slice(
        0,
        MAX_LIDAR_SAMPLES,
      );
      const lidar = { grid: { ...grid, pulses, firstAbove, ground }, samples };
      return { mission: { ...s.mission, active: { ...active, lidar } } };
    }),

  endSortie: (result) => {
    const active = get().mission.active;
    if (!active) return;
    const index = active.sorties.length;
    const lost = result.outcome === 'CRASH' || result.outcome === 'ENERGY_DEPLETED';
    const shots = lost ? active.shots.filter((shot) => shot.sortie !== index) : active.shots;
    const completed = lost
      ? active.completedLines
      : [...new Set([...active.completedLines, ...result.completedLines])].sort((a, b) => a - b);
    const kept = shots.filter((shot) => shot.sortie === index).length;
    // As passadas de uma surtida perdida vão embora com as fotos dela.
    const linePasses =
      result.linePasses === undefined
        ? active.linePasses
        : [...(active.linePasses ?? []), ...(lost ? [] : result.linePasses)];
    set((s) => ({
      mission: {
        ...s.mission,
        active: {
          ...active,
          shots,
          completedLines: completed,
          ...(linePasses ? { linePasses } : {}),
          sorties: [
            ...active.sorties,
            { index, outcome: result.outcome, durationS: result.durationS },
          ],
          events: {
            ...active.events,
            crashes: active.events.crashes + (result.outcome === 'CRASH' ? 1 : 0),
            collisions: active.events.collisions + (result.collisions ?? 0),
            detected: active.events.detected || (result.detected ?? false),
            ringsCollected: active.events.ringsCollected + (lost ? 0 : (result.rings ?? 0)),
            featuresCaptured: lost
              ? active.events.featuresCaptured
              : [
                  ...new Set([
                    ...active.events.featuresCaptured,
                    ...(result.featuresCaptured ?? []),
                  ]),
                ],
          },
        },
      },
    }));
    // Os dados LiDAR de uma surtida perdida nunca chegam à missão.
    if (!lost && result.lidar) get().mergeLidar(result.lidar);
    if (result.cornUsed) {
      // O voo gasta milho do papo; o estoque só entra quando o Atlas é alimentado.
      set((s) => ({
        inventory: {
          ...s.inventory,
          corn: {
            ...s.inventory.corn,
            crop: Math.max(0, s.inventory.corn.crop - (result.cornUsed ?? 0)),
          },
        },
      }));
    }
    get().addStats({
      photosTaken: kept,
      flightTimeS: result.durationS,
      crashes: result.outcome === 'CRASH' ? 1 : 0,
    });
  },

  startNewSortie: () => {
    const { mission, inventory } = get();
    const active = mission.active;
    if (!active) return false;
    const aircraft = getAircraft(active.plan.params.aircraftId);
    if (!canStartNewSortie(active, aircraft, inventory)) return false;
    if (aircraft.energyUnit === 'CORN') {
      set((s) => ({ inventory: { ...s.inventory, corn: feedCrop(s.inventory.corn) } }));
    }
    set((s) =>
      s.mission.active
        ? { mission: { ...s.mission, active: { ...s.mission.active, status: 'IN_FLIGHT' } } }
        : s,
    );
    return true;
  },

  resumePlanning: () =>
    set((s) =>
      s.mission.active
        ? { mission: { ...s.mission, active: { ...s.mission.active, status: 'PLANNING' } } }
        : s,
    ),

  applyMissionResult: (report) => {
    const state = get();
    const pending = state.mission.pending.find((m) => m.id === report.missionId);
    const active = state.mission.active?.id === report.missionId ? state.mission.active : null;
    const mission = pending ?? active;
    if (!mission || mission.status === 'PROCESSED') return false;
    const contract = getContract(report.contractId);
    const progress = state.contracts[contract.id] ?? {
      status: 'LOCKED',
      completions: 0,
      bestScore: 0,
    };

    // A missão sai da fila (ou da missão ativa, em campo) antes de tudo: idempotência.
    set((s) => ({
      mission: {
        active: s.mission.active?.id === mission.id ? null : s.mission.active,
        pending: s.mission.pending.filter((m) => m.id !== mission.id),
      },
    }));

    if (report.payment.totalBRL > 0) {
      get().earn(report.payment.totalBRL, STRINGS.contracts.payment(contract.title));
    }

    get().grantXp(report.xp);

    // Contrato: aprovação conclui; falha crítica (fora do replay) é roubada pela MegaMap.
    const better = report.qualityScore > progress.bestScore;
    if (report.approved) {
      set((s) => ({
        contracts: {
          ...s.contracts,
          [contract.id]: {
            ...progress,
            status: 'COMPLETED',
            completions: progress.completions + 1,
            bestScore: Math.max(progress.bestScore, report.qualityScore),
            ...(better
              ? {
                  bestClass: report.pec?.planimetric.achieved ?? progress.bestClass,
                  bestMissionLines: mission.plan.lines.map((l) => ({ start: l.start, end: l.end })),
                  bestAircraftId: mission.plan.params.aircraftId,
                }
              : {}),
          },
        },
        stats: { ...s.stats, contractsCompleted: s.stats.contractsCompleted + 1 },
      }));
      // Museu: o setor só é trocado por um resultado melhor (§5.9).
      const sector = state.museum.sectors[contract.id];
      if (!sector || report.qualityScore > sector.qualityScore) {
        set((s) => ({
          museum: {
            ...s.museum,
            sectors: {
              ...s.museum.sectors,
              [contract.id]: {
                contractId: contract.id,
                qualityScore: report.qualityScore,
                mappedAt: Date.now(),
                incomePerMinBRL: sectorIncomePerMin(
                  contract.museum.incomePerMinBRL,
                  report.qualityScore,
                ),
                className: report.pec?.planimetric.achieved ?? '',
              },
            },
          },
        }));
      }
      // Contratos roubados voltam depois de concluir outro (progression §8).
      const done = get().stats.contractsCompleted;
      set((s) => ({
        contracts: Object.fromEntries(
          Object.entries(s.contracts).map(([id, p]) =>
            p.status === 'STOLEN' && (p.stolenAtCompletionCount ?? 0) < done
              ? [id, { ...p, status: 'AVAILABLE' as const }]
              : [id, p],
          ),
        ),
      }));
    } else if (report.critical && !mission.isReplay && canBeStolen(get().contracts, contract.id)) {
      get().steal(contract.id);
    }

    if (report.souvenirAwarded && !get().souvenirs.includes(report.souvenirAwarded)) {
      const souvenir = SOUVENIRS.find((sv) => sv.id === report.souvenirAwarded);
      set((s) => ({ souvenirs: [...s.souvenirs, report.souvenirAwarded as string] }));
      get().pushToast({ type: 'success', title: STRINGS.contracts.souvenir(souvenir?.name ?? '') });
    }

    // A reputação vem por último: ela já dispara a reavaliação dos desbloqueios.
    if (report.reputationDelta !== 0) get().changeReputation(report.reputationDelta);
    else get().refreshUnlocks();
    return true;
  },

  queueActive: () =>
    set((s) => {
      const { active } = s.mission;
      if (!active) return s;
      return {
        mission: {
          active: null,
          pending: [...s.mission.pending, { ...active, status: 'PENDING_PROCESSING' }],
        },
      };
    }),

  discardActive: () => set((s) => ({ mission: { ...s.mission, active: null } })),

  consumePending: (missionId) => {
    const found = get().mission.pending.find((m) => m.id === missionId) ?? null;
    if (found) {
      set((s) => ({
        mission: { ...s.mission, pending: s.mission.pending.filter((m) => m.id !== missionId) },
      }));
    }
    return found;
  },
});
