// data-model §8 — SaveGame
import type { AoiPoint, CentsBRL, Dimension } from './basics';
import type {
  AircraftId,
  FieldEquipmentId,
  HardwareId,
  Lens,
  LidarPayload,
  StaffRoleId,
  VehicleId,
} from './catalog';
import type { MissionData } from './mission';
import type { Emblem } from './progression';

export type ContractStatus = 'LOCKED' | 'AVAILABLE' | 'STOLEN' | 'COMPLETED';
export interface ContractProgress {
  status: ContractStatus;
  completions: number;
  bestScore: number;
  bestClass?: string;
  /** Nº total de contratos concluídos no momento do roubo. */
  stolenAtCompletionCount?: number;
  /** Para miniaturas da mesa. */
  bestMissionLines?: Array<{ start: AoiPoint; end: AoiPoint }>;
  bestAircraftId?: AircraftId;
}

export interface MuseumSector {
  contractId: string;
  qualityScore: number;
  mappedAt: number;
  incomePerMinBRL: CentsBRL;
  className: string;
}

/** Persistido separadamente em `scan-city-settings` (architecture §6). */
export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: 'LOW' | 'MEDIUM' | 'HIGH';
  reduceFlashes: boolean;
  showFps: boolean;
  /** Navegação GNSS no mapa-múndi: a seta até a próxima missão (world-map §5.6). */
  gnssNav: boolean;
}

export type Facing = 'N' | 'S' | 'E' | 'W';

export interface SaveGame {
  version: 1;
  createdAt: number;
  updatedAt: number;
  player: {
    name: string;
    money: CentsBRL;
    xp: number;
    level: number;
    skillPoints: number;
    reputation: number;
  };
  skills: string[];
  staff: Record<StaffRoleId, number>;
  inventory: {
    aircraft: AircraftId[];
    sensors: string[];
    lenses: Array<Lens['id']>;
    payloads: Array<LidarPayload['id']>;
    vehicles: VehicleId[];
    fieldEquipment: FieldEquipmentId[];
    hardware: HardwareId;
    cosmetics: string[];
    equipped: { character: string; dronePaint: string; atlasAccessory: string };
    emblem: Emblem;
    corn: { stock: number; crop: number };
    atlasCalibrationFlights: number;
  };
  contracts: Record<string, ContractProgress>;
  museum: {
    sectors: Record<string, MuseumSector>;
    featured: Partial<Record<Dimension, string>>;
    lastIncomeAt: number;
    totalVisitors: number;
  };
  souvenirs: string[];
  pendingMissions: MissionData[];
  world: {
    avatar: { x: number; y: number; facing: Facing };
    vehicleMode: VehicleId;
    dimensionTab: Dimension;
    discoveredRifts: string[];
    lastEventAt: number;
  };
  rival: {
    score: number;
    history: Array<{ at: number; contractId: string; kind: 'COUNTER_OFFER' | 'STEAL' }>;
  };
  stats: {
    contractsCompleted: number;
    photosTaken: number;
    flightTimeS: number;
    crashes: number;
    distanceTiles: number;
  };
  flags: { introSeen: boolean; finaleSeen: boolean; tutorialStep: number };
}
