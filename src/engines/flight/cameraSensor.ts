/**
 * Câmera RGB do voo (survey-flight §5.8): disparo automático pelo temporizador, disparo
 * manual com cooldown e o registro de cada `Shot` com as consequências técnicas.
 */
import type { Catalog } from '@/data/catalog';
import {
  exposureTimeS,
  footprint,
  gsd,
  obliqueFootprint,
  motionBlurPx,
  pixelPitchM,
  realForwardOverlap,
  rollingShutterSkewPx,
} from '@/domain/photogrammetry';
import { planEquipment } from '@/domain/requirements';
import type { AoiPoint, FlightPlan, LightingId, RtkStatus, Shot, SpecialZone } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import { aoiPoint, type RunFrame } from './runFrame';

export const MANUAL_COOLDOWN_S = 0.3;
/** Fade da pegada desenhada no chão. */
export const FOOTPRINT_FADE_S = 0.6;

export interface CameraModel {
  pitchM: number;
  focalM: number;
  sensorWidthM: number;
  sensorHeightM: number;
  readoutS?: number;
  exposureS: number;
}

export function cameraModel(plan: FlightPlan, catalog: Catalog): CameraModel {
  const { camera, focalM } = planEquipment(plan, catalog);
  const model: CameraModel = {
    pitchM: pixelPitchM(camera),
    focalM,
    sensorWidthM: camera.sensorWidthMm / 1000,
    sensorHeightM: camera.sensorHeightMm / 1000,
    exposureS: exposureTimeS(plan.params.lighting),
  };
  if (camera.readoutS !== undefined) model.readoutS = camera.readoutS;
  return model;
}

/** Janela de disparo automático da linha: `[aoiStartS − B, aoiEndS + B]`. */
export function inShotWindow(
  s: number,
  frame: Pick<RunFrame, 'aoiStartS' | 'aoiEndS'>,
  baseM: number,
): boolean {
  return s >= frame.aoiStartS - baseM && s <= frame.aoiEndS + baseM;
}

/**
 * Temporizador do disparo automático: acumula `dt` e dispara quando passa de Δt, só dentro
 * da janela, no máximo uma vez por sub-passo. O primeiro disparo da linha sai ao entrar
 * na janela (alinha a série com a base do plano).
 */
export class ShotTimer {
  private acc = 0;
  private started = false;

  reset(): void {
    this.acc = 0;
    this.started = false;
  }

  step(dtS: number, intervalS: number, inWindow: boolean): boolean {
    if (!inWindow) return false;
    if (!this.started) {
      this.started = true;
      this.acc = 0;
      return true;
    }
    this.acc += dtS;
    if (this.acc < intervalS) return false;
    this.acc -= intervalS;
    return true;
  }
}

/** Status RTK (§5.6): FIX com aeronave RTK e kit; FLOAT no cânion urbano; NONE sem RTK. */
export function rtkStatusAt(
  aircraftRtk: boolean,
  ownsRtkKit: boolean,
  zones: readonly SpecialZone[],
  p: AoiPoint,
): RtkStatus {
  if (!aircraftRtk || !ownsRtkKit) return 'NONE';
  const inCanyon = zones.some(
    (z) =>
      z.kind === 'RTK_CANYON' && p.u >= z.uMin && p.u <= z.uMax && p.v >= z.vMin && p.v <= z.vMax,
  );
  return inCanyon ? 'FLOAT' : 'FIX';
}

/** Cantos da pegada no chão (frame da AOI), na ordem de desenho. */
export function footprintCorners(
  frame: RunFrame,
  s: number,
  x: number,
  widthM: number,
  heightM: number,
): AoiPoint[] {
  const hw = widthM / 2;
  const hh = heightM / 2;
  return [
    aoiPoint(frame, s + hh, x - hw),
    aoiPoint(frame, s + hh, x + hw),
    aoiPoint(frame, s - hh, x + hw),
    aoiPoint(frame, s - hh, x - hw),
  ];
}

/**
 * Rolling shutter (§5.8): com movimento lateral, a pegada sai cisalhada — a borda da frente
 * desloca `shearM` (o skew em metros) para o lado. `shearM = 0` devolve os cantos iguais.
 */
export function shearCorners(
  corners: readonly AoiPoint[],
  frame: Pick<RunFrame, 'right'>,
  shearM: number,
): AoiPoint[] {
  // Os dois primeiros cantos são a borda da frente (a "última linha" lida pelo obturador).
  return corners.map((c, i) =>
    i < 2 ? { u: c.u + frame.right.u * shearM, v: c.v + frame.right.v * shearM } : c,
  );
}

/**
 * Pegada oblíqua (domain-math §2.8): trapézio deslocado à frente da aeronave. A borda
 * próxima fica mais perto da câmera (mais estreita); a distante, mais larga.
 */
export function obliqueCorners(
  frame: RunFrame,
  s: number,
  x: number,
  aglM: number,
  tiltDeg: number,
  cam: Pick<CameraModel, 'sensorWidthM' | 'sensorHeightM' | 'focalM'>,
): AoiPoint[] {
  const tilt = (tiltDeg * Math.PI) / 180;
  const vFov = 2 * Math.atan(cam.sensorHeightM / (2 * cam.focalM));
  const o = obliqueFootprint(aglM, tilt, cam.sensorWidthM, cam.focalM, vFov);
  const near = tilt - vFov / 2;
  const far = Math.min(tilt + vFov / 2, (85 * Math.PI) / 180);
  const widthAt = (angle: number) => (aglM / Math.cos(angle)) * (cam.sensorWidthM / cam.focalM);
  const wn = widthAt(near) / 2;
  const wf = widthAt(far) / 2;
  return [
    aoiPoint(frame, s + o.farM, x - wf),
    aoiPoint(frame, s + o.farM, x + wf),
    aoiPoint(frame, s + o.nearM, x + wn),
    aoiPoint(frame, s + o.nearM, x - wn),
  ];
}

/** Fração de água sob a pegada, amostrada numa grade de 5 × 5. */
export function waterFraction(
  terrain: Pick<TerrainSampler, 'landCover'>,
  frame: RunFrame,
  s: number,
  x: number,
  widthM: number,
  heightM: number,
): number {
  let water = 0;
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      const p = aoiPoint(
        frame,
        s + ((a + 0.5) / 5 - 0.5) * heightM,
        x + ((b + 0.5) / 5 - 0.5) * widthM,
      );
      if (terrain.landCover(p.u, p.v) === 'WATER') water++;
    }
  }
  return water / 25;
}

export interface ShotInput {
  index: number;
  tS: number;
  sortie: number;
  lineIndex: number;
  frame: RunFrame;
  s: number;
  x: number;
  altM: number;
  speedMs: number;
  crabRad: number;
  tiltDeg: number;
  lighting: LightingId;
  rtk: RtkStatus;
  manual: boolean;
  camera: CameraModel;
  terrain: Pick<TerrainSampler, 'elevation' | 'landCover'>;
}

/** Registro de um disparo (§5.8). */
export function recordShot(i: ShotInput): Shot {
  const p = aoiPoint(i.frame, i.s, i.x);
  const agl = Math.max(0.1, i.altM - i.terrain.elevation(p.u, p.v));
  const fp = footprint(agl, i.camera.sensorWidthM, i.camera.sensorHeightM, i.camera.focalM);
  const g = gsd(agl, i.camera.pitchM, i.camera.focalM);
  const blurPx = motionBlurPx(i.speedMs, i.camera.exposureS, g);
  return {
    i: i.index,
    t: i.tS,
    sortie: i.sortie,
    lineIndex: i.lineIndex,
    u: p.u,
    v: p.v,
    aglM: agl,
    altM: i.altM,
    speedMs: i.speedMs,
    headingRad: i.frame.headingRad + i.crabRad,
    crabRad: i.crabRad,
    tiltDeg: i.tiltDeg,
    footprintWM: fp.widthM,
    footprintHM: fp.heightM,
    blurPx,
    skewPx: rollingShutterSkewPx(i.speedMs, i.camera.readoutS, g),
    blurred: blurPx > 1,
    lighting: i.lighting,
    rtk: i.rtk,
    manual: i.manual,
    overWater: waterFraction(i.terrain, i.frame, i.s, i.x, fp.widthM, fp.heightM) > 0.5,
    inFog: i.lighting === 'MAGIC_FOG',
  };
}

/** Sobreposição longitudinal real entre dois disparos consecutivos da mesma linha (%). */
export function realOverlapPct(prev: Shot, next: Shot): number {
  const d = Math.hypot(next.u - prev.u, next.v - prev.v);
  return realForwardOverlap(d, next.footprintHM) * 100;
}
