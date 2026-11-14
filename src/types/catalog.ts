// data-model §2 — Catálogo de equipamentos
import type { CentsBRL } from './basics';

export type ShutterType = 'GLOBAL' | 'ROLLING' | 'MECHANICAL';
export type SensorKind = 'RGB' | 'MULTISPECTRAL' | 'THERMAL' | 'LIDAR';
export type AircraftKind = 'BIRD' | 'MULTIROTOR' | 'FIXED_WING_VTOL';
export type AircraftId = 'ATLAS' | 'DRONE_T1' | 'DRONE_T2' | 'VTOL_T3';
export type VehicleId = 'FOOT_BIKE' | 'COMPACT_CAR' | 'PICKUP_4X4' | 'LAB_VAN';
export type HardwareId = 'OLD_LAPTOP' | 'GAMER_PC' | 'MULTI_GPU_WS' | 'CLOUD';
export type FieldEquipmentId = 'TOTAL_STATION' | 'GNSS_RTK_KIT';
export type StaffRoleId = 'INTERN' | 'JUNIOR_ENG';

export interface CameraSensor {
  /** 'CAM_PIGEON' | 'CAM_20MP_RS' | 'CAM_45MP_FF' | 'CAM_MS5' | 'CAM_THERMAL' … */
  id: string;
  name: string;
  kind: Exclude<SensorKind, 'LIDAR'>;
  /** Lado transversal ao voo. */
  sensorWidthMm: number;
  /** Lado ao longo do voo. */
  sensorHeightMm: number;
  imageWidthPx: number;
  imageHeightPx: number;
  shutter: ShutterType;
  /** Só ROLLING. */
  readoutS?: number;
  /** 43,27 mm / diagonal do sensor. */
  cropFactor: number;
  lensMount: 'FIXED' | 'INTERCHANGEABLE';
  /** Só FIXED (focal real). */
  fixedFocalMm?: number;
  /** Multiplicador de RMSE (1 = neutro; analógica 1,3). */
  qualityPenalty: number;
  /** Multiespectral: ['B','G','R','RE','NIR']. */
  bands?: readonly string[];
  priceBRL: CentsBRL;
  compatibleAircraft: readonly AircraftId[];
  description: string;
}

export interface Lens {
  id: 'LENS_24' | 'LENS_35';
  name: string;
  /** Focal real = equivFocalMm / cropFactor (domain-math §2.4). */
  equivFocalMm: 24 | 35;
  priceBRL: CentsBRL;
}

export interface LidarPayload {
  id: 'POD_LIDAR';
  name: string;
  /** Pulsos/s. */
  prrHz: number;
  /** Abertura transversal total. */
  fovDeg: number;
  maxReturns: number;
  /** σ vertical base. */
  rangeAccuracyM: number;
  /** Oscilação visual do leque. */
  scanFrequencyHz: number;
  /** Câmera RGB integrada ao pod. */
  rgbSensorId: string;
  priceBRL: CentsBRL;
  compatibleAircraft: readonly AircraftId[];
  tier: 4;
}

export interface Aircraft {
  id: AircraftId;
  name: string;
  tier: 0 | 1 | 2 | 3;
  kind: AircraftKind;
  vMinMs: number;
  vCruiseMs: number;
  vMaxMs: number;
  /** Aceleração longitudinal. */
  accelMs2: number;
  /** Multirrotor/ave; asa fixa limitada por v²/R. */
  lateralSpeedMaxMs: number;
  climbRateMs: number;
  /** AGL. */
  hMinM: number;
  hMaxM: number;
  /** Por bateria (ou 10 unidades de milho para Atlas). */
  enduranceS: number;
  energyUnit: 'BATTERY' | 'CORN';
  /** Surtidas extras por missão (Atlas: limitado ao estoque de milho). */
  spareBatteries: number;
  rtk: boolean;
  /** Acima disso: deriva ×2 e alerta. */
  windToleranceMs: number;
  /** Fração do vento cruzado convertida em deriva (0..1). */
  driftFactor: number;
  /** 0 = pivota no lugar. */
  turnRadiusM: number;
  /** Pontos de casco. */
  hull: number;
  collisionRadiusM: number;
  /** Permite oblíqua. */
  gimbalTilt: boolean;
  terrainFollowing: boolean;
  emImmune: boolean;
  /** Ids de CameraSensor e/ou 'POD_LIDAR'. */
  compatibleSensors: readonly string[];
  priceBRL: CentsBRL;
  /** % do preço cobrado após queda. */
  repairCostPct: number;
  /** Para compra. */
  requiresTier?: number;
  description: string;
}

export type TileType =
  | 'ROAD_PAVED'
  | 'ROAD_DIRT'
  | 'TRAIL'
  | 'GRASS'
  | 'FOREST'
  | 'WATER'
  | 'SWAMP'
  | 'SAND'
  | 'HILL'
  | 'HILL_STEEP'
  | 'MOUNTAIN'
  | 'URBAN'
  | 'BUILDING'
  | 'BRIDGE'
  | 'SNOW';

export interface Vehicle {
  id: VehicleId;
  name: string;
  priceBRL: CentsBRL;
  /** Tile ausente = intransponível. */
  speedTilesS: Partial<Record<TileType, number>>;
  /** Distância máxima da rede acessível até o GCP. */
  gcpReachM: number;
  /** Rede a partir da qual o alcance é medido. */
  gcpNetwork: 'ROADS_TRAILS' | 'ROADS' | 'OFFROAD';
  maxSlopePct: number;
  allowSwamp: boolean;
  /** Van Lab. */
  processesInField: boolean;
  /** Fator de processamento em campo. */
  fieldSpeedFactor?: number;
}

export interface FieldEquipment {
  id: FieldEquipmentId;
  name: string;
  /** σ de medição do GCP com nivelamento perfeito. */
  sigmaBaseM: number;
  /** GCP + CP. */
  maxPoints: number;
  providesRtkCorrections: boolean;
  priceBRL: CentsBRL;
}

export interface Hardware {
  id: HardwareId;
  name: string;
  speedFactor: number;
  priceBRL: CentsBRL;
  description: string;
}

export interface StaffRole {
  id: StaffRoleId;
  name: string;
  hireCostBRL: CentsBRL;
  costPerContractBRL: CentsBRL;
  /** Fração somada por pessoa (0,08 = +8 %). */
  paymentBonus: number;
  /** Fração por pessoa. */
  processingSpeedBonus: number;
  maxCount: number;
}
