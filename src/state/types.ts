import type {
  CentsBRL,
  ContractProgress,
  Dimension,
  Emblem,
  MissionData,
  SaveGame,
  ScreenId,
  Settings,
  VehicleId,
} from '@/types';
import type { ToastData } from '@/ui/Toast';

/** Payload de entrada de cada tela (architecture §2.1). */
export interface ScreenPayloads {
  OFFICE: undefined;
  WORLD_MAP: { outcome: 'QUEUED' | 'FAILED' | 'ABORTED' } | undefined;
  FIELD_SETUP: { contractId: string; rivalAdjustment: number } | { missionId: string };
  SURVEY_FLIGHT: { missionId: string };
  PROCESSING_RESULTS: { missionId: string; inField: boolean };
  HOLO_TABLE_VIEW: { focusSectorId?: string } | undefined;
  INFOGRAPHIC_LAB: { panel?: string } | undefined;
}
export type ScreenPayload = ScreenPayloads[ScreenId];

export interface Transaction {
  at: number;
  amount: CentsBRL;
  reason: string;
}

/** Estado efêmero: nunca vai para o save. */
export interface SessionState {
  screen: ScreenId;
  payload: ScreenPayload;
  paused: boolean;
  toasts: ToastData[];
  activeModal: string | null;
  /** Últimas 50 transações, só em memória (progression §4). */
  transactions: Transaction[];
}

export interface MissionState {
  active: MissionData | null;
  pending: MissionData[];
}

/** Dados da store. Tudo menos `session`, `mission.active` e `settings` compõe o `SaveGame`. */
export interface GameData {
  session: SessionState;
  createdAt: number;
  player: SaveGame['player'];
  skills: string[];
  staff: SaveGame['staff'];
  inventory: SaveGame['inventory'];
  contracts: Record<string, ContractProgress>;
  mission: MissionState;
  museum: SaveGame['museum'];
  souvenirs: string[];
  world: SaveGame['world'];
  rival: SaveGame['rival'];
  stats: SaveGame['stats'];
  flags: SaveGame['flags'];
  settings: Settings;
}

export type EquipSlot = keyof SaveGame['inventory']['equipped'];

export interface SessionActions {
  /** Troca de tela validada pela máquina de estados (architecture §2.2). */
  goTo: <S extends ScreenId>(to: S, payload?: ScreenPayloads[S]) => void;
  setPaused: (paused: boolean) => void;
  pushToast: (toast: Omit<ToastData, 'id'>) => string;
  dismissToast: (id: string) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export interface PlayerActions {
  setFlags: (flags: Partial<SaveGame['flags']>) => void;
  earn: (amount: CentsBRL, reason: string) => void;
  /** Debita se houver saldo; senão, não altera nada, avisa e retorna `false`. */
  spend: (amount: CentsBRL, reason: string) => boolean;
  changeReputation: (delta: number) => void;
  /** Soma os deltas às estatísticas da carreira. */
  addStats: (delta: Partial<SaveGame['stats']>) => void;
}

export interface InventoryActions {
  equip: (slot: EquipSlot, cosmeticId: string) => void;
  setEmblem: (emblem: Emblem) => void;
}

export interface ContractsActions {
  /**
   * Libera os contratos `LOCKED` cuja condição foi satisfeita (progression §12), com toast
   * (e `RIFT_OPEN` nas fendas), salvo com `silent`. Devolve os ids liberados.
   */
  refreshUnlocks: (options?: { silent?: boolean }) => string[];
  markStolen: (contractId: string) => void;
}

export interface MissionActions {
  /**
   * Cria a missão ativa do contrato em planejamento, com os padrões do plano
   * (field-setup §5.3). `COMPLETED` vira replay (progression §12).
   */
  startMission: (contractId: string, rivalAdjustment: number) => MissionData;
  /** Torna `mission` a missão ativa (em planejamento ou em voo). */
  beginMission: (mission: MissionData) => void;
  /** Move a missão ativa para a fila de processamento. */
  queueActive: () => void;
  discardActive: () => void;
  /** Remove e devolve uma missão da fila. */
  consumePending: (missionId: string) => MissionData | null;
}

export interface MuseumActions {
  setFeatured: (wing: Dimension, contractId: string | null) => void;
}

export interface WorldActions {
  setAvatar: (avatar: Partial<SaveGame['world']['avatar']>) => void;
  /** Passa ao próximo veículo possuído e devolve o novo modo. */
  cycleVehicle: () => VehicleId;
  setDimensionTab: (tab: Dimension) => void;
  discoverRift: (contractId: string) => void;
}

export interface RivalActions {
  /** A MegaMap toma o contrato (progression §8). */
  steal: (contractId: string) => void;
}

export interface SettingsActions {
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export type GameActions = SessionActions &
  PlayerActions &
  InventoryActions &
  ContractsActions &
  MissionActions &
  MuseumActions &
  WorldActions &
  RivalActions &
  SettingsActions;

export type GameStore = GameData & GameActions;
