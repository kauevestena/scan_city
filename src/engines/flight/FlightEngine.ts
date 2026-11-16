/**
 * Motor de voo 2.5D (survey-flight §3, §5): fases, física da aeronave, câmera RGB,
 * energia, surtida e render (céu, terreno em faixas, pegadas, aeronave). Sem React: o
 * store recebe os eventos pelos callbacks.
 */
import type { Catalog } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { drainPerSecond, rthRequired } from '@/domain/energy';
import { capturedFeatures } from '@/domain/features';
import {
  crabAngleRad,
  thermalLiftMs,
  initialAircraftState,
  stepAircraft,
  windAt,
  type AircraftState,
  type FlightInput,
} from '@/domain/flightPhysics';
import { gsd } from '@/domain/photogrammetry';
import { FLIGHT_STAGE, PERF } from '@/engines/perf';
import { planEquipment } from '@/domain/requirements';
import { resolveRuleEffects, type RuleEffects } from '@/domain/specialRules';
import { clamp, lerp } from '@/lib/math';
import { hashString, mulberry32, type Rng } from '@/lib/rng';
import type {
  Aircraft,
  AoiPoint,
  Contract,
  LidarBatch,
  MissionData,
  ModifierSet,
  RtkStatus,
  Shot,
  SortieOutcome,
} from '@/types';
import { valueNoise2D } from '@/world/terrain/noise';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import type { CanvasSurface } from '../canvas';
import type { Simulation } from '../loop';
import { drawAircraft, drawGroundShadow, type SpriteColors } from './aircraftSprite';
import { driftMultiplier, emActive, emDisturbance, windAboveTolerance } from './environment';
import {
  cornLeft,
  cornUsed,
  initialDistraction,
  isDistracted,
  planDistraction,
  stepDistraction,
  type DistractionPlan,
  type DistractionState,
} from './atlas';
import {
  detectionProgress,
  ElectricSchedule,
  initialDetection,
  insideSearchlight,
  nearestSearchlightM,
  nextWarp,
  ringCollected,
  searchlightSpot,
  shouldResetWarp,
  solidAheadOf,
  stepDetection,
  type DetectionState,
  type TimeWarp,
} from './fieldElements';
import { LidarSensor, TOGGLE_COOLDOWN_S, type LidarHit } from './lidarSensor';
import { WeatherParticles } from './particles';
import { checkCollision, hitsTerrain, isBeamOn, motionOffset } from './collision';
import {
  CRASH_S,
  crashPose,
  IMPACT_SPEED_FACTOR,
  INVULNERABLE_S,
  invulnerableAlpha,
  SHAKE_S,
  shakeOffset,
} from './effects';
import { autopilotInput } from './autopilot';
import {
  cameraModel,
  FOOTPRINT_FADE_S,
  footprintCorners,
  inShotWindow,
  obliqueCorners,
  shearCorners,
  MANUAL_COOLDOWN_S,
  realOverlapPct,
  recordShot,
  rtkStatusAt,
  ShotTimer,
  type CameraModel,
} from './cameraSensor';
import {
  HudThrottle,
  makeAlert,
  topAlerts,
  type FlightAlert,
  type FlightHudSnapshot,
  type FlightPhase,
} from './hudPublisher';
import {
  halfWidthAt,
  HORIZON_CRUISE,
  HORIZON_TAKEOFF,
  makeCamera,
  projectAbs,
  type FlightCamera,
  type Quality,
} from './projection';
import { aoiPoint, runFrame, toRun, type RunFrame } from './runFrame';
import { drawRiftParticles, drawRiftSky, drawSky } from './sky';
import { renderTerrain, sunInRunFrame, type GroundMark, type SceneObject } from './terrainRenderer';
import { drawElectricSparks } from './electricSparks';
import { hotSpotHeat, objectHeat, thermalColor, thermalFeatures } from './thermal';

/** Degraus do desvanecimento dos pontos do LiDAR e os estilos prontos de cada retorno. */
export const LIDAR_FADE_LEVELS = 12;
const lidarStyles = (rgb: string): string[] =>
  Array.from(
    { length: LIDAR_FADE_LEVELS + 1 },
    (_, k) => `rgba(${rgb}, ${(k / LIDAR_FADE_LEVELS).toFixed(3)})`,
  );
const LIDAR_FIRST_STYLES = lidarStyles('34, 211, 238');
const LIDAR_LAST_STYLES = lidarStyles('52, 211, 153');

export const TAKEOFF_S = 2.5;
export const LANDING_S = 2;
export const TURN_PRESENT_MAX_S = 2.5;
export const FLASH_S = 0.08;
export const RETURNING_S = 3;
/** Janela para confirmar o RTH (survey-flight §5.12). */
export const RTH_CONFIRM_S = 3;
export const RTH_BEEP_S = 1.5;
/** Lote de disparos enviados ao store (§6). */
export const SHOT_BATCH = 10;
/** Suavização do X da câmera por quadro (a 60 FPS). */
const CAM_FOLLOW = 0.1;

export interface SortieResult {
  outcome: SortieOutcome;
  durationS: number;
  completedLines: number[];
  photos: number;
  collisions: number;
  /** Detectado por um holofote nesta surtida. */
  detected: boolean;
  /** Anéis coletados na surtida. */
  rings: number;
  /** Alvos capturados com os dados acumulados (surtidas anteriores + esta). */
  featuresCaptured: string[];
  /** Pulsos e amostras LiDAR da surtida (`null` sem Pod). */
  lidar: LidarBatch | null;
  /** Milho consumido na surtida (só Atlas). */
  cornUsed: number;
  /** A aeronave é o Atlas: a queda vira "voltou para casa", sem custo de reparo. */
  atlas: boolean;
}

export interface FlightInputSource {
  axis(a: 'MOVE_X' | 'MOVE_Y' | 'ALT_UP' | 'ALT_DOWN'): number;
}

export interface FlightEngineOptions {
  mission: MissionData;
  contract: Contract;
  terrain: TerrainSampler;
  catalog: Catalog;
  input: FlightInputSource;
  mods: ModifierSet;
  ownsRtkKit: boolean;
  autopilot: boolean;
  quality: () => Quality;
  reduceFlashes: () => boolean;
  colors: SpriteColors;
  accessory?: SpriteColors | null;
  /** Índice da surtida (0 na primeira). */
  sortie: number;
  /** Disparos já registrados na missão (o índice continua). */
  shotOffset: number;
  onShots?: (batch: Shot[]) => void;
  onShutter?: () => void;
  onSortieEnd?: (result: SortieResult) => void;
  onHud?: (snapshot: FlightHudSnapshot) => void;
  onPhase?: (phase: FlightPhase) => void;
  onCollision?: () => void;
  /** Anel coletado (som `COLLECT`). */
  onRing?: () => void;
  /** Detectado por um holofote (som `ALERT`). */
  onDetected?: () => void;
  /** O sensor ativo mudou (liga/desliga o zumbido do LiDAR e mostra dicas). */
  onSensorChange?: (sensor: 'RGB' | 'LIDAR', scanHz: number) => void;
  /** Dica curta ("Sem LiDAR a bordo", "Ative a câmera [Tab]"). */
  onHint?: (text: string) => void;
  /** Energia inicial (0–1); o Atlas parte do papo. Padrão: 1. */
  initialEnergy?: number;
  /** Bip de RTH recomendado (a cada 1,5 s). */
  onRthBeep?: () => void;
  /** O status RTK mudou (toast "RTK FLOAT — multipercurso GNSS"). */
  onRtkChange?: (status: RtkStatus) => void;
  onCrash?: () => void;
  now?: () => number;
}

interface FootprintFx {
  corners: AoiPoint[];
  bornS: number;
}

const meanElevCache = new WeakMap<TerrainSampler, number>();

/** Cota média da AOI (grade de 10 m): a altitude constante do plano é H acima dela. */
export function meanAoiElevation(terrain: TerrainSampler): number {
  const cached = meanElevCache.get(terrain);
  if (cached !== undefined) return cached;
  let sum = 0;
  let n = 0;
  for (let u = 0; u <= terrain.aoi.lengthM; u += 10) {
    for (let v = 0; v <= terrain.aoi.widthM; v += 10) {
      sum += terrain.elevation(u, v);
      n++;
    }
  }
  const mean = sum / n;
  meanElevCache.set(terrain, mean);
  return mean;
}

export class FlightEngine implements Simulation {
  phase: FlightPhase = 'TAKEOFF';
  private phaseT = 0;
  readonly aircraft: Aircraft;
  private readonly camera: CameraModel;
  private readonly lines: MissionData['plan']['lines'];
  private lineCursor = 0;
  private frame: RunFrame;
  ac: AircraftState;
  energy = 1;
  hull: number;
  /** Colisões desta surtida. */
  collisions = 0;
  private invulnerableS = 0;
  private shakeS = 0;
  private crashOutcome: SortieOutcome | null = null;
  private crashAlt = 0;
  private sortieT = 0;
  /** Tempo de curva real (não apresentado) somado à duração. */
  private extraTimeS = 0;
  private readonly planAlt: number;
  private readonly startAlt: number;
  private camX = 0;
  private input: FlightInput = { moveX: 0, moveY: 0, altUp: 0, altDown: 0 };
  private readonly timer = new ShotTimer();
  private manualCooldown = 0;
  readonly shots: Shot[] = [];
  private pending: Shot[] = [];
  private lineShots: Shot[] = [];
  private pRealHistory: number[] = [];
  private lastBlur = 0;
  readonly completedLines = new Set<number>();
  private footprints: FootprintFx[] = [];
  private flashUntil = -1;
  private crossWind = 0;
  private headWind = 0;
  private readonly windNoise = valueNoise2D(0x51d);
  private readonly hud = new HudThrottle();
  private surface: CanvasSurface | null = null;
  private weather: WeatherParticles | null = null;
  /** Efeitos das regras especiais do contrato (domain/specialRules). */
  private readonly rules: RuleEffects;
  private readonly em: boolean;
  private emHeading = 0;
  private lastRtk: RtkStatus = 'NONE';
  private rthConfirmUntil = -1;
  readonly lidar: LidarSensor | null;
  /** Aceleração de tempo do jogador (×1/×2/×4); o loop lê `timeWarp`. */
  timeWarp: TimeWarp = 1;
  private detection: DetectionState = initialDetection();
  private readonly collectedRings = new Set<number>();
  private readonly electric: ElectricSchedule | null;
  activeSensor: 'RGB' | 'LIDAR' = 'RGB';
  private toggleCooldown = 0;
  private lineLidarData = false;
  private fan: LidarHit[] = [];
  private distractionPlan: DistractionPlan | null = null;
  private distraction: DistractionState = initialDistraction();
  private lineT = 0;
  readonly startEnergy: number;
  private readonly atlasRng: Rng | null;
  private rthBeepAt = 0;
  private ended = false;

  constructor(private readonly opts: FlightEngineOptions) {
    const { aircraft } = planEquipment(opts.mission.plan, opts.catalog);
    this.aircraft = aircraft;
    this.hull = aircraft.hull;
    this.rules = resolveRuleEffects(opts.contract.specialRules);
    this.em = emActive(opts.contract.specialRules, aircraft);
    // Criaturas elétricas: o Atlas é imune; os picos são seedados pela missão.
    this.electric =
      this.rules.flight.electricCreatures !== null && !aircraft.emImmune
        ? new ElectricSchedule(mulberry32(hashString(`${opts.mission.id}:electric`)))
        : null;
    const pod = planEquipment(opts.mission.plan, opts.catalog);
    const payload = pod.podId ? opts.catalog.payloads.find((p) => p.id === pod.podId) : undefined;
    this.lidar = payload ? new LidarSensor(payload, opts.terrain, opts.contract.aoi) : null;
    if (this.lidar)
      this.activeSensor = opts.mission.plan.params.primarySensor === 'LIDAR' ? 'LIDAR' : 'RGB';
    // O Atlas começa com o que há no papo (0–10 unidades).
    if (opts.initialEnergy !== undefined) this.energy = opts.initialEnergy;
    this.atlasRng =
      aircraft.kind === 'BIRD' ? mulberry32(hashString(`${opts.mission.id}:${opts.sortie}`)) : null;
    this.startEnergy = this.energy;
    this.camera = cameraModel(opts.mission.plan, opts.catalog);
    // Primárias em zigue-zague e depois as cruzadas: a ordem do plano. Só as que faltam.
    const done = new Set(opts.mission.completedLines);
    this.lines = opts.mission.plan.lines.filter((l) => !done.has(l.index));
    const first = this.lines[0] ?? opts.mission.plan.lines[0];
    if (!first) throw new RangeError('Plano sem linhas');
    this.frame = runFrame(first);
    this.planAlt = meanAoiElevation(opts.terrain) + opts.mission.plan.params.heightM;
    this.startAlt = this.elevationAt(0, 0) + 1;
    this.ac = {
      ...initialAircraftState(opts.mission.plan.params.speedMs, this.startAlt),
      aglTargetM: opts.mission.plan.params.heightM,
    };
  }

  get line() {
    return this.lines[this.lineCursor];
  }

  private now(): number {
    return this.opts.now?.() ?? performance.now();
  }

  private elevationAt(s: number, x: number): number {
    const p = aoiPoint(this.frame, s, x);
    return this.opts.terrain.elevation(p.u, p.v);
  }

  attach(surface: CanvasSurface): void {
    this.surface = surface;
    this.weather = new WeatherParticles(
      this.opts.mission.plan.params.lighting,
      surface.width,
      surface.height,
    );
  }

  /** Ao começar cada linha, o Atlas sorteia (seedado) uma distração. */
  private beginLineAtlas(): void {
    this.lineT = 0;
    this.lineLidarData = false;
    this.distraction = initialDistraction();
    this.distractionPlan = null;
    const line = this.line;
    if (!this.atlasRng || !line) return;
    const duration = this.frame.lengthM / Math.max(1, this.opts.mission.plan.params.speedMs);
    this.distractionPlan = planDistraction(this.atlasRng.fork(`line-${line.index}`), duration);
  }

  setPhase(phase: FlightPhase): void {
    if (phase === 'RUN' && this.phase !== 'RUN' && this.phase !== 'RETURNING')
      this.beginLineAtlas();
    this.phase = phase;
    this.phaseT = 0;
    this.opts.onPhase?.(phase);
  }

  /** Disparo manual (`FIRE`), com cooldown de 0,3 s, em qualquer ponto do *run*. */
  manualShot(): boolean {
    if (this.phase !== 'RUN' || this.manualCooldown > 0) return false;
    if (this.activeSensor === 'LIDAR') {
      this.opts.onHint?.(STRINGS.flight.hints.activateCamera);
      return false;
    }
    this.manualCooldown = MANUAL_COOLDOWN_S;
    this.fire(true);
    return true;
  }

  private fire(manual: boolean): void {
    const plan = this.opts.mission.plan;
    const line = this.line;
    if (!line) return;
    const shot = recordShot({
      index: this.opts.shotOffset + this.shots.length,
      tS: this.sortieT,
      sortie: this.opts.sortie,
      lineIndex: line.index,
      frame: this.frame,
      s: this.ac.s,
      x: this.ac.x,
      altM: this.ac.alt,
      speedMs: this.ac.v,
      crabRad:
        (this.aircraft.turnRadiusM > 0 ? crabAngleRad(this.crossWind, this.ac.v) : 0) +
        this.emHeading,
      tiltDeg: plan.params.obliqueDeg ?? 0,
      lighting: plan.params.lighting,
      rtk: this.rtk(),
      manual,
      camera: this.camera,
      terrain: this.opts.terrain,
    });
    const prev = this.lineShots.at(-1);
    if (prev) {
      this.pRealHistory.push(realOverlapPct(prev, shot));
      if (this.pRealHistory.length > 3) this.pRealHistory.shift();
    }
    this.lastBlur = shot.blurPx;
    this.lineShots.push(shot);
    this.shots.push(shot);
    this.pending.push(shot);
    if (this.pending.length >= SHOT_BATCH) this.flushShots();
    const base =
      shot.tiltDeg > 0
        ? obliqueCorners(this.frame, this.ac.s, this.ac.x, shot.aglM, shot.tiltDeg, this.camera)
        : footprintCorners(this.frame, this.ac.s, this.ac.x, shot.footprintWM, shot.footprintHM);
    // Rolling shutter com movimento lateral: o trapézio sai cisalhado pelo skew (em metros).
    const lateral = Math.abs(this.ac.vLat + this.ac.drift) > 0.1 || this.phase === 'TURN';
    const shearM = lateral
      ? shot.skewPx * gsd(shot.aglM, this.camera.pitchM, this.camera.focalM)
      : 0;
    this.footprints.push({
      corners:
        shearM > 0
          ? shearCorners(base, this.frame, Math.sign(this.ac.vLat + this.ac.drift || 1) * shearM)
          : base,
      bornS: this.sortieT,
    });
    if (!this.opts.reduceFlashes()) this.flashUntil = this.sortieT + FLASH_S;
    this.opts.onShutter?.();
  }

  private flushShots(): void {
    if (this.pending.length === 0) return;
    this.opts.onShots?.(this.pending);
    this.pending = [];
  }

  /** Posição da aeronave na AOI (u, v). */
  pos() {
    return aoiPoint(this.frame, this.ac.s, this.ac.x);
  }

  private rtk() {
    const p = aoiPoint(this.frame, this.ac.s, this.ac.x);
    return rtkStatusAt(this.aircraft.rtk, this.opts.ownsRtkKit, this.opts.terrain.zones, p);
  }

  private readInput(): FlightInput {
    if (this.opts.autopilot) {
      return autopilotInput({
        x: this.ac.x,
        vx: this.ac.vLat + this.ac.drift,
        alt: this.ac.alt,
        // Com Terrain Following, o AGL-alvo é mantido pela física: sem correção vertical.
        targetAlt: this.opts.mission.plan.params.terrainFollowing ? this.ac.alt : this.planAlt,
        lateralMaxMs: Math.max(1, this.aircraft.lateralSpeedMaxMs),
        obstacleAhead: false,
      });
    }
    const i = this.opts.input;
    return {
      moveX: i.axis('MOVE_X'),
      moveY: i.axis('MOVE_Y'),
      altUp: i.axis('ALT_UP'),
      altDown: i.axis('ALT_DOWN'),
    };
  }

  private updateWind(): void {
    const w = windAt(this.sortieT, this.opts.contract.wind, (x) => this.windNoise(x, 0));
    // O vento vem de `directionDeg`; vai para o lado oposto (leste = +u, sul = +v).
    const to = ((this.opts.contract.wind.directionDeg + 180) * Math.PI) / 180;
    const wu = Math.sin(to) * w;
    const wv = -Math.cos(to) * w;
    this.crossWind = wu * this.frame.right.u + wv * this.frame.right.v;
    this.headWind = wu * this.frame.dir.u + wv * this.frame.dir.v;
  }

  private drain(dtS: number): void {
    const rate = drainPerSecond({
      enduranceS: this.aircraft.enduranceS,
      enduranceMod: this.opts.mods.endurance,
      speedMs: this.ac.v,
      vCruiseMs: this.aircraft.vCruiseMs,
      windMs: Math.hypot(this.crossWind, this.headWind),
      climbing: this.ac.climbing,
      blizzard: this.rules.flight.energyDrainFactor > 1,
    });
    this.energy = Math.max(0, this.energy - rate * dtS);
  }

  update(dtS: number): void {
    PERF.flight.enter(FLIGHT_STAGE.UPDATE);
    this.step(dtS);
    PERF.flight.leave();
  }

  private step(dtS: number): void {
    if (this.phase === 'POST_FLIGHT') return;
    this.phaseT += dtS;
    this.sortieT += dtS;
    this.manualCooldown = Math.max(0, this.manualCooldown - dtS);
    this.weather?.update(dtS, this.crossWind, this.sortieT);
    if (this.phase === 'RUN' && this.rthRecommended()) {
      if (this.sortieT >= this.rthBeepAt) {
        this.rthBeepAt = this.sortieT + RTH_BEEP_S;
        this.opts.onRthBeep?.();
      }
      // O autopilot de depuração pede e confirma o RTH sozinho.
      if (this.opts.autopilot) this.requestRth();
    }
    this.toggleCooldown = Math.max(0, this.toggleCooldown - dtS);
    this.invulnerableS = Math.max(0, this.invulnerableS - dtS);
    this.shakeS = Math.max(0, this.shakeS - dtS);
    this.updateWind();
    switch (this.phase) {
      case 'TAKEOFF': {
        const k = clamp(this.phaseT / TAKEOFF_S, 0, 1);
        // Com TF, sobe até H acima do terreno sob a aeronave; senão, até H sobre a cota média.
        const target = this.opts.mission.plan.params.terrainFollowing
          ? this.elevationAt(this.ac.s, this.ac.x) + this.opts.mission.plan.params.heightM
          : this.planAlt;
        this.ac = { ...this.ac, alt: lerp(this.startAlt, target, k * k * (3 - 2 * k)) };
        this.drain(dtS);
        if (k >= 1) this.setPhase('RUN');
        break;
      }
      case 'RUN':
        this.stepRun(dtS);
        break;
      case 'TURN':
        if (this.phaseT >= Math.min(this.opts.mission.plan.stats.turnTimeS, TURN_PRESENT_MAX_S)) {
          this.startLine(this.lineCursor + 1);
        }
        break;
      case 'LANDING': {
        const k = clamp(this.phaseT / LANDING_S, 0, 1);
        const ground = this.elevationAt(this.ac.s, this.ac.x) + 1;
        this.ac = { ...this.ac, alt: lerp(this.ac.alt, ground, k) };
        if (k >= 1) this.endSortie('COMPLETED');
        break;
      }
      case 'RETURNING': {
        // Sobe e faz a curva de volta; a surtida termina como RTH com os dados mantidos.
        this.drain(dtS);
        this.ac = { ...this.ac, alt: this.ac.alt + 4 * dtS };
        if (this.phaseT >= RETURNING_S) this.endSortie('RTH');
        break;
      }
      case 'CRASHED':
        if (this.phaseT >= CRASH_S && this.crashOutcome) this.endSortie(this.crashOutcome);
        break;
      default:
        break;
    }
    if (this.energy <= 0 && !this.ended && this.phase !== 'LANDING' && this.phase !== 'CRASHED') {
      this.crash('ENERGY_DEPLETED');
    }
  }

  /** Início da queda (casco 0, terreno ou energia): 2 s de animação e depois o pós-voo. */
  private crash(outcome: SortieOutcome): void {
    if (this.phase === 'CRASHED' || this.ended) return;
    this.crashOutcome = outcome;
    this.crashAlt = this.ac.alt;
    this.shakeS = SHAKE_S;
    this.opts.onCrash?.();
    this.setPhase('CRASHED');
  }

  private collide(): void {
    const body = { u: 0, v: 0, alt: this.ac.alt, radiusM: this.aircraft.collisionRadiusM };
    const p = aoiPoint(this.frame, this.ac.s, this.ac.x);
    body.u = p.u;
    body.v = p.v;
    const ground = (u: number, v: number) => this.opts.terrain.elevation(u, v);
    if (hitsTerrain(body, ground)) {
      this.hull = 0;
      this.crash('CRASH');
      return;
    }
    if (this.invulnerableS > 0) return;
    // Móveis podem sair do índice de `u` em até a amplitude: margem de 40 m.
    const near = this.opts.terrain.objectsInRange(p.u - 40, p.u + 40);
    const hit = checkCollision(body, near, this.sortieT, ground);
    if (!hit) return;
    this.hull -= 1;
    this.collisions += 1;
    this.invulnerableS = INVULNERABLE_S;
    this.shakeS = SHAKE_S;
    this.ac = { ...this.ac, v: this.ac.v * IMPACT_SPEED_FACTOR };
    this.opts.onCollision?.();
    if (this.hull <= 0) this.crash('CRASH');
  }

  private stepRun(dtS: number): void {
    const plan = this.opts.mission.plan;
    this.input = this.readInput();
    const s0 = this.ac.s;
    this.ac = stepAircraft(
      this.ac,
      this.input,
      {
        aircraft: this.aircraft,
        planSpeedMs: plan.params.speedMs,
        ceilingM: this.opts.contract.ceilingM,
        elevationM: this.elevationAt(this.ac.s, this.ac.x),
        crossWindMs: this.crossWind,
        // Acima da tolerância, a deriva dobra (STRONG_WIND).
        windDriftMod:
          this.opts.mods.windDrift * driftMultiplier(this.opts.contract.wind, this.aircraft),
        thermalLiftMs: thermalLiftMs(
          this.opts.terrain.zones,
          this.pos().u,
          this.pos().v,
          this.opts.mission.plan.params.lighting,
          this.opts.mods.thermalEffect,
        ),
        terrainFollowing: plan.params.terrainFollowing,
        elevationAhead: (d) => this.elevationAt(this.ac.s + d, this.ac.x),
      },
      dtS,
    );
    if (this.em) {
      // Interferência EM: tremor lateral de ±0,8 m/s (a deriva de rumo vai para as fotos).
      const d = emDisturbance(this.sortieT, (x) => this.windNoise(x, 7));
      this.emHeading = d.headingRad;
      this.ac = { ...this.ac, x: this.ac.x + d.lateralMs * dtS };
    }
    if (this.distractionPlan) {
      this.lineT += dtS;
      const d = stepDistraction(
        this.distraction,
        this.distractionPlan,
        this.lineT,
        dtS,
        this.input.moveX,
      );
      this.distraction = d.state;
      if (d.lateralMs !== 0) this.ac = { ...this.ac, x: this.ac.x + d.lateralMs * dtS };
    }
    const rtk = this.rtk();
    if (rtk !== this.lastRtk) {
      this.lastRtk = rtk;
      this.opts.onRtkChange?.(rtk);
    }
    this.drain(dtS);
    this.collide();
    if (this.phase !== 'RUN') {
      this.timeWarp = 1;
      return;
    }
    this.stepFieldElements(dtS);
    const window = inShotWindow(this.ac.s, this.frame, plan.stats.baseM);
    if (this.activeSensor === 'RGB' && this.timer.step(dtS, plan.stats.intervalS, window))
      this.fire(false);
    if (this.activeSensor === 'LIDAR' && this.lidar) {
      const agl = this.ac.alt - this.opts.terrain.elevation(this.pos().u, this.pos().v);
      const pulses = this.lidar.sweep({
        frame: this.frame,
        s0,
        s1: this.ac.s,
        x: this.ac.x,
        aglM: agl,
        dtS,
      });
      if (pulses > 0 && window) this.lineLidarData = true;
      this.fan = this.lidar.beams(this.sortieT, this.ac.s, this.ac.x, this.ac.alt, this.frame);
      this.lidar.trackHits(this.fan, dtS);
    }
    const line = this.line;
    if (line && this.ac.s >= this.frame.aoiEndS + plan.stats.baseM) {
      const inAoi = this.lineShots.some((s) => {
        const r = toRun(this.frame, s);
        return (
          r.s >= this.frame.aoiStartS - plan.stats.baseM &&
          r.s <= this.frame.aoiEndS + plan.stats.baseM
        );
      });
      if (inAoi || this.lineLidarData) this.completedLines.add(line.index);
    }
    if (this.ac.s >= this.frame.lengthM) {
      if (this.lineCursor + 1 < this.lines.length) {
        // A energia da curva real é consumida de uma vez; a apresentação dura até 2,5 s.
        const turnS = plan.stats.turnTimeS;
        this.drain(turnS);
        this.extraTimeS += Math.max(0, turnS - Math.min(turnS, TURN_PRESENT_MAX_S));
        this.setPhase('TURN');
      } else {
        this.setPhase('LANDING');
      }
    }
  }

  private startLine(cursor: number): void {
    this.lineCursor = cursor;
    const line = this.line;
    if (!line) {
      this.setPhase('LANDING');
      return;
    }
    this.frame = runFrame(line);
    this.ac = { ...this.ac, s: 0, x: 0, vLat: 0 };
    this.camX = 0;
    this.timer.reset();
    this.lineShots = [];
    this.pRealHistory = [];
    this.setPhase('RUN');
  }

  private endSortie(outcome: SortieOutcome): void {
    if (this.ended) return;
    this.ended = true;
    this.flushShots();
    this.setPhase('POST_FLIGHT');
    this.opts.onSortieEnd?.({
      outcome,
      durationS: this.sortieT + this.extraTimeS,
      completedLines: [...this.completedLines].sort((a, b) => a - b),
      photos: this.shots.length,
      collisions: this.collisions,
      detected: this.detection.detected,
      rings: this.collectedRings.size,
      featuresCaptured:
        outcome === 'CRASH' || outcome === 'ENERGY_DEPLETED' ? [] : this.evaluateFeatures(),
      lidar: this.lidar ? this.lidar.drainBatch() : null,
      cornUsed: this.aircraft.energyUnit === 'CORN' ? cornUsed(this.startEnergy, this.energy) : 0,
      atlas: this.aircraft.kind === 'BIRD',
    });
    this.publish(true);
  }

  /**
   * `TOGGLE_SENSOR` (só com o Pod LiDAR a bordo, cooldown de 0,5 s): alterna RGB ↔ LiDAR.
   * Sem Pod, é um no-op com a dica "Sem LiDAR a bordo".
   */
  toggleSensor(): 'TOGGLED' | 'NO_POD' | 'COOLDOWN' | 'IGNORED' {
    if (this.phase !== 'RUN') return 'IGNORED';
    if (!this.lidar) {
      this.opts.onHint?.(STRINGS.flight.hints.noLidar);
      return 'NO_POD';
    }
    if (this.toggleCooldown > 0) return 'COOLDOWN';
    this.toggleCooldown = TOGGLE_COOLDOWN_S;
    this.activeSensor = this.activeSensor === 'RGB' ? 'LIDAR' : 'RGB';
    this.timer.reset();
    this.opts.onSensorChange?.(this.activeSensor, this.lidar.scanHz);
    return 'TOGGLED';
  }

  /**
   * `RTH`: o primeiro acionamento abre a confirmação (3 s); o segundo dentro da janela
   * inicia o retorno. Devolve o estado resultante.
   */
  requestRth(): 'IGNORED' | 'ASK' | 'CONFIRMED' {
    if (this.phase !== 'RUN') return 'IGNORED';
    if (this.sortieT < this.rthConfirmUntil) {
      this.rthConfirmUntil = -1;
      this.setPhase('RETURNING');
      return 'CONFIRMED';
    }
    this.rthConfirmUntil = this.sortieT + RTH_CONFIRM_S;
    return 'ASK';
  }

  cancelRth(): void {
    this.rthConfirmUntil = -1;
  }

  get rthConfirming(): boolean {
    return this.phase === 'RUN' && this.sortieT < this.rthConfirmUntil;
  }

  /** Posição de casa: o início da primeira linha do plano. */
  private distanceHomeM(): number {
    const home = this.opts.mission.plan.lines[0]?.start ?? { u: 0, v: 0 };
    const p = this.pos();
    return Math.hypot(p.u - home.u, p.v - home.v);
  }

  /** Energia restante abaixo da necessária para voltar × 1,2, ou de 20 % (domain-math §7). */
  rthRecommended(): boolean {
    const drainCruise = drainPerSecond({
      enduranceS: this.aircraft.enduranceS,
      enduranceMod: this.opts.mods.endurance,
      speedMs: this.aircraft.vCruiseMs,
      vCruiseMs: this.aircraft.vCruiseMs,
      windMs: 0,
      climbing: false,
      blizzard: false,
    });
    return rthRequired(this.energy, this.distanceHomeM(), this.aircraft.vCruiseMs, drainCruise);
  }

  /** `TIME_WARP`: ×1 → ×2 → ×4 → ×1 (só durante o `RUN`). */
  cycleTimeWarp(): TimeWarp {
    if (this.phase !== 'RUN') {
      this.timeWarp = 1;
      return this.timeWarp;
    }
    this.timeWarp = nextWarp(this.timeWarp);
    return this.timeWarp;
  }

  /** Alvos (`FEATURE_TARGETS`) capturados pelos dados desta e das surtidas anteriores. */
  private evaluateFeatures(): string[] {
    const { camera, focalM } = planEquipment(this.opts.mission.plan, this.opts.catalog);
    const prior = this.opts.mission.lidar;
    const lidar = this.lidar
      ? {
          grid: {
            ...this.lidar.grid,
            pulses: this.lidar.grid.pulses.map((p, i) => p + (prior?.grid.pulses[i] ?? 0)),
          },
          samples: [],
        }
      : prior;
    return capturedFeatures(
      { shots: [...this.opts.mission.shots, ...this.shots], ...(lidar ? { lidar } : {}) },
      this.opts.terrain,
      {
        aoi: this.opts.contract.aoi,
        aircraftKind: this.aircraft.kind,
        sensor: camera,
        focalM,
        rules: {
          sensorKind: camera.kind,
          specularWater: this.rules.coverage.specularWater,
        },
      },
    );
  }

  /** Holofotes, anéis, picos elétricos e a volta do time warp a ×1, a cada passo do `RUN`. */
  private stepFieldElements(dtS: number): void {
    const p = this.pos();
    const zones = this.opts.terrain.zones;
    if (zones.some((z) => z.kind === 'SEARCHLIGHT')) {
      const inside = insideSearchlight(zones, p.u, p.v, this.sortieT);
      const before = this.detection.detected;
      this.detection = stepDetection(this.detection, inside, dtS, this.aircraft.kind === 'BIRD');
      if (!before && this.detection.detected) this.opts.onDetected?.();
    }
    if (this.electric) {
      const push = this.electric.lateralMs(this.sortieT);
      if (push !== 0) this.ac = { ...this.ac, x: this.ac.x + push * dtS };
    }
    const nearby = this.opts.terrain.objectsInRange(p.u - 150, p.u + 150);
    const ground = (u: number, v: number) => this.opts.terrain.elevation(u, v);
    for (const o of nearby) {
      if (o.kind !== 'RING' || this.collectedRings.has(o.id)) continue;
      if (ringCollected(o, { u: p.u, v: p.v, alt: this.ac.alt }, ground)) {
        this.collectedRings.add(o.id);
        this.opts.onRing?.();
      }
    }
    if (this.timeWarp > 1) {
      const rel = nearby.map((o) => {
        const r = toRun(this.frame, o);
        return { solid: o.solid, X: r.x, Z: r.s - this.ac.s };
      });
      const critical = this.alerts().some((a) => a.level === 'critical');
      if (
        shouldResetWarp({
          phase: this.phase,
          solidAhead: solidAheadOf(rel, this.ac.x),
          criticalAlert: critical,
          searchlightM: nearestSearchlightM(zones, p.u, p.v),
        })
      ) {
        this.timeWarp = 1;
      }
    }
  }

  /** Libera os efeitos contínuos (o zumbido do LiDAR) ao sair da tela. */
  dispose(): void {
    if (this.lidar && this.activeSensor === 'LIDAR')
      this.opts.onSensorChange?.('RGB', this.lidar.scanHz);
  }

  /** Abandono imediato (sem dados válidos desta surtida). */
  abort(): void {
    this.endSortie('ABORTED');
  }

  // --- HUD --------------------------------------------------------------------

  alerts(): FlightAlert[] {
    const plan = this.opts.mission.plan;
    const list: FlightAlert[] = [];
    if (this.phase !== 'RUN') return list;
    const minP = Math.max(
      60,
      ...this.opts.contract.requirements.map((r) =>
        r.check.type === 'MIN_FORWARD_OVERLAP' ? r.check.value : 0,
      ),
    );
    const p = this.pRealPct();
    // Queda iminente: AGL < 5 m e descendo, ou casco = 1 (crítico).
    const pos = this.pos();
    const agl = this.ac.alt - this.opts.terrain.elevation(pos.u, pos.v);
    if ((agl < 5 && this.ac.vz < 0) || this.hull === 1) list.push(makeAlert('CRASH_IMMINENT'));
    // Asa fixa no mínimo: o stall não é modelado, a velocidade só fica limitada.
    if (this.aircraft.kind === 'FIXED_WING_VTOL' && this.ac.v <= this.aircraft.vMinMs + 0.05) {
      list.push(makeAlert('MIN_SPEED'));
    }
    if (this.detection.detected) list.push(makeAlert('DETECTED'));
    if (this.rthRecommended()) list.push(makeAlert('RTH'));
    if (isDistracted(this.distraction)) list.push(makeAlert('ATLAS_DISTRACTED'));
    if (windAboveTolerance(this.opts.contract.wind, this.aircraft))
      list.push(makeAlert('WIND_LIMIT'));
    if (p !== null && p < minP) list.push(makeAlert('OVERLAP', Math.round(p)));
    if (this.lastBlur > 1) list.push(makeAlert('MOTION_BLUR'));
    else if (plan.params.lighting === 'GOLDEN_HOUR' && this.lastBlur > 0.5)
      list.push(makeAlert('LOW_LIGHT'));
    if (Math.abs(this.ac.x) > 0.25 * plan.stats.spacingM) list.push(makeAlert('OUT_OF_LANE'));
    if (this.rtk() === 'FLOAT') list.push(makeAlert('RTK_FLOAT'));
    return topAlerts(list);
  }

  pRealPct(): number | null {
    if (this.pRealHistory.length === 0) return null;
    return this.pRealHistory.reduce((a, b) => a + b, 0) / this.pRealHistory.length;
  }

  snapshot(): FlightHudSnapshot {
    const plan = this.opts.mission.plan;
    const pos = aoiPoint(this.frame, this.ac.s, this.ac.x);
    const agl = this.ac.alt - this.opts.terrain.elevation(pos.u, pos.v);
    const gsdCm = gsd(Math.max(0, agl), this.camera.pitchM, this.camera.focalM) * 100;
    const maxGsd = this.opts.contract.requirements.find((r) => r.check.type === 'MAX_GSD_CM');
    const lineNumber = (this.line?.index ?? 0) + 1;
    const drainCruise = drainPerSecond({
      enduranceS: this.aircraft.enduranceS,
      enduranceMod: this.opts.mods.endurance,
      speedMs: this.aircraft.vCruiseMs,
      vCruiseMs: this.aircraft.vCruiseMs,
      windMs: 0,
      climbing: false,
      blizzard: false,
    });
    const snap: FlightHudSnapshot = {
      phase: this.phase,
      aircraftName: this.aircraft.name,
      sensorName:
        this.activeSensor === 'LIDAR' && this.lidar
          ? 'LiDAR'
          : planEquipment(plan, this.opts.catalog).camera.name,
      lineIndex: lineNumber,
      nLines: plan.lines.length,
      lineProgress: clamp(this.ac.s / Math.max(1, this.frame.lengthM), 0, 1),
      crossTrackM: this.ac.x,
      outOfLane: Math.abs(this.ac.x) > 0.25 * plan.stats.spacingM,
      altM: this.ac.alt,
      aglM: agl,
      speedMs: this.ac.v,
      windCrossMs: this.crossWind,
      crabDeg: (crabAngleRad(this.crossWind, Math.max(0.1, this.ac.v)) * 180) / Math.PI,
      timeScale: this.timeWarp,
      energy: this.energy,
      energyUnit: this.aircraft.energyUnit,
      ...(this.aircraft.energyUnit === 'CORN' ? { cornLeft: cornLeft(this.energy) } : {}),
      timeLeftS: this.energy / drainCruise,
      rthAlert: this.phase === 'RUN' && this.rthRecommended(),
      rthConfirm: this.rthConfirming,
      emGlitch: this.em || (this.electric?.at(this.sortieT) ?? null) !== null,
      ...(this.hasSearchlights()
        ? { detectedProgress: detectionProgress(this.detection, this.aircraft.kind === 'BIRD') }
        : {}),
      ...(this.hasRings() ? { rings: this.collectedRings.size } : {}),
      hull: Math.max(0, this.hull),
      hullMax: this.aircraft.hull,
      rtk: this.rtk(),
      activeSensor: this.activeSensor,
      ...this.lidarHud(),
      gsdCm,
      gsdOk: !maxGsd || maxGsd.check.type !== 'MAX_GSD_CM' || gsdCm <= maxGsd.check.value,
      pRealPct: this.pRealPct(),
      qEstPct: plan.params.sideOverlapPct,
      photos: this.opts.shotOffset + this.shots.length,
      photosPlanned: plan.stats.totalPhotos,
      blurPx: this.lastBlur,
      alerts: this.alerts(),
      minimap: {
        lines: plan.lines.map((l) => [l.start, l.end]),
        shots: this.shots.map((s) => ({ u: s.u, v: s.v })),
        pos,
        heading: this.frame.headingRad,
      },
    };
    return snap;
  }

  private hasSearchlights(): boolean {
    return this.opts.terrain.zones.some((z) => z.kind === 'SEARCHLIGHT');
  }

  private hasRings(): boolean {
    return this.rules.flight.rings !== null;
  }

  private lidarHud(): { lidarDensity?: number; groundDensity?: number } {
    if (!this.lidar || this.activeSensor !== 'LIDAR') return {};
    const p = this.pos();
    const agl = this.ac.alt - this.opts.terrain.elevation(p.u, p.v);
    const h = this.lidar.hud(this.ac.v, agl, this.opts.terrain.canopy(p.u, p.v));
    return { lidarDensity: h.density, groundDensity: h.ground };
  }

  private publish(force = false): void {
    if (this.opts.onHud && this.hud.shouldPublish(this.now(), force))
      this.opts.onHud(this.snapshot());
  }

  // --- render -----------------------------------------------------------------

  private flightCamera(): FlightCamera {
    const { width, height } = this.surface ?? { width: 1280, height: 720 };
    let horizon = HORIZON_CRUISE;
    if (this.phase === 'TAKEOFF')
      horizon = lerp(HORIZON_TAKEOFF, HORIZON_CRUISE, clamp(this.phaseT / TAKEOFF_S, 0, 1));
    return makeCamera(width, height, this.camX, this.ac.alt, this.opts.quality(), horizon);
  }

  render(): void {
    PERF.flight.enter(FLIGHT_STAGE.HUD);
    this.publish();
    const surface = this.surface;
    if (!surface) {
      PERF.flight.leave();
      return;
    }
    PERF.flight.enter(FLIGHT_STAGE.SCENE);
    const { ctx, width, height, dpr } = surface;
    this.camX += (this.ac.x - this.camX) * CAM_FOLLOW;
    const cam = this.flightCamera();
    const terrain = this.opts.terrain;
    const frame = this.frame;
    const s0 = this.ac.s;
    const plan = this.opts.mission.plan;
    // Câmera termal: o terreno vira uma rampa de calor e as tocas (`sensorKind: THERMAL`) brilham.
    const thermal = planEquipment(plan, this.opts.catalog).camera.kind === 'THERMAL';
    const hotSpots = thermal ? thermalFeatures(terrain.features) : [];
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shake = shakeOffset(this.shakeS, this.sortieT, this.opts.reduceFlashes());
    ctx.translate(shake.x, shake.y);
    drawSky(ctx, width, height, cam.horizonY, terrain.palette, plan.params.lighting);
    // Fendas: céu em gradiente violeta-ciano e partículas flutuantes (contracts-rifts §1).
    const rift = this.opts.contract.dimension === 'RIFT';
    const calm = this.opts.reduceFlashes();
    if (rift) drawRiftSky(ctx, width, cam.horizonY, this.sortieT, calm);

    const at = (X: number, Z: number) => aoiPoint(frame, s0 + Z, X);
    const objects: SceneObject[] = [];
    for (const o of terrain.objects) {
      const r = toRun(frame, o);
      const Z = r.s - s0;
      if (Z < -20 || Z > cam.zFar) continue;
      const m = motionOffset(o, this.sortieT);
      const X = r.x + m.du * frame.right.u + m.dv * frame.right.v;
      const Zo = Z + m.du * frame.dir.u + m.dv * frame.dir.v;
      // Fora da faixa lateral visível nem entra na cena (a mata do C03 tem 4 mil copas); o fio
      // fica de fora do corte porque a outra ponta pode estar à vista.
      if (
        o.kind !== 'WIRE' &&
        Math.abs(X - cam.camX) - o.widthM / 2 > halfWidthAt(Math.max(Zo, 1), cam)
      ) {
        continue;
      }
      const scene: SceneObject = {
        id: o.id,
        kind: o.kind,
        X,
        Z: Zo,
        widthM: o.widthM,
        depthM: o.depthM,
        heightM: o.heightM,
        baseM: (o.baseM ?? 0) + m.dh,
        color: thermal ? thermalColor(objectHeat(o.kind)) : o.color,
        ...(this.collectedRings.has(o.id) ? { collected: true } : {}),
      };
      if (o.kind === 'WIRE') {
        const r2 = toRun(frame, { u: o.u2 ?? o.u, v: o.v2 ?? o.v });
        scene.X2 = r2.x;
        scene.Z2 = r2.s - s0;
      }
      if (o.kind === 'ENERGY_BEAM') {
        scene.on = isBeamOn(o, this.sortieT);
        // Pulsa 0,5 s antes de ligar.
        const next = o.activePeriod ? isBeamOn(o, this.sortieT + 0.5) : false;
        scene.pulse = !scene.on && next ? 1 : 0;
      }
      objects.push(scene);
    }
    const marks: GroundMark[] = [];
    for (const g of this.opts.mission.groundPoints) {
      const r = toRun(frame, g);
      const Z = r.s - s0;
      if (Z >= 0 && Z <= cam.zFar) marks.push({ id: g.id, kind: g.kind, X: r.x, Z });
    }
    renderTerrain(ctx, {
      cam,
      quality: this.opts.quality(),
      elevation: (X, Z) => {
        const p = at(X, Z);
        return terrain.elevation(p.u, p.v);
      },
      cover: (X, Z) => {
        const p = at(X, Z);
        return terrain.landCover(p.u, p.v);
      },
      // A grade amostra elevação e cobertura juntas: o relevo é avaliado uma vez por ponto.
      sampleGround: (X, Z, out) => {
        const p = at(X, Z);
        out.elev = terrain.elevation(p.u, p.v);
        out.cover = terrain.landCoverAt(p.u, p.v, out.elev);
      },
      palette: terrain.palette,
      lighting: plan.params.lighting,
      sun: sunInRunFrame(plan.params.lighting, frame.dir, frame.right),
      reliefM: this.opts.contract.terrainReliefM,
      specularWater: this.rules.flight.specularWater,
      lavaGlow: this.rules.flight.thermalGlow,
      timeS: this.sortieT,
      objects,
      marks,
      ...(thermal
        ? {
            thermal: {
              heatAt: (X: number, Z: number) => {
                const p = at(X, Z);
                return hotSpotHeat(hotSpots, p.u, p.v);
              },
            },
          }
        : {}),
    });
    PERF.flight.enter(FLIGHT_STAGE.OVERLAYS);
    this.drawFootprints(ctx, cam);
    this.drawSearchlights(ctx, cam);
    this.drawLidar(ctx, cam);
    // Criaturas elétricas: faíscas amarelas sobem do capim durante o pico (nada com `reduceFlashes`).
    if (this.electric && !calm) {
      drawElectricSparks(
        ctx,
        width,
        height,
        cam.horizonY,
        this.electric.at(this.sortieT),
        this.sortieT,
      );
    }
    this.weather?.draw(ctx, this.sortieT);
    if (rift && !calm) drawRiftParticles(ctx, width, height, this.sortieT);
    PERF.flight.enter(FLIGHT_STAGE.SPRITE);
    this.drawAircraftSprite(ctx, cam);
    if (this.sortieT < this.flashUntil) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(0, 0, width, height);
    }
    if (this.phase === 'TURN') {
      // Curva: fade para o escuro e de volta.
      const k = Math.sin(
        clamp(this.phaseT / Math.min(plan.stats.turnTimeS, TURN_PRESENT_MAX_S), 0, 1) * Math.PI,
      );
      ctx.fillStyle = `rgba(2, 6, 23, ${0.6 * k})`;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
    PERF.flight.endFrame();
  }

  /** Manchas dos holofotes no chão: elipses amarelas translúcidas. */
  private drawSearchlights(ctx: CanvasRenderingContext2D, cam: FlightCamera): void {
    for (const z of this.opts.terrain.zones) {
      if (z.kind !== 'SEARCHLIGHT') continue;
      const spot = searchlightSpot(z, this.sortieT);
      const r = toRun(this.frame, { u: spot.u, v: spot.v });
      const c = projectAbs(r.x, this.elevationAt(r.s, r.x), r.s - this.ac.s, cam);
      if (!c) continue;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
      ctx.beginPath();
      ctx.ellipse(
        c.x,
        c.y,
        Math.max(2, spot.r * c.scale),
        Math.max(1, spot.r * c.scale * 0.35),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
  }

  /** Leque de 24 feixes e a nuvem viva (impactos que persistem 1,5 s). */
  private drawLidar(ctx: CanvasRenderingContext2D, cam: FlightCamera): void {
    if (this.activeSensor !== 'LIDAR' || !this.lidar) return;
    const origin = projectAbs(this.ac.x, this.ac.alt, 0, cam);
    const project = (h: LidarHit) => {
      const r = toRun(this.frame, h);
      return projectAbs(r.x, h.z, r.s - this.ac.s, cam);
    };
    // O desvanecimento vai em degraus (LIDAR_FADE_LEVELS): as strings de estilo são prontas e o
    // `fillStyle` só muda quando o estilo muda, em vez de uma string nova por ponto.
    let style = '';
    for (const h of this.lidar.hits) {
      const p = project(h);
      if (!p) continue;
      const level = Math.round(clamp(1 - h.age / 1.5, 0, 1) * LIDAR_FADE_LEVELS);
      const next = (h.ret === 'FIRST' ? LIDAR_FIRST_STYLES : LIDAR_LAST_STYLES)[level] as string;
      if (next !== style) {
        ctx.fillStyle = next;
        style = next;
      }
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    if (!origin) return;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const h of this.fan) {
      const p = project(h);
      if (!p) continue;
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  private drawFootprints(ctx: CanvasRenderingContext2D, cam: FlightCamera): void {
    const terrain = this.opts.terrain;
    this.footprints = this.footprints.filter((f) => this.sortieT - f.bornS < FOOTPRINT_FADE_S);
    for (const f of this.footprints) {
      const alpha = 0.35 * (1 - (this.sortieT - f.bornS) / FOOTPRINT_FADE_S);
      const pts = f.corners.map((c) => {
        const r = toRun(this.frame, c);
        return projectAbs(r.x, terrain.elevation(c.u, c.v), r.s - this.ac.s, cam);
      });
      if (pts.some((p) => p === null)) continue;
      ctx.fillStyle = `rgba(103, 232, 249, ${alpha})`;
      ctx.strokeStyle = `rgba(103, 232, 249, ${Math.min(1, alpha * 2.5)})`;
      ctx.beginPath();
      pts.forEach((p, k) =>
        k === 0 ? ctx.moveTo(p?.x ?? 0, p?.y ?? 0) : ctx.lineTo(p?.x ?? 0, p?.y ?? 0),
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawAircraftSprite(ctx: CanvasRenderingContext2D, cam: FlightCamera): void {
    const ground = this.elevationAt(this.ac.s, this.ac.x);
    const crashed = this.phase === 'CRASHED';
    const pose = crashed ? crashPose(this.phaseT) : null;
    // Na queda, a altitude desce até o chão.
    const alt = pose ? this.crashAlt + (ground + 0.5 - this.crashAlt) * pose.fall : this.ac.alt;
    const shadow = projectAbs(this.ac.x, ground, 0, cam);
    const body = projectAbs(this.ac.x, alt, 0, cam);
    if (!body) return;
    if (shadow) drawGroundShadow(ctx, shadow.x, shadow.y, shadow.scale, alt - ground);
    drawAircraft(ctx, {
      kind: this.aircraft.kind,
      x: body.x,
      y: body.y,
      scale: body.scale,
      timeS: this.sortieT,
      speedMs: this.ac.v,
      bankRad: pose ? pose.spin : (this.input.moveX * 20 * Math.PI) / 180,
      colors: this.opts.colors,
      accessory: this.opts.accessory ?? null,
      alpha: invulnerableAlpha(this.invulnerableS, this.opts.reduceFlashes()),
    });
    if (pose && pose.smoke > 0) {
      ctx.fillStyle = `rgba(100, 116, 139, ${0.5 * (1 - pose.smoke * 0.5)})`;
      for (let k = 0; k < 6; k++) {
        const rise = (k + 1) * 10 * pose.smoke;
        ctx.beginPath();
        ctx.arc(
          body.x + Math.sin(this.sortieT * 3 + k) * 6,
          body.y - rise,
          4 + k * 2 * pose.smoke,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
}
