import { createDebugMission, prepareDebugTransition } from '@/app/debugFixtures';
import { resetGameStore } from '@/test/resetStore';
import type { ScreenId } from '@/types';
import {
  canTransition,
  findTransition,
  InvalidTransitionError,
  registerScreenHooks,
  SCREEN_IDS,
  SCREEN_TRANSITIONS,
  transitionsFrom,
} from './machine';
import { useGameStore } from './store';

const store = useGameStore;

beforeEach(() => {
  resetGameStore();
  vi.unstubAllEnvs();
});

/** Coloca a store na tela de origem, com o estado que satisfaz a guarda, e devolve o payload. */
function arrange(id: string) {
  const def = SCREEN_TRANSITIONS.find((t) => t.id === id);
  if (!def) throw new Error(`Transição ${id} não existe`);
  const inField = id === 'T13';
  store.setState((s) => ({
    session: {
      ...s.session,
      screen: def.from,
      payload: def.from === 'PROCESSING_RESULTS' ? { missionId: 'm', inField } : undefined,
    },
  }));
  return { def, payload: prepareDebugTransition(def) };
}

describe('SCREEN_TRANSITIONS', () => {
  it('tem as 16 transições T1–T16, com pares (de, para) únicos', () => {
    expect(SCREEN_TRANSITIONS.map((t) => t.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `T${i + 1}`),
    );
    const pairs = new Set(SCREEN_TRANSITIONS.map((t) => `${t.from}>${t.to}`));
    expect(pairs.size).toBe(16);
    expect(SCREEN_IDS).toHaveLength(7);
  });

  it.each(SCREEN_TRANSITIONS.map((t) => [t.id, t.from, t.to] as const))(
    '%s (%s → %s) é aceita com a guarda satisfeita',
    (id) => {
      const { def, payload } = arrange(id);
      expect(canTransition(def.from, def.to, store.getState(), payload)).toBe(true);
      store.getState().goTo(def.to, payload as never);
      expect(store.getState().session.screen).toBe(def.to);
      expect(store.getState().session.payload).toEqual(payload);
    },
  );

  it('rejeita as outras 26 combinações (42 − 16)', () => {
    // Estado "permissivo": missão ativa com dados, fila, setor e Van, para nenhuma guarda ajudar.
    for (const id of ['T4', 'T6', 'T9', 'T11']) arrange(id);
    const state = store.getState();
    const payload = {
      missionId: state.mission.active?.id,
      contractId: 'C00',
      rivalAdjustment: 1,
      inField: true,
      outcome: 'QUEUED',
      focusSectorId: 'C00',
    };
    let rejected = 0;
    for (const from of SCREEN_IDS) {
      for (const to of SCREEN_IDS) {
        if (from === to || findTransition(from, to)) continue;
        expect(canTransition(from, to, state, payload), `${from} → ${to}`).toBe(false);
        rejected++;
      }
    }
    expect(rejected).toBe(26);
  });

  it('uma tela não transiciona para si mesma', () => {
    for (const s of SCREEN_IDS) expect(canTransition(s, s, store.getState())).toBe(false);
  });

  it('transitionsFrom lista as saídas de cada tela', () => {
    const count = (s: ScreenId) => transitionsFrom(s).length;
    expect(count('OFFICE')).toBe(4);
    expect(count('WORLD_MAP')).toBe(2);
    expect(count('FIELD_SETUP')).toBe(2);
    expect(count('SURVEY_FLIGHT')).toBe(3);
    expect(count('PROCESSING_RESULTS')).toBe(3);
    expect(count('HOLO_TABLE_VIEW')).toBe(1);
    expect(count('INFOGRAPHIC_LAB')).toBe(1);
  });
});

describe('guardas', () => {
  const can = (from: ScreenId, to: ScreenId, payload?: unknown) =>
    canTransition(from, to, store.getState(), payload);

  it('T4 exige a missão na fila e inField = false', () => {
    expect(can('OFFICE', 'PROCESSING_RESULTS', { missionId: 'x', inField: false })).toBe(false);
    const mission = createDebugMission('C00', true);
    store.setState((s) => ({ mission: { ...s.mission, pending: [mission] } }));
    expect(can('OFFICE', 'PROCESSING_RESULTS', { missionId: mission.id, inField: false })).toBe(
      true,
    );
    expect(can('OFFICE', 'PROCESSING_RESULTS', { missionId: mission.id, inField: true })).toBe(
      false,
    );
    expect(can('OFFICE', 'PROCESSING_RESULTS')).toBe(false);
  });

  it('T6 exige contrato AVAILABLE ou COMPLETED e nenhuma missão pendente dele', () => {
    const payload = { contractId: 'C00', rivalAdjustment: 1 };
    // Contrato fora do catálogo/progresso: sem status, a guarda recusa.
    expect(can('WORLD_MAP', 'FIELD_SETUP', { contractId: 'C99', rivalAdjustment: 1 })).toBe(false);
    const set = (status: 'LOCKED' | 'AVAILABLE' | 'STOLEN' | 'COMPLETED') =>
      store.setState({ contracts: { C00: { status, completions: 0, bestScore: 0 } } });
    set('LOCKED');
    expect(can('WORLD_MAP', 'FIELD_SETUP', payload)).toBe(false);
    set('STOLEN');
    expect(can('WORLD_MAP', 'FIELD_SETUP', payload)).toBe(false);
    set('AVAILABLE');
    expect(can('WORLD_MAP', 'FIELD_SETUP', payload)).toBe(true);
    set('COMPLETED');
    expect(can('WORLD_MAP', 'FIELD_SETUP', payload)).toBe(true);
    expect(can('WORLD_MAP', 'FIELD_SETUP', { contractId: 'C00' })).toBe(false);
    store.setState((s) => ({
      mission: { ...s.mission, pending: [createDebugMission('C00', true)] },
    }));
    expect(can('WORLD_MAP', 'FIELD_SETUP', payload)).toBe(false);
  });

  it('T8 e T16 exigem a missão ativa; T16, sem dados; T9, com dados e Van', () => {
    expect(can('FIELD_SETUP', 'SURVEY_FLIGHT', { missionId: 'x' })).toBe(false);
    const empty = createDebugMission('C00', false);
    store.getState().beginMission(empty);
    const p = { missionId: empty.id };
    expect(can('FIELD_SETUP', 'SURVEY_FLIGHT', p)).toBe(true);
    expect(can('FIELD_SETUP', 'SURVEY_FLIGHT', { missionId: 'outra' })).toBe(false);
    expect(can('SURVEY_FLIGHT', 'FIELD_SETUP', p)).toBe(true);
    expect(can('SURVEY_FLIGHT', 'PROCESSING_RESULTS', { ...p, inField: true })).toBe(false);

    const full = createDebugMission('C00', true);
    store.getState().beginMission(full);
    const q = { missionId: full.id, inField: true };
    expect(can('SURVEY_FLIGHT', 'FIELD_SETUP', q)).toBe(false);
    expect(can('SURVEY_FLIGHT', 'PROCESSING_RESULTS', q)).toBe(false);
    store.setState((s) => ({
      inventory: { ...s.inventory, vehicles: [...s.inventory.vehicles, 'LAB_VAN'] },
    }));
    expect(can('SURVEY_FLIGHT', 'PROCESSING_RESULTS', q)).toBe(true);
    expect(can('SURVEY_FLIGHT', 'PROCESSING_RESULTS', { ...q, inField: false })).toBe(false);
  });

  it('T10 exige um desfecho válido', () => {
    expect(can('SURVEY_FLIGHT', 'WORLD_MAP', { outcome: 'QUEUED' })).toBe(true);
    expect(can('SURVEY_FLIGHT', 'WORLD_MAP', { outcome: 'FAILED' })).toBe(true);
    expect(can('SURVEY_FLIGHT', 'WORLD_MAP', { outcome: 'OUTRO' })).toBe(false);
    expect(can('SURVEY_FLIGHT', 'WORLD_MAP')).toBe(false);
  });

  it('T11 exige o setor no museu; T12 e T13 dependem de inField', () => {
    expect(can('PROCESSING_RESULTS', 'HOLO_TABLE_VIEW', { focusSectorId: 'C00' })).toBe(false);
    arrange('T11');
    expect(can('PROCESSING_RESULTS', 'HOLO_TABLE_VIEW', { focusSectorId: 'C00' })).toBe(true);

    const enter = (inField: boolean) =>
      store.setState((s) => ({
        session: {
          ...s.session,
          screen: 'PROCESSING_RESULTS',
          payload: { missionId: 'm', inField },
        },
      }));
    enter(false);
    expect(can('PROCESSING_RESULTS', 'OFFICE')).toBe(true);
    expect(can('PROCESSING_RESULTS', 'WORLD_MAP')).toBe(false);
    enter(true);
    expect(can('PROCESSING_RESULTS', 'OFFICE')).toBe(false);
    expect(can('PROCESSING_RESULTS', 'WORLD_MAP')).toBe(true);
  });
});

describe('goTo', () => {
  it('em DEV, lança InvalidTransitionError e não muda a tela', () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(() => store.getState().goTo('SURVEY_FLIGHT', { missionId: 'x' })).toThrow(
      InvalidTransitionError,
    );
    expect(() => store.getState().goTo('WORLD_MAP')).not.toThrow();
    try {
      store.getState().goTo('SURVEY_FLIGHT', { missionId: 'x' });
    } catch (e) {
      expect(e).toMatchObject({ from: 'WORLD_MAP', to: 'SURVEY_FLIGHT' });
      expect((e as Error).message).toContain('WORLD_MAP → SURVEY_FLIGHT');
    }
    expect(store.getState().session.screen).toBe('WORLD_MAP');
  });

  it('em PROD, registra console.warn e ignora a solicitação', () => {
    vi.stubEnv('DEV', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.getState().goTo('SURVEY_FLIGHT', { missionId: 'x' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('OFFICE → SURVEY_FLIGHT');
    expect(store.getState().session.screen).toBe('OFFICE');
    warn.mockRestore();
  });

  it('executa onExit da origem e onEnter do destino, nessa ordem', () => {
    const calls: string[] = [];
    const offA = registerScreenHooks('OFFICE', { onExit: () => calls.push('exit OFFICE') });
    const offB = registerScreenHooks('HOLO_TABLE_VIEW', {
      onEnter: (p) => calls.push(`enter HOLO ${JSON.stringify(p)}`),
      onExit: () => calls.push('exit HOLO'),
    });
    store.getState().goTo('HOLO_TABLE_VIEW', { focusSectorId: 'C00' });
    expect(calls).toEqual(['exit OFFICE', 'enter HOLO {"focusSectorId":"C00"}']);
    offA();
    offB();
    store.getState().goTo('OFFICE');
    store.getState().goTo('HOLO_TABLE_VIEW');
    expect(calls).toHaveLength(2);
  });
});
