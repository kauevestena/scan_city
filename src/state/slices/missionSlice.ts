import type { StateCreator } from 'zustand';
import { CATALOG, FIELD_EQUIPMENT } from '@/data/catalog';
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
