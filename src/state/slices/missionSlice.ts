import type { StateCreator } from 'zustand';
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
