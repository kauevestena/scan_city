import type { StateCreator } from 'zustand';
import { CATALOG, FIELD_EQUIPMENT, getAircraft, getFieldEquipment } from '@/data/catalog';
import { gcpSigma } from '@/domain/accuracy';
import { getContract } from '@/data/contracts';
import { buildFlightPlan, defaultPlanParams } from '@/domain/flightPlanner';
import type { MissionData } from '@/types';
import { selectModifiers } from '../selectors';
import type { GameStore, MissionActions, MissionState } from '../types';

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

  launchMission: () => {
    const { mission, inventory } = get();
    const active = mission.active;
    if (!active) return null;
    const equipment = getFieldEquipment(active.fieldEquipmentId);
    const sigma = gcpSigma(equipment.sigmaBaseM, equipment.id, active.minigames.levelScore);
    const atlas = getAircraft(active.plan.params.aircraftId).energyUnit === 'CORN';
    const calibrated = atlas && inventory.atlasCalibrationFlights > 0;
    const launched: MissionData = {
      ...active,
      groundPoints: active.groundPoints.map((p) => ({ ...p, sigmaM: sigma.xy })),
      atlasCalibrated: calibrated,
      status: 'IN_FLIGHT',
    };
    set((s) => ({
      mission: { ...s.mission, active: launched },
      inventory: calibrated
        ? { ...s.inventory, atlasCalibrationFlights: s.inventory.atlasCalibrationFlights - 1 }
        : s.inventory,
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
    set((s) => ({
      mission: {
        ...s.mission,
        active: {
          ...active,
          shots,
          completedLines: completed,
          sorties: [
            ...active.sorties,
            { index, outcome: result.outcome, durationS: result.durationS },
          ],
          events: {
            ...active.events,
            crashes: active.events.crashes + (result.outcome === 'CRASH' ? 1 : 0),
          },
        },
      },
    }));
    get().addStats({
      photosTaken: kept,
      flightTimeS: result.durationS,
      crashes: result.outcome === 'CRASH' ? 1 : 0,
    });
  },

  resumePlanning: () =>
    set((s) =>
      s.mission.active
        ? { mission: { ...s.mission, active: { ...s.mission.active, status: 'PLANNING' } } }
        : s,
    ),

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
