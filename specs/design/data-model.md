# Design — Modelo de Dados

> Interfaces TypeScript canônicas. O código deve implementá-las **com estes nomes e campos** em `src/types/` (um arquivo por seção) e reexportá-las em `src/types/index.ts`. Campos opcionais estão marcados com `?`. Unidades SI no sufixo do nome.
>
> **Requisitos cobertos:** REQ-CORE-004, REQ-CORE-005, REQ-CNT-001, REQ-CNT-002, REQ-CNT-004.

---

## 1. Básicos

```ts
export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
export type AoiPoint = { u: number; v: number };        // m, frame da AOI (architecture §5)
export type CentsBRL = number;                           // inteiro
export type Rgb = readonly [number, number, number];     // 0..255

export type ScreenId =
  | 'OFFICE' | 'WORLD_MAP' | 'FIELD_SETUP' | 'SURVEY_FLIGHT'
  | 'PROCESSING_RESULTS' | 'HOLO_TABLE_VIEW' | 'INFOGRAPHIC_LAB';
export type Dimension = 'REAL' | 'RIFT';
```

---

## 2. Catálogo de equipamentos

```ts
export type ShutterType = 'GLOBAL' | 'ROLLING' | 'MECHANICAL';
export type SensorKind = 'RGB' | 'MULTISPECTRAL' | 'THERMAL' | 'LIDAR';
export type AircraftKind = 'BIRD' | 'MULTIROTOR' | 'FIXED_WING_VTOL';
export type AircraftId = 'ATLAS' | 'DRONE_T1' | 'DRONE_T2' | 'VTOL_T3';
export type VehicleId = 'FOOT_BIKE' | 'COMPACT_CAR' | 'PICKUP_4X4' | 'LAB_VAN';
export type HardwareId = 'OLD_LAPTOP' | 'GAMER_PC' | 'MULTI_GPU_WS' | 'CLOUD';
export type FieldEquipmentId = 'TOTAL_STATION' | 'GNSS_RTK_KIT';
export type StaffRoleId = 'INTERN' | 'JUNIOR_ENG';

export interface CameraSensor {
  id: string;                     // 'CAM_PIGEON' | 'CAM_20MP_RS' | 'CAM_45MP_FF' | 'CAM_MS5' | 'CAM_THERMAL'
  name: string;
  kind: Exclude<SensorKind, 'LIDAR'>;
  sensorWidthMm: number;          // lado transversal ao voo
  sensorHeightMm: number;         // lado ao longo do voo
  imageWidthPx: number;
  imageHeightPx: number;
  shutter: ShutterType;
  readoutS?: number;              // só ROLLING
  cropFactor: number;             // 43,27 mm / diagonal do sensor
  lensMount: 'FIXED' | 'INTERCHANGEABLE';
  fixedFocalMm?: number;          // só FIXED (focal real)
  qualityPenalty: number;         // multiplicador de RMSE (1 = neutro; analógica 1,3)
  bands?: readonly string[];      // multiespectral: ['B','G','R','RE','NIR']
  priceBRL: CentsBRL;
  compatibleAircraft: readonly AircraftId[];
  description: string;
}

export interface Lens {
  id: 'LENS_24' | 'LENS_35';
  name: string;
  equivFocalMm: 24 | 35;          // focal real = equivFocalMm / cropFactor (domain-math §2.4)
  priceBRL: CentsBRL;
}

export interface LidarPayload {
  id: 'POD_LIDAR';
  name: string;
  prrHz: number;                  // pulsos/s
  fovDeg: number;                 // abertura transversal total
  maxReturns: number;
  rangeAccuracyM: number;         // σ vertical base
  scanFrequencyHz: number;        // oscilação visual do leque
  rgbSensorId: string;            // câmera RGB integrada ao pod
  priceBRL: CentsBRL;
  compatibleAircraft: readonly AircraftId[];
  tier: 4;
}

export interface Aircraft {
  id: AircraftId;
  name: string;
  tier: 0 | 1 | 2 | 3;
  kind: AircraftKind;
  vMinMs: number; vCruiseMs: number; vMaxMs: number;
  accelMs2: number;               // aceleração longitudinal
  lateralSpeedMaxMs: number;      // multirrotor/ave; asa fixa limitada por v²/R
  climbRateMs: number;
  hMinM: number; hMaxM: number;   // AGL
  enduranceS: number;             // por bateria (ou 10 unidades de milho para Atlas)
  energyUnit: 'BATTERY' | 'CORN';
  spareBatteries: number;         // surtidas extras por missão (Atlas: limitado ao estoque de milho)
  rtk: boolean;
  windToleranceMs: number;        // acima disso: deriva ×2 e alerta
  driftFactor: number;            // fração do vento cruzado convertida em deriva (0..1)
  turnRadiusM: number;            // 0 = pivota no lugar
  hull: number;                   // pontos de casco
  collisionRadiusM: number;
  gimbalTilt: boolean;            // permite oblíqua
  terrainFollowing: boolean;
  emImmune: boolean;
  compatibleSensors: readonly string[];   // ids de CameraSensor e/ou 'POD_LIDAR'
  priceBRL: CentsBRL;
  repairCostPct: number;          // % do preço cobrado após queda
  requiresTier?: number;          // para compra
  description: string;
}

export type TileType =
  | 'ROAD_PAVED' | 'ROAD_DIRT' | 'TRAIL' | 'GRASS' | 'FOREST' | 'WATER' | 'SWAMP' | 'SAND'
  | 'HILL' | 'HILL_STEEP' | 'MOUNTAIN' | 'URBAN' | 'BUILDING' | 'BRIDGE' | 'SNOW';

export interface Vehicle {
  id: VehicleId;
  name: string;
  priceBRL: CentsBRL;
  speedTilesS: Partial<Record<TileType, number>>;   // tile ausente = intransponível
  gcpReachM: number;              // distância máxima da rede acessível até o GCP
  gcpNetwork: 'ROADS_TRAILS' | 'ROADS' | 'OFFROAD'; // rede a partir da qual o alcance é medido
  maxSlopePct: number;
  allowSwamp: boolean;
  processesInField: boolean;      // Van Lab
  fieldSpeedFactor?: number;      // fator de processamento em campo
}

export interface FieldEquipment {
  id: FieldEquipmentId;
  name: string;
  sigmaBaseM: number;             // σ de medição do GCP com nivelamento perfeito
  maxPoints: number;              // GCP + CP
  providesRtkCorrections: boolean;
  priceBRL: CentsBRL;
}

export interface Hardware { id: HardwareId; name: string; speedFactor: number; priceBRL: CentsBRL; description: string }

export interface StaffRole {
  id: StaffRoleId; name: string;
  hireCostBRL: CentsBRL; costPerContractBRL: CentsBRL;
  paymentBonus: number;           // fração somada por pessoa (0,08 = +8 %)
  processingSpeedBonus: number;   // fração por pessoa
  maxCount: number;
}
```

---

## 3. Progressão

```ts
export type ModifierKey =
  | 'windDrift' | 'endurance' | 'overworldSpeed' | 'thermalEffect'
  | 'rmseGlobal' | 'texturePenalty' | 'lidarNoise' | 'rollingShutterPenalty'
  | 'contractPayment' | 'museumVisitors' | 'shopPrice' | 'reputationGain' | 'rivalChance';

export interface Modifier { key: ModifierKey; op: 'mul' | 'add'; value: number }
export type ModifierSet = Record<ModifierKey, number>;     // multiplicadores finais (base 1)

export type SkillBranch = 'PILOT' | 'ENGINEERING' | 'MANAGEMENT';
export interface SkillNode {
  id: string;                     // 'PIL_1' … 'GES_4'
  branch: SkillBranch;
  rank: 1 | 2 | 3 | 4;
  name: string; description: string;
  cost: number;                   // pontos
  requires?: string;              // nó anterior do ramo
  effects: readonly Modifier[];
}

export type CosmeticSlot = 'CHARACTER' | 'DRONE_PAINT' | 'ATLAS_ACCESSORY';
export interface Cosmetic {
  id: string; slot: CosmeticSlot; name: string;
  priceBRL: CentsBRL;             // 0 = só por desbloqueio
  unlock?: UnlockCondition;
  colors: { primary: string; secondary: string };   // hex (exceção permitida: dados de cosmético)
}

export type EmblemShape = 'SHIELD' | 'CIRCLE' | 'HEXAGON' | 'DIAMOND';
export type EmblemIcon = 'Compass' | 'Map' | 'Mountain' | 'Plane' | 'Bird' | 'Satellite' | 'Ruler' | 'Globe';
export interface Emblem { shape: EmblemShape; icon: EmblemIcon; primary: string; secondary: string; initials: string /* ≤ 4 */ }

export interface Souvenir { id: string; contractId: string; name: string; story: string; icon: string /* nome lucide */; color: string }

export type UnlockCondition =
  | { type: 'ALWAYS' }
  | { type: 'CONTRACT_DONE'; contractId: string }
  | { type: 'REPUTATION'; min: number }
  | { type: 'LEVEL'; min: number }
  | { type: 'OWNS'; itemId: string }
  | { type: 'RIFTS_DONE'; count: number }
  | { type: 'ALL'; of: readonly UnlockCondition[] }
  | { type: 'ANY'; of: readonly UnlockCondition[] };
```

---

## 4. Contratos

```ts
export type BiomeId =
  | 'RURAL_TUTORIAL' | 'URBAN_VERTICAL' | 'AGRI_PLATEAU' | 'AMAZON' | 'OPEN_PIT_MINE'
  | 'COLONIAL_CENTER' | 'COASTAL_ESTUARY'
  | 'RIFT_GREEN_HILLS' | 'RIFT_PIPES' | 'RIFT_CRATERS' | 'RIFT_FAIRY_FOREST' | 'RIFT_CUBES'
  | 'RIFT_GREY_SWAMP' | 'RIFT_POLAR_BASE' | 'RIFT_SANTOS_HOOD' | 'RIFT_TALL_GRASS'
  | 'RIFT_IRON_TRENCH' | 'RIFT_CLIFF_TOMBS';

export type LightingId = 'SUN_HIGH' | 'OVERCAST' | 'GOLDEN_HOUR' | 'BLIZZARD' | 'MAGIC_FOG';

export type SpecialRuleId =
  | 'URBAN_CANYON_RTK_LOSS' | 'HOMOGENEOUS_TEXTURE' | 'DENSE_CANOPY' | 'STEEP_RELIEF'
  | 'LOW_WIRES' | 'SPECULAR_WATER' | 'STRONG_WIND' | 'EM_INTERFERENCE' | 'BLIZZARD_DRAIN'
  | 'MAGIC_FOG' | 'SEARCHLIGHTS' | 'MOVING_HAZARDS' | 'ENERGY_BEAMS' | 'LAVA_THERMALS'
  | 'VERTICAL_CLIFFS' | 'FEATURE_TARGETS' | 'COLLECTIBLE_RINGS' | 'ELECTRIC_CREATURES' | 'NARROW_TRENCH'
  | 'PAINT_MARKERS';

export type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type FlightModeId = 'TERRAIN_FOLLOWING' | 'CROSS_GRID' | 'OBLIQUE';

export type RequirementCheck =
  | { type: 'MAX_GSD_CM'; value: number }
  | { type: 'MIN_FORWARD_OVERLAP'; value: number }        // %
  | { type: 'MIN_SIDE_OVERLAP'; value: number }           // %
  | { type: 'MIN_COVERAGE_GREEN'; value: number }         // fração 0..1 das células da AOI (exclui água se SPECULAR_WATER)
  | { type: 'SENSOR_KIND'; value: SensorKind }
  | { type: 'MIN_AIRCRAFT_TIER'; value: number }
  | { type: 'AIRCRAFT_KIND'; value: AircraftKind }
  | { type: 'FLIGHT_MODE'; value: FlightModeId }
  | { type: 'ACCURACY_PEC'; cls: 'A' | 'B' | 'C' | 'D'; scaleDenominator: number; contourIntervalM?: number }
  | { type: 'ACCURACY_ASPRS'; horizontalCm: number; verticalCm: number }
  | { type: 'MIN_GCP'; value: number }
  | { type: 'MIN_CP'; value: number }
  | { type: 'MIN_LIDAR_DENSITY'; value: number }          // pts/m² total médio
  | { type: 'MIN_GROUND_DENSITY'; value: number }         // pts/m² de solo
  | { type: 'MAX_VOLUME_ERROR_PCT'; value: number }
  | { type: 'MAX_BLUR_FRACTION'; value: number }
  | { type: 'NOT_DETECTED' }
  | { type: 'FEATURE_CAPTURED'; featureId: string }
  | { type: 'MIN_EXECUTION'; value: number };             // execução E mínima do voo, 0..1 (domain-math §10.3); todo contrato tem

export interface ContractRequirement { id: string; label: string; severity: Severity; check: RequirementCheck }

export interface PortraitSpec { shape: EmblemShape; icon: string /* lucide */; primary: string; secondary: string; initials: string }

export interface ReferencePlan {      // plano que comprovadamente atende o contrato (teste de viabilidade)
  aircraftId: AircraftId; sensorId: string; lensId?: Lens['id'];
  heightM: number; forwardOverlapPct: number; sideOverlapPct: number; speedMs: number;
  modes: readonly FlightModeId[]; obliqueDeg?: 45 | 60; lighting: LightingId;
  gcps: readonly AoiPoint[]; cps: readonly AoiPoint[];
  expected: {
    gsdCm: number; nLines: number; flightTimeS: number;
    /** Plano com LiDAR primário (C03): faixa, densidade total e de solo esperadas. */
    lidar?: { swathM: number; density: number; groundDensity: number };
  };
}

export interface Contract {
  id: string;                     // 'C00'…'C06', 'R01'…'R11'
  dimension: Dimension;
  title: string;
  client: { name: string; role: string; description: string; portrait: PortraitSpec };
  objective: string;
  biome: BiomeId;
  seed: number;
  aoi: { widthM: number; lengthM: number };
  ceilingM: number;               // teto AGL permitido
  terrainReliefM: number;         // amplitude de relevo aproximada (informativo/gerador)
  lightingOptions: readonly LightingId[];
  wind: { meanMs: number; gustMs: number; directionDeg: number };
  specialRules: readonly SpecialRuleId[];
  requirements: readonly ContractRequirement[];
  recommended: { aircraft: AircraftId[]; sensors: string[]; vehicle: VehicleId; notes: string };
  minVehicle: VehicleId;          // para alcançar o marcador no mapa
  basePaymentBRL: CentsBRL;
  xp: number;
  reputationReward: number;
  souvenirId: string;
  museum: { wing: Dimension; slot: number; incomePerMinBRL: CentsBRL };   // slot = lin · 4 + col na grade 4 × 2 da ala
  unlock: UnlockCondition;
  overworldMarker: string;        // caractere no map.ts
  dialogs: { briefing: readonly string[]; success: readonly string[]; failure: readonly string[] };
  referencePlan: ReferencePlan;
}
```

---

## 5. Mundo, terreno e objetos

```ts
export type LandCover =
  | 'GRASS' | 'CROP' | 'FOREST' | 'WATER' | 'ROAD' | 'ROOF' | 'SAND' | 'ROCK' | 'SWAMP'
  | 'URBAN' | 'BENCH' | 'LAVA' | 'SNOW' | 'METAL';

export type WorldObjectKind =
  | 'BUILDING' | 'TREE' | 'POLE' | 'WIRE' | 'PIPE' | 'BRICK_PLATFORM' | 'RING' | 'STONE_ARCH'
  | 'CUBE_BLOCK' | 'ENERGY_BEAM' | 'SEARCHLIGHT' | 'GIANT_WALKER' | 'TOWER' | 'CLIFF_TEMPLE'
  | 'MOVING_HAZARD' | 'GCP_TARGET';

export interface WorldObject {
  id: number;
  kind: WorldObjectKind;
  u: number; v: number;           // centro da base
  widthM: number; depthM: number; heightM: number;   // caixa envolvente (fio: comprimento em depth)
  baseM?: number;                 // altura da base acima do solo (plataformas flutuantes, fios)
  rotationRad?: number;
  color: Rgb;
  solid: boolean;                 // colide?
  collectible?: boolean;          // RING
  motion?: { axis: 'u' | 'v' | 'h'; amplitudeM: number; periodS: number; phase: number };
  activePeriod?: { onS: number; offS: number; phase: number };   // ENERGY_BEAM
  v2?: number; u2?: number;       // WIRE: extremidade 2
}

export interface FeatureTarget { id: string; name: string; u: number; v: number; radiusM: number; needs: 'PHOTO' | 'LIDAR' }

export type SpecialZone =
  | { kind: 'THERMAL'; u: number; v: number; radiusM: number; liftMs: number }
  | { kind: 'RTK_CANYON'; uMin: number; uMax: number; vMin: number; vMax: number }
  | { kind: 'SEARCHLIGHT'; u: number; v: number; radiusM: number; sweepRad: number; periodS: number }
  | { kind: 'WATER'; uMin: number; uMax: number; vMin: number; vMax: number }
  | { kind: 'FOG'; density: number };
```

---

## 6. Plano de voo e missão

```ts
export interface PlanParams {
  aircraftId: AircraftId;
  sensorId: string;               // câmera ou 'POD_LIDAR'
  primarySensor: SensorKind;      // para espaçamento de linhas quando pod (RGB ou LIDAR)
  lensId?: Lens['id'];
  heightM: number;                // AGL planejado (ou altitude constante sobre a cota média da AOI)
  forwardOverlapPct: number;
  sideOverlapPct: number;
  speedMs: number;
  orientation: 'ALONG_LENGTH' | 'ALONG_WIDTH';
  crossGrid: boolean;
  obliqueDeg?: 45 | 60;
  terrainFollowing: boolean;
  lighting: LightingId;
}

export interface FlightLine {
  index: number;
  pass: 'PRIMARY' | 'CROSS';
  start: AoiPoint; end: AoiPoint; // incluem lead-in/out
  aoiStartS: number; aoiEndS: number;   // distância ao longo da linha onde a AOI começa/termina
  direction: 1 | -1;
}

export interface PlanStats {
  focalM: number; pixelPitchM: number;
  gsdM: number; footprintWM: number; footprintHM: number;
  baseM: number; spacingM: number; intervalS: number;
  nLines: number; photosPerLine: number; totalPhotos: number;
  lineLengthM: number; turnTimeS: number; flightTimeS: number; batteriesNeeded: number;
  blurPx: number; skewPx: number;
  lidarSwathM?: number; lidarDensity?: number; groundDensity?: number;
}

export interface FlightPlan { params: PlanParams; lines: readonly FlightLine[]; stats: PlanStats }

export interface PlanValidation { blocking: readonly string[]; warnings: readonly string[] }

export interface GroundPoint { id: string; kind: 'GCP' | 'CP'; u: number; v: number; elevM: number; sigmaM: number }

export type RtkStatus = 'FIX' | 'FLOAT' | 'NONE';

export interface Shot {
  i: number; t: number; sortie: number; lineIndex: number;
  u: number; v: number; aglM: number; altM: number;
  speedMs: number; headingRad: number; crabRad: number; tiltDeg: number;
  footprintWM: number; footprintHM: number;
  blurPx: number; skewPx: number; blurred: boolean;
  lighting: LightingId; rtk: RtkStatus; manual: boolean;
  overWater: boolean; inFog: boolean;
  grade?: ShotGrade;              // nota de execução (domain-math §10.3); ausente em save antigo e em foto sintética: vale como válida, peso 1
}
// `speedMs` é a velocidade no solo no instante do disparo.

export type ShotGrade = 'PERFECT' | 'GOOD' | 'WEAK' | 'REJECTED';

/** Resumo de uma passada por uma linha (domain-math §10.3). */
export interface LinePass {
  lineIndex: number;
  pass: number;                   // 0 na primeira passada da linha na missão, 1 no primeiro revoo…
  sortie: number;
  counts: [perfect: number, good: number, weak: number, rejected: number];
  complete: boolean;              // a aeronave chegou ao fim da linha com dados
}

export interface LidarGrid {           // grade de cobertura da AOI (mesma de coverage: 64×64)
  cols: number; rows: number;
  pulses: number[];               // pulsos (fracionários) que atingiram a célula
  firstAbove: number[];           // pulsos cujo 1º retorno ficou acima do solo (copa/telhado)
  ground: number[];               // pulsos com último retorno no solo
  cellAreaM2: number;
}
export interface LidarSample { u: number; v: number; z: number; ret: 'FIRST' | 'INTERMEDIATE' | 'GROUND' }
export interface LidarBatch { cells: Array<[index: number, pulses: number, firstAbove: number, ground: number]>; samples: LidarSample[] }

export type SortieOutcome = 'COMPLETED' | 'RTH' | 'CRASH' | 'ENERGY_DEPLETED' | 'ABORTED';

export interface MissionData {
  id: string;                     // `${contractId}-${timestamp}`
  contractId: string;
  createdAt: number;
  rivalAdjustment: number;        // multiplicador de pagamento (1, 0,85…)
  isReplay: boolean;
  plan: FlightPlan;
  groundPoints: GroundPoint[];
  fieldEquipmentId: FieldEquipmentId;
  minigames: { levelScore?: number; imuScore?: number };
  atlasCalibrated: boolean;
  sorties: Array<{ index: number; outcome: SortieOutcome; durationS: number }>;
  completedLines: number[];       // linhas com uma passada aceita
  linePasses?: LinePass[];        // ausente em save antigo e em missão sintética: a execução vale 1
  shots: Shot[];
  lidar?: { grid: LidarGrid; samples: LidarSample[] };
  events: { collisions: number; crashes: number; detected: boolean; featuresCaptured: string[]; ringsCollected: number };
  status: 'PLANNING' | 'IN_FLIGHT' | 'PENDING_PROCESSING' | 'PROCESSED';
}
```

---

## 7. Relatório de qualidade

```ts
export interface Residual { pointId: string; kind: 'GCP' | 'CP'; dxM: number; dyM: number; dzM: number }
export interface RmseSet { x: number; y: number; z: number; r: number /* √(x²+y²) */ }

export interface PecResult {
  scaleDenominator: number; requiredClass: 'A' | 'B' | 'C' | 'D';
  planimetric: { achieved: 'A' | 'B' | 'C' | 'D' | 'FORA'; epM: number; pecM: number; pass: boolean; pct90: number };
  altimetric?: { achieved: 'A' | 'B' | 'C' | 'D' | 'FORA'; epM: number; pecM: number; pass: boolean; pct90: number };
}
export interface AsprsResult { horizontalCm: number; verticalCm: number; rmseHcm: number; rmseVcm: number; passH: boolean; passV: boolean }

export interface CoverageResult {
  cols: number; rows: number; counts: number[];       // fotos válidas por célula (fracionário: foto fraca pesa 0,5)
  green: number; yellow: number; red: number;         // frações das células válidas
  excludedCells: number[];                             // água sob SPECULAR_WATER etc.
  meanCount: number;
}

export interface LensCalibration { fPx: number; cxPx: number; cyPx: number; k1: number; k2: number; p1: number; p2: number; reprojErrorPx: number }

export interface RequirementResult { id: string; label: string; severity: Severity; pass: boolean; valueText: string }

export interface PaymentBreakdown {
  baseBRL: CentsBRL; replayFactor: number; qualityFactor: number; rivalFactor: number;
  managementBonus: number; staffBonus: number; staffCostBRL: CentsBRL;
  penaltiesBRL: CentsBRL;          // reparo de aeronave etc.
  totalBRL: CentsBRL;
}

export interface QualityReport {
  missionId: string; contractId: string;
  residuals: Residual[];
  rmse: { gcp: RmseSet; cp: RmseSet | null };
  multipliers: Array<{ key: string; label: string; xy: number; z: number }>;
  pec?: PecResult; asprs?: AsprsResult;
  coverage: CoverageResult;
  lens?: LensCalibration;
  lidarStats?: { meanDensity: number; meanGroundDensity: number };
  volume?: { referenceM3: number; measuredM3: number; errorPct: number };
  requirements: RequirementResult[];
  approved: boolean; critical: boolean;   // critical = reprovado por falha crítica
  qualityScore: number;                   // 0..1
  payment: PaymentBreakdown;
  xp: number; reputationDelta: number;
  souvenirAwarded?: string;
  processingTimeS: number;
  execution?: {                           // só em missão com `linePasses`
    score: number;                        // E, 0..1
    letter: 'S' | 'A' | 'B' | 'C' | 'D';
    counts: [perfect: number, good: number, weak: number, rejected: number];   // da melhor passada de cada linha
    pilotBonus: number;                   // parcela do bônus de pilotagem em Q (0, 0,05 ou 0,10)
  };
}
```

---

## 8. SaveGame

```ts
export type ContractStatus = 'LOCKED' | 'AVAILABLE' | 'STOLEN' | 'COMPLETED';
export interface ContractProgress {
  status: ContractStatus; completions: number;
  bestScore: number; bestClass?: string;
  stolenAtCompletionCount?: number;       // nº total de contratos concluídos no momento do roubo
  bestMissionLines?: Array<{ start: AoiPoint; end: AoiPoint }>;   // para miniaturas da mesa
  bestAircraftId?: AircraftId;
}

export interface MuseumSector { contractId: string; qualityScore: number; mappedAt: number; incomePerMinBRL: CentsBRL; className: string }

export interface Settings {
  masterVolume: number; sfxVolume: number; muted: boolean;
  quality: 'LOW' | 'MEDIUM' | 'HIGH'; reduceFlashes: boolean; showFps: boolean;
}

export interface SaveGame {
  version: 1;
  createdAt: number; updatedAt: number;
  player: { name: string; money: CentsBRL; xp: number; level: number; skillPoints: number; reputation: number };
  skills: string[];
  staff: Record<StaffRoleId, number>;
  inventory: {
    aircraft: AircraftId[]; sensors: string[]; lenses: Array<Lens['id']>; payloads: Array<LidarPayload['id']>;
    vehicles: VehicleId[]; fieldEquipment: FieldEquipmentId[]; hardware: HardwareId;
    cosmetics: string[];
    equipped: { character: string; dronePaint: string; atlasAccessory: string };
    emblem: Emblem;
    corn: { stock: number; crop: number };
    atlasCalibrationFlights: number;
  };
  contracts: Record<string, ContractProgress>;
  museum: { sectors: Record<string, MuseumSector>; featured: Partial<Record<Dimension, string>>; lastIncomeAt: number; totalVisitors: number };
  souvenirs: string[];
  pendingMissions: MissionData[];
  world: { avatar: { x: number; y: number; facing: 'N' | 'S' | 'E' | 'W' }; vehicleMode: VehicleId; dimensionTab: Dimension; discoveredRifts: string[]; lastEventAt: number };
  rival: { score: number; history: Array<{ at: number; contractId: string; kind: 'COUNTER_OFFER' | 'STEAL' }> };
  stats: { contractsCompleted: number; photosTaken: number; flightTimeS: number; crashes: number; distanceTiles: number };
  flags: { introSeen: boolean; finaleSeen: boolean; tutorialStep: number };
}
```

`Settings` é persistido separadamente (`scan-city-settings`); veja [architecture §6](architecture.md).
