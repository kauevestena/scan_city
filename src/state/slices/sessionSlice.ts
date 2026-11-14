import type { StateCreator } from 'zustand';
import { canTransition, InvalidTransitionError, runEnterHooks, runExitHooks } from '../machine';
import type { GameStore, ScreenPayload, SessionActions, SessionState } from '../types';

export function initialSession(): SessionState {
  return {
    screen: 'OFFICE',
    payload: undefined,
    paused: false,
    toasts: [],
    activeModal: null,
    transactions: [],
  };
}

let nextToastId = 1;

export const createSessionSlice: StateCreator<
  GameStore,
  [],
  [],
  { session: SessionState } & SessionActions
> = (set, get) => ({
  session: initialSession(),

  goTo: (to, payload) => {
    const state = get();
    const from = state.session.screen;
    if (!canTransition(from, to, state, payload)) {
      const error = new InvalidTransitionError(from, to);
      if (import.meta.env.DEV) throw error;
      console.warn(error.message);
      return;
    }
    const next = payload as ScreenPayload;
    runExitHooks(from);
    runEnterHooks(to, next);
    set((s) => ({ session: { ...s.session, screen: to, payload: next } }));
  },

  setPaused: (paused) => set((s) => ({ session: { ...s.session, paused } })),

  pushToast: (toast) => {
    const id = `toast-${nextToastId++}`;
    set((s) => ({ session: { ...s.session, toasts: [...s.session.toasts, { ...toast, id }] } }));
    return id;
  },

  dismissToast: (id) =>
    set((s) => ({
      session: { ...s.session, toasts: s.session.toasts.filter((t) => t.id !== id) },
    })),

  openModal: (id) => set((s) => ({ session: { ...s.session, activeModal: id } })),
  closeModal: () => set((s) => ({ session: { ...s.session, activeModal: null } })),
});
