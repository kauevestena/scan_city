import type {
  FieldEquipmentId,
  CentsBRL,
  ContractProgress,
  Dimension,
  Emblem,
  GroundPoint,
  LidarBatch,
  MissionData,
  PlanParams,
  QualityReport,
  Shot,
  SortieOutcome,
  SaveGame,
  ScreenId,
  Settings,
  VehicleId,
} from '@/types';
import type { PlanOptions } from '@/domain/flightPlanner';
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
  /** Soma XP, com um toast e o som `LEVEL_UP` por nível subido. */
  grantXp: (amount: number) => void;
  /** Soma os deltas às estatísticas da carreira. */
  addStats: (delta: Partial<SaveGame['stats']>) => void;
}

export interface InventoryActions {
  equip: (slot: EquipSlot, cosmeticId: string) => void;
  /**
   * Compra um item da loja (office §5, progression §5): confere `canBuy` com o desconto, debita,
   * entrega os itens (o combo T2, só os que faltam) e toca `CASH_REGISTER`. Sem condição, toca
   * `DENIED` e avisa o motivo. Devolve se a compra aconteceu.
   */
  buyItem: (id: string) => boolean;
  setEmblem: (emblem: Emblem) => void;
  /** Soma milho ao estoque (Atlas). */
  addCorn: (amount: number) => void;
}

export interface ContractsActions {
  /**
   * Libera os contratos `LOCKED` cuja condição foi satisfeita (progression §12), com toast
   * (e `RIFT_OPEN` nas fendas), salvo com `silent`. Devolve os ids liberados.
   */
  refreshUnlocks: (options?: { silent?: boolean }) => string[];
  markStolen: (contractId: string) => void;
}

export interface SortieReport {
  outcome: SortieOutcome;
  durationS: number;
  completedLines: number[];
  /** Colisões da surtida (somam em `events.collisions`, mesmo com os dados descartados). */
  collisions?: number;
  /** Milho consumido do papo (Atlas). */
  cornUsed?: number;
  /** Detectado por um holofote (vale mesmo com os dados descartados). */
  detected?: boolean;
  /** Anéis coletados e alvos capturados: só contam se a surtida não foi perdida. */
  rings?: number;
  featuresCaptured?: string[];
  /** Dados LiDAR da surtida; entram na missão só se a surtida não foi perdida. */
  lidar?: LidarBatch | null;
}

export interface MissionActions {
  /**
   * Cria a missão ativa do contrato em planejamento, com os padrões do plano
   * (field-setup §5.3). `COMPLETED` vira replay (progression §12).
   */
  startMission: (contractId: string, rivalAdjustment: number) => MissionData;
  /** Troca os parâmetros do plano da missão ativa e recalcula o plano. */
  updatePlan: (params: PlanParams, options?: PlanOptions) => void;
  setGroundPoints: (points: GroundPoint[]) => void;
  /** Resultado de um mini-game de campo; vale a melhor pontuação da missão (field-setup §5.4). */
  /** Troca o instrumento de medição dos GCPs (só entre os possuídos). */
  setFieldEquipment: (id: FieldEquipmentId) => void;
  recordMinigame: (kind: 'level' | 'imu', score: number) => void;
  /**
   * Decolagem (field-setup §5.5): σ dos pontos, `IN_FLIGHT` e, com Atlas, um voo da
   * calibração da câmera. Devolve a missão, ou `null` sem missão ativa.
   */
  launchMission: () => MissionData | null;
  /** Disparos da surtida em andamento (em lotes, survey-flight §6). */
  appendShots: (shots: Shot[]) => void;
  /** Soma um lote de pulsos e amostras LiDAR à missão ativa (até 50.000 amostras). */
  mergeLidar: (batch: LidarBatch) => void;
  /**
   * Fim de surtida: registra o resultado e as linhas completas. Em queda ou energia
   * esgotada, descarta os disparos desta surtida. Atualiza as estatísticas.
   */
  endSortie: (result: SortieReport) => void;
  /**
   * "Nova surtida" (survey-flight §5.12): com o Atlas, o papo enche com o estoque; a troca de
   * bateria é só contar a surtida. Devolve `false` se não houver energia reserva.
   */
  startNewSortie: () => boolean;
  /** "Tentar de novo": a missão sem dados volta ao planejamento. */
  resumePlanning: () => void;
  /**
   * Aplica o relatório (processing-results §3): dinheiro, XP, reputação, souvenir, contrato,
   * museu, roubo e desbloqueios. Idempotente: a missão sai da fila na primeira chamada, e as
   * seguintes devolvem `false` sem mudar nada.
   */
  applyMissionResult: (report: QualityReport) => boolean;
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
  /** Marca o instante (s) do último evento de campo, para o intervalo mínimo. */
  markFieldEvent: (nowS: number) => void;
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
