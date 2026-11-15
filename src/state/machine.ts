import { missionHasData } from '@/domain/sorties';
import type { ScreenId } from '@/types';
import type { GameData, ScreenPayload } from './types';

/** Máquina de estados de telas (architecture §2). Uma transição fora desta tabela é um bug. */
export interface TransitionDef {
  id: string;
  from: ScreenId;
  to: ScreenId;
  /** Gatilho de jogo, para depuração. */
  trigger: string;
  guard?: (state: GameData, payload: unknown) => boolean;
}

export const SCREEN_IDS: readonly ScreenId[] = [
  'OFFICE',
  'WORLD_MAP',
  'FIELD_SETUP',
  'SURVEY_FLIGHT',
  'PROCESSING_RESULTS',
  'HOLO_TABLE_VIEW',
  'INFOGRAPHIC_LAB',
];

function field(payload: unknown, key: string): unknown {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)[key]
    : undefined;
}

function hasData(mission: GameData['mission']['active']): boolean {
  return mission !== null && missionHasData(mission);
}

function isActiveMission(state: GameData, payload: unknown): boolean {
  const id = field(payload, 'missionId');
  return typeof id === 'string' && state.mission.active?.id === id;
}

const OUTCOMES: readonly unknown[] = ['QUEUED', 'FAILED', 'ABORTED'];

export const SCREEN_TRANSITIONS: readonly TransitionDef[] = [
  { id: 'T1', from: 'OFFICE', to: 'WORLD_MAP', trigger: 'Hotspot Porta' },
  { id: 'T2', from: 'OFFICE', to: 'HOLO_TABLE_VIEW', trigger: 'Hotspot Mesa Holográfica' },
  { id: 'T3', from: 'OFFICE', to: 'INFOGRAPHIC_LAB', trigger: 'Hotspot Laboratório' },
  {
    id: 'T4',
    from: 'OFFICE',
    to: 'PROCESSING_RESULTS',
    trigger: 'Workstation → Processar',
    guard: (state, payload) =>
      field(payload, 'inField') === false &&
      state.mission.pending.some((m) => m.id === field(payload, 'missionId')),
  },
  { id: 'T5', from: 'WORLD_MAP', to: 'OFFICE', trigger: 'INTERACT na porta da sede' },
  {
    id: 'T6',
    from: 'WORLD_MAP',
    to: 'FIELD_SETUP',
    trigger: 'Briefing → Aceitar',
    guard: (state, payload) => {
      const contractId = field(payload, 'contractId');
      if (typeof contractId !== 'string' || typeof field(payload, 'rivalAdjustment') !== 'number') {
        return false;
      }
      const status = state.contracts[contractId]?.status;
      return (
        (status === 'AVAILABLE' || status === 'COMPLETED') &&
        !state.mission.pending.some((m) => m.contractId === contractId)
      );
    },
  },
  { id: 'T7', from: 'FIELD_SETUP', to: 'WORLD_MAP', trigger: 'Cancelar / Abandonar' },
  {
    id: 'T8',
    from: 'FIELD_SETUP',
    to: 'SURVEY_FLIGHT',
    trigger: 'Decolar',
    guard: isActiveMission,
  },
  {
    id: 'T9',
    from: 'SURVEY_FLIGHT',
    to: 'PROCESSING_RESULTS',
    trigger: 'Pós-voo → Processar agora',
    guard: (state, payload) =>
      field(payload, 'inField') === true &&
      isActiveMission(state, payload) &&
      hasData(state.mission.active) &&
      state.inventory.vehicles.includes('LAB_VAN'),
  },
  {
    id: 'T10',
    from: 'SURVEY_FLIGHT',
    to: 'WORLD_MAP',
    trigger: 'Pós-voo → Levar dados, falha ou abandono',
    guard: (_state, payload) => OUTCOMES.includes(field(payload, 'outcome')),
  },
  {
    id: 'T11',
    from: 'PROCESSING_RESULTS',
    to: 'HOLO_TABLE_VIEW',
    trigger: 'Enviar à Mesa do Museu',
    // Um relatório aprovado sempre esculpe o setor do contrato no museu.
    guard: (state, payload) => {
      const sectorId = field(payload, 'focusSectorId');
      return typeof sectorId === 'string' && Object.hasOwn(state.museum.sectors, sectorId);
    },
  },
  {
    id: 'T12',
    from: 'PROCESSING_RESULTS',
    to: 'OFFICE',
    trigger: 'Concluir',
    guard: (state) => field(state.session.payload, 'inField') === false,
  },
  {
    id: 'T13',
    from: 'PROCESSING_RESULTS',
    to: 'WORLD_MAP',
    trigger: 'Voltar ao mapa',
    guard: (state) => field(state.session.payload, 'inField') === true,
  },
  { id: 'T14', from: 'HOLO_TABLE_VIEW', to: 'OFFICE', trigger: 'Voltar / UI_BACK' },
  { id: 'T15', from: 'INFOGRAPHIC_LAB', to: 'OFFICE', trigger: 'Voltar / UI_BACK' },
  {
    id: 'T16',
    from: 'SURVEY_FLIGHT',
    to: 'FIELD_SETUP',
    trigger: 'Pós-voo sem dados → Tentar de novo',
    guard: (state, payload) => isActiveMission(state, payload) && !hasData(state.mission.active),
  },
];

export function findTransition(from: ScreenId, to: ScreenId): TransitionDef | undefined {
  return SCREEN_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function transitionsFrom(from: ScreenId): TransitionDef[] {
  return SCREEN_TRANSITIONS.filter((t) => t.from === from);
}

export function canTransition(
  from: ScreenId,
  to: ScreenId,
  state: GameData,
  payload?: unknown,
): boolean {
  const def = findTransition(from, to);
  if (!def) return false;
  return def.guard ? def.guard(state, payload) : true;
}

export class InvalidTransitionError extends Error {
  readonly from: ScreenId;
  readonly to: ScreenId;

  constructor(from: ScreenId, to: ScreenId) {
    super(`Transição de tela inválida: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

export interface ScreenHooks {
  onEnter?: (payload: ScreenPayload) => void;
  onExit?: () => void;
}

const hooks = new Map<ScreenId, Set<ScreenHooks>>();

/** Registra hooks de entrada/saída de uma tela (ex.: limpar a missão). Retorna o cancelamento. */
export function registerScreenHooks(screen: ScreenId, h: ScreenHooks): () => void {
  let set = hooks.get(screen);
  if (!set) {
    set = new Set();
    hooks.set(screen, set);
  }
  set.add(h);
  return () => {
    hooks.get(screen)?.delete(h);
  };
}

export function runExitHooks(screen: ScreenId): void {
  hooks.get(screen)?.forEach((h) => h.onExit?.());
}

export function runEnterHooks(screen: ScreenId, payload: ScreenPayload): void {
  hooks.get(screen)?.forEach((h) => h.onEnter?.(payload));
}
