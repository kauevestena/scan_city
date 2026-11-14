/**
 * Motor de voo 2.5D (survey-flight §3, §5): fases, física da aeronave, câmera RGB,
 * energia, surtida e render (céu, terreno em faixas, pegadas, aeronave). Sem React: o
 * store recebe os eventos pelos callbacks.
 */
import type { Catalog } from '@/data/catalog';
import { drainPerSecond } from '@/domain/energy';
import {
  crabAngleRad,
  initialAircraftState,
  stepAircraft,
  windAt,
  type AircraftState,
  type FlightInput,
} from '@/domain/flightPhysics';
import { gsd } from '@/domain/photogrammetry';
import { planEquipment } from '@/domain/requirements';
import { clamp, lerp } from '@/lib/math';
import type {
  Aircraft,
  AoiPoint,
  Contract,
  MissionData,
  ModifierSet,
  Shot,
  SortieOutcome,
} from '@/types';
import { valueNoise2D } from '@/world/terrain/noise';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import type { CanvasSurface } from '../canvas';
import type { Simulation } from '../loop';
import { drawAircraft, drawGroundShadow, type SpriteColors } from './aircraftSprite';
import { autopilotInput } from './autopilot';
import {
  cameraModel,
  FOOTPRINT_FADE_S,
  footprintCorners,
  inShotWindow,
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
  HORIZON_CRUISE,
  HORIZON_TAKEOFF,
  makeCamera,
  projectAbs,
  type FlightCamera,
  type Quality,
} from './projection';
import { aoiPoint, runFrame, toRun, type RunFrame } from './runFrame';
import { drawSky } from './sky';
import { renderTerrain, sunInRunFrame, type GroundMark, type SceneObject } from './terrainRenderer';

export const TAKEOFF_S = 2.5;
export const LANDING_S = 2;
export const TURN_PRESENT_MAX_S = 2.5;
export const FLASH_S = 0.08;
/** Lote de disparos enviados ao store (§6). */
export const SHOT_BATCH = 10;
/** Suavização do X da câmera por quadro (a 60 FPS). */
const CAM_FOLLOW = 0.1;

export interface SortieResult {
  outcome: SortieOutcome;
  durationS: number;
  completedLines: number[];
  photos: number;
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
  private ended = false;

  constructor(private readonly opts: FlightEngineOptions) {
    const { aircraft } = planEquipment(opts.mission.plan, opts.catalog);
    this.aircraft = aircraft;
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
  }

  setPhase(phase: FlightPhase): void {
    this.phase = phase;
    this.phaseT = 0;
    this.opts.onPhase?.(phase);
  }

  /** Disparo manual (`FIRE`), com cooldown de 0,3 s, em qualquer ponto do *run*. */
  manualShot(): boolean {
    if (this.phase !== 'RUN' || this.manualCooldown > 0) return false;
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
      crabRad: this.aircraft.turnRadiusM > 0 ? crabAngleRad(this.crossWind, this.ac.v) : 0,
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
    this.footprints.push({
      corners: footprintCorners(
        this.frame,
        this.ac.s,
        this.ac.x,
        shot.footprintWM,
        shot.footprintHM,
      ),
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
        targetAlt: this.planAlt,
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
      blizzard: this.opts.contract.specialRules.includes('BLIZZARD_DRAIN'),
    });
    this.energy = Math.max(0, this.energy - rate * dtS);
  }

  update(dtS: number): void {
    if (this.phase === 'POST_FLIGHT') return;
    this.phaseT += dtS;
    this.sortieT += dtS;
    this.manualCooldown = Math.max(0, this.manualCooldown - dtS);
    this.updateWind();
    switch (this.phase) {
      case 'TAKEOFF': {
        const k = clamp(this.phaseT / TAKEOFF_S, 0, 1);
        this.ac = { ...this.ac, alt: lerp(this.startAlt, this.planAlt, k * k * (3 - 2 * k)) };
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
      default:
        break;
    }
    if (this.energy <= 0 && !this.ended && this.phase !== 'LANDING')
      this.endSortie('ENERGY_DEPLETED');
  }

  private stepRun(dtS: number): void {
    const plan = this.opts.mission.plan;
    this.input = this.readInput();
    this.ac = stepAircraft(
      this.ac,
      this.input,
      {
        aircraft: this.aircraft,
        planSpeedMs: plan.params.speedMs,
        ceilingM: this.opts.contract.ceilingM,
        elevationM: this.elevationAt(this.ac.s, this.ac.x),
        crossWindMs: this.crossWind,
        windDriftMod: this.opts.mods.windDrift,
        thermalLiftMs: 0,
        terrainFollowing: plan.params.terrainFollowing,
        elevationAhead: (d) => this.elevationAt(this.ac.s + d, this.ac.x),
      },
      dtS,
    );
    this.drain(dtS);
    const window = inShotWindow(this.ac.s, this.frame, plan.stats.baseM);
    if (this.timer.step(dtS, plan.stats.intervalS, window)) this.fire(false);
    const line = this.line;
    if (line && this.ac.s >= this.frame.aoiEndS + plan.stats.baseM) {
      const inAoi = this.lineShots.some((s) => {
        const r = toRun(this.frame, s);
        return (
          r.s >= this.frame.aoiStartS - plan.stats.baseM &&
          r.s <= this.frame.aoiEndS + plan.stats.baseM
        );
      });
      if (inAoi) this.completedLines.add(line.index);
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
    });
    this.publish(true);
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
      sensorName: planEquipment(plan, this.opts.catalog).camera.name,
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
      timeScale: 1,
      energy: this.energy,
      energyUnit: this.aircraft.energyUnit,
      timeLeftS: this.energy / drainCruise,
      rthAlert: false,
      hull: this.aircraft.hull,
      hullMax: this.aircraft.hull,
      rtk: this.rtk(),
      activeSensor: 'RGB',
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
    this.publish();
    const surface = this.surface;
    if (!surface) return;
    const { ctx, width, height, dpr } = surface;
    this.camX += (this.ac.x - this.camX) * CAM_FOLLOW;
    const cam = this.flightCamera();
    const terrain = this.opts.terrain;
    const frame = this.frame;
    const s0 = this.ac.s;
    const plan = this.opts.mission.plan;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(ctx, width, height, cam.horizonY, terrain.palette, plan.params.lighting);

    const at = (X: number, Z: number) => aoiPoint(frame, s0 + Z, X);
    const objects: SceneObject[] = [];
    for (const o of terrain.objects) {
      const r = toRun(frame, o);
      const Z = r.s - s0;
      if (Z < -20 || Z > cam.zFar) continue;
      objects.push({
        id: o.id,
        kind: o.kind,
        X: r.x,
        Z,
        widthM: o.widthM,
        heightM: o.heightM,
        baseM: o.baseM ?? 0,
        color: o.color,
      });
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
      palette: terrain.palette,
      lighting: plan.params.lighting,
      sun: sunInRunFrame(plan.params.lighting, frame.dir, frame.right),
      reliefM: this.opts.contract.terrainReliefM,
      timeS: this.sortieT,
      objects,
      marks,
    });
    this.drawFootprints(ctx, cam);
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
    const shadow = projectAbs(this.ac.x, ground, 0, cam);
    const body = projectAbs(this.ac.x, this.ac.alt, 0, cam);
    if (!body) return;
    if (shadow) drawGroundShadow(ctx, shadow.x, shadow.y, shadow.scale, this.ac.alt - ground);
    drawAircraft(ctx, {
      kind: this.aircraft.kind,
      x: body.x,
      y: body.y,
      scale: body.scale,
      timeS: this.sortieT,
      speedMs: this.ac.v,
      bankRad: (this.input.moveX * 20 * Math.PI) / 180,
      colors: this.opts.colors,
      accessory: this.opts.accessory ?? null,
    });
  }
}
