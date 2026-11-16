import type { MissionData, SaveGame, Settings } from '@/types';
import { migrateSave, SAVE_VERSION } from './migrations';
import { defaultSettings } from './slices/settingsSlice';

export const SAVE_KEY = 'scan-city-save';
export const SAVE_BACKUP_KEY = 'scan-city-save-backup';
export const SETTINGS_KEY = 'scan-city-settings';

/** Limite de amostras LiDAR por missão no save (em memória, 50.000). */
export const MAX_SAVED_LIDAR_SAMPLES = 8000;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const nums = (o: Obj, keys: readonly string[]) => keys.every((k) => isNum(o[k]));
const oneOf = (v: unknown, options: readonly string[]) => isStr(v) && options.includes(v);

function validPlayer(v: unknown): boolean {
  return (
    isObj(v) && isStr(v.name) && nums(v, ['money', 'xp', 'level', 'skillPoints', 'reputation'])
  );
}

function validInventory(v: unknown): boolean {
  if (!isObj(v)) return false;
  const { equipped, emblem, corn } = v;
  return (
    isStrArray(v.aircraft) &&
    isStrArray(v.sensors) &&
    isStrArray(v.lenses) &&
    isStrArray(v.payloads) &&
    isStrArray(v.vehicles) &&
    isStrArray(v.fieldEquipment) &&
    isStr(v.hardware) &&
    isStrArray(v.cosmetics) &&
    isObj(equipped) &&
    isStr(equipped.character) &&
    isStr(equipped.dronePaint) &&
    isStr(equipped.atlasAccessory) &&
    isObj(emblem) &&
    isStr(emblem.shape) &&
    isStr(emblem.icon) &&
    isStr(emblem.primary) &&
    isStr(emblem.secondary) &&
    isStr(emblem.initials) &&
    isObj(corn) &&
    nums(corn, ['stock', 'crop']) &&
    isNum(v.atlasCalibrationFlights)
  );
}

const CONTRACT_STATUS = ['LOCKED', 'AVAILABLE', 'STOLEN', 'COMPLETED'] as const;

function validContracts(v: unknown): boolean {
  return (
    isObj(v) &&
    Object.values(v).every(
      (p) => isObj(p) && oneOf(p.status, CONTRACT_STATUS) && nums(p, ['completions', 'bestScore']),
    )
  );
}

function validMuseum(v: unknown): boolean {
  return (
    isObj(v) &&
    isObj(v.sectors) &&
    Object.values(v.sectors).every(
      (s) =>
        isObj(s) &&
        isStr(s.contractId) &&
        isStr(s.className) &&
        nums(s, ['qualityScore', 'mappedAt', 'incomePerMinBRL']),
    ) &&
    isObj(v.featured) &&
    nums(v, ['lastIncomeAt', 'totalVisitors'])
  );
}

function validMission(v: unknown): boolean {
  if (!isObj(v)) return false;
  const { plan, events } = v;
  return (
    isStr(v.id) &&
    isStr(v.contractId) &&
    nums(v, ['createdAt', 'rivalAdjustment']) &&
    isBool(v.isReplay) &&
    isObj(plan) &&
    isObj(plan.params) &&
    Array.isArray(plan.lines) &&
    isObj(plan.stats) &&
    Array.isArray(v.groundPoints) &&
    isStr(v.fieldEquipmentId) &&
    isObj(v.minigames) &&
    isBool(v.atlasCalibrated) &&
    Array.isArray(v.sorties) &&
    Array.isArray(v.completedLines) &&
    Array.isArray(v.shots) &&
    isObj(events) &&
    isStr(v.status)
  );
}

function validWorld(v: unknown): boolean {
  if (!isObj(v)) return false;
  const { avatar } = v;
  return (
    isObj(avatar) &&
    nums(avatar, ['x', 'y']) &&
    oneOf(avatar.facing, ['N', 'S', 'E', 'W']) &&
    isStr(v.vehicleMode) &&
    oneOf(v.dimensionTab, ['REAL', 'RIFT']) &&
    isStrArray(v.discoveredRifts) &&
    isNum(v.lastEventAt)
  );
}

function validRival(v: unknown): boolean {
  return (
    isObj(v) &&
    isNum(v.score) &&
    Array.isArray(v.history) &&
    v.history.every(
      (h) =>
        isObj(h) && isNum(h.at) && isStr(h.contractId) && oneOf(h.kind, ['COUNTER_OFFER', 'STEAL']),
    )
  );
}

/** Validador manual do `SaveGame`: campos obrigatórios e tipos (architecture §6). */
export function validateSave(obj: unknown): obj is SaveGame {
  if (!isObj(obj)) return false;
  const { staff, stats, flags } = obj;
  return (
    obj.version === SAVE_VERSION &&
    nums(obj, ['createdAt', 'updatedAt']) &&
    validPlayer(obj.player) &&
    isStrArray(obj.skills) &&
    isObj(staff) &&
    nums(staff, ['INTERN', 'JUNIOR_ENG']) &&
    validInventory(obj.inventory) &&
    validContracts(obj.contracts) &&
    validMuseum(obj.museum) &&
    isStrArray(obj.souvenirs) &&
    Array.isArray(obj.pendingMissions) &&
    obj.pendingMissions.every(validMission) &&
    validWorld(obj.world) &&
    validRival(obj.rival) &&
    isObj(stats) &&
    nums(stats, ['contractsCompleted', 'photosTaken', 'flightTimeS', 'crashes', 'distanceTiles']) &&
    isObj(flags) &&
    isBool(flags.introSeen) &&
    isBool(flags.finaleSeen) &&
    isNum(flags.tutorialStep)
  );
}

/** Reduz as amostras LiDAR da missão ao limite do save, por amostragem uniforme. */
export function compactMission(mission: MissionData): MissionData {
  const samples = mission.lidar?.samples;
  if (!mission.lidar || !samples || samples.length <= MAX_SAVED_LIDAR_SAMPLES) return mission;
  const step = samples.length / MAX_SAVED_LIDAR_SAMPLES;
  const kept = Array.from(
    { length: MAX_SAVED_LIDAR_SAMPLES },
    (_, i) => samples[Math.floor(i * step)] as (typeof samples)[number],
  );
  return { ...mission, lidar: { ...mission.lidar, samples: kept } };
}

export function serializeSave(save: SaveGame): string {
  return JSON.stringify({ ...save, pendingMissions: save.pendingMissions.map(compactMission) });
}

export type LoadResult =
  | { status: 'EMPTY' }
  | { status: 'OK'; save: SaveGame; migratedFrom: number | null }
  | { status: 'INVALID'; reason: string };

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Sem armazenamento: não lê nada e recusa toda gravação (quem grava já trata a recusa). */
const NO_STORAGE: KeyValueStorage = {
  getItem: () => null,
  setItem: () => {
    throw new Error('armazenamento do navegador indisponível');
  },
  removeItem: () => undefined,
};

/**
 * O `localStorage` do navegador, protegido. Só *acessar* `localStorage` já lança (`SecurityError`)
 * com os cookies bloqueados ou num iframe sem `allow-same-origin`, e `getItem` e `removeItem`
 * lançam por erro do navegador. Nesses casos o jogo abre vazio e segue sem salvar; o primeiro
 * autosave recusado avisa o jogador (REQ-CORE-004). A gravação continua lançando para quem grava
 * (`writeSave`, `writeSettings`, `backupSave`) tratar a recusa.
 */
export function browserStorage(): KeyValueStorage {
  let storage: Storage;
  try {
    storage = localStorage;
  } catch {
    return NO_STORAGE;
  }
  return {
    getItem: (key) => {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => {
      try {
        storage.removeItem(key);
      } catch {
        // sem armazenamento, não há o que apagar
      }
    },
  };
}

/** Apaga o save (o `removeItem` do `persist`). */
export function removeSave(storage: KeyValueStorage = browserStorage()): void {
  storage.removeItem(SAVE_KEY);
}

/**
 * Lê e valida o save. Um save inválido (JSON quebrado, schema inválido ou versão futura)
 * é movido para `scan-city-save-backup` e o resultado é `INVALID` (REQ-CORE-005).
 */
export function loadSave(storage: KeyValueStorage = browserStorage()): LoadResult {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return { status: 'EMPTY' };

  const invalid = (reason: string): LoadResult => {
    try {
      storage.setItem(SAVE_BACKUP_KEY, raw);
      storage.removeItem(SAVE_KEY);
    } catch {
      // Sem espaço para o backup: o save inválido fica onde está (nada é apagado sem cópia).
    }
    return { status: 'INVALID', reason };
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid('JSON inválido');
  }
  if (!isObj(parsed)) return invalid('o save não é um objeto');

  const migrated = migrateSave(parsed);
  if (!migrated.ok) return invalid(migrated.reason);
  if (!validateSave(migrated.save))
    return invalid('campos obrigatórios ausentes ou com tipo errado');

  return {
    status: 'OK',
    save: migrated.save,
    migratedFrom: migrated.from < SAVE_VERSION ? migrated.from : null,
  };
}

/** Grava o save; devolve `false` se o armazenamento recusar (cota, modo privado). */
export function writeSave(save: SaveGame, storage: KeyValueStorage = browserStorage()): boolean {
  try {
    storage.setItem(SAVE_KEY, serializeSave(save));
    return true;
  } catch {
    return false;
  }
}

/** Copia o save atual para a chave de backup (antes de um "Novo jogo"). */
export function backupSave(storage: KeyValueStorage = browserStorage()): boolean {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return false;
  try {
    storage.setItem(SAVE_BACKUP_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

function clamp01(v: unknown, fallback: number): number {
  return isNum(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/** Configurações salvas, completadas com os padrões (chave própria: sobrevivem ao "Novo jogo"). */
export function loadSettings(storage: KeyValueStorage = browserStorage()): Settings {
  const defaults = defaultSettings();
  const raw = storage.getItem(SETTINGS_KEY);
  if (raw === null) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!isObj(parsed)) return defaults;
  return {
    masterVolume: clamp01(parsed.masterVolume, defaults.masterVolume),
    sfxVolume: clamp01(parsed.sfxVolume, defaults.sfxVolume),
    muted: isBool(parsed.muted) ? parsed.muted : defaults.muted,
    quality: oneOf(parsed.quality, ['LOW', 'MEDIUM', 'HIGH'])
      ? (parsed.quality as Settings['quality'])
      : defaults.quality,
    reduceFlashes: isBool(parsed.reduceFlashes) ? parsed.reduceFlashes : defaults.reduceFlashes,
    showFps: isBool(parsed.showFps) ? parsed.showFps : defaults.showFps,
  };
}

export function writeSettings(
  settings: Settings,
  storage: KeyValueStorage = browserStorage(),
): boolean {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
