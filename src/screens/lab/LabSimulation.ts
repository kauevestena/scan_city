/**
 * Laço do Laboratório: guarda os valores desenhados, que perseguem os dos sliders em ~150 ms
 * (infographic-lab §5.2), e chama o renderer do painel aberto a cada quadro. As leituras do
 * diagrama saem do domínio, com os valores já interpolados; as da coluna lateral, com os alvos.
 */
import type { CanvasSurface } from '@/engines/canvas';
import { renderCanopy } from '@/engines/lab/canopyRenderer';
import { renderOptics } from '@/engines/lab/opticsRenderer';
import { renderShutter } from '@/engines/lab/shutterRenderer';
import { renderStereo } from '@/engines/lab/stereoRenderer';
import { approach } from '@/engines/lab/tween';
import type { Simulation } from '@/engines/loop';
import { degToRad } from '@/lib/math';
import { canopyLabels, opticsLabels, shutterLabels, stereoLabels } from './labels';
import {
  canopyReadings,
  opticsReadings,
  shutterReadings,
  stereoReadings,
  type CanopyInput,
  type OpticsInput,
  type ShutterInput,
  type StereoInput,
} from './readings';

export type LabPanelId = 'OPTICS' | 'STEREO' | 'CANOPY' | 'SHUTTER';

/** O que a tela quer mostrar agora (os alvos). */
export interface LabTargets {
  panel: LabPanelId;
  optics: OpticsInput;
  stereo: StereoInput;
  canopy: CanopyInput;
  shutter: ShutterInput;
}

/** Aproxima cada campo numérico de `shown` do de `target`, dentro do tempo `dtS`. */
export function approachAll<T extends object>(shown: T, target: T, dtS: number): T {
  const out = { ...shown };
  for (const key of Object.keys(target) as Array<keyof T>) {
    const to = target[key];
    const from = shown[key];
    if (typeof to === 'number' && typeof from === 'number') {
      out[key] = approach(from, to, dtS) as T[keyof T];
    }
  }
  return out;
}

export class LabSimulation implements Simulation {
  private timeS = 0;
  private optics: OpticsInput;
  private stereo: StereoInput;
  private canopy: CanopyInput;
  private shutter: ShutterInput;

  constructor(
    private readonly surface: CanvasSurface,
    private readonly targets: () => LabTargets,
  ) {
    const t = targets();
    this.optics = { ...t.optics };
    this.stereo = { ...t.stereo };
    this.canopy = { ...t.canopy };
    this.shutter = { ...t.shutter };
  }

  /** Os valores que o diagrama desenha agora (já interpolados). */
  get shown(): {
    optics: OpticsInput;
    stereo: StereoInput;
    canopy: CanopyInput;
    shutter: ShutterInput;
  } {
    return { optics: this.optics, stereo: this.stereo, canopy: this.canopy, shutter: this.shutter };
  }

  update(dtS: number): void {
    this.timeS += dtS;
    const t = this.targets();
    this.optics = approachAll(this.optics, t.optics, dtS);
    this.stereo = approachAll(this.stereo, t.stereo, dtS);
    this.canopy = approachAll(this.canopy, t.canopy, dtS);
    // O `global` é um interruptor: troca na hora, sem interpolar.
    this.shutter = { ...approachAll(this.shutter, t.shutter, dtS), global: t.shutter.global };
  }

  render(): void {
    const { ctx, width, height, dpr } = this.surface;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const panel = this.targets().panel;
    if (panel === 'OPTICS') {
      const r = opticsReadings(this.optics);
      renderOptics(
        ctx,
        {
          width,
          height,
          heightM: this.optics.heightM,
          focalMm: this.optics.focalMm,
          sensorWidthMm: this.optics.sensorWidthMm,
          halfFovRad: r.fovRad / 2,
          gsdM: r.gsdM,
          labels: opticsLabels(this.optics, r),
        },
        this.timeS,
      );
    } else if (panel === 'STEREO') {
      const r = stereoReadings(this.stereo);
      renderStereo(
        ctx,
        {
          width,
          height,
          baseM: this.stereo.baseM,
          heightM: this.stereo.heightM,
          objectM: this.stereo.objectM,
          photoBaseMm: r.photoBaseM * 1000,
          parallaxDiffMm: r.parallaxDiffM * 1000,
          labels: stereoLabels(this.stereo, r),
        },
        this.timeS,
      );
    } else if (panel === 'CANOPY') {
      const r = canopyReadings(this.canopy);
      renderCanopy(
        ctx,
        {
          width,
          height,
          canopy: this.canopy.canopyPct / 100,
          maxReturns: Math.round(this.canopy.maxReturns),
          closedGroundProbability: r.closedGroundProbability,
          photoVisibility: r.photoVisibility,
          labels: canopyLabels(),
        },
        this.timeS,
      );
    } else {
      const r = shutterReadings(this.shutter);
      renderShutter(
        ctx,
        {
          width,
          height,
          speedMs: this.shutter.speedMs,
          readoutS: this.shutter.readoutMs / 1000,
          spinRadS: degToRad(this.shutter.spinDegS),
          gsdM: this.shutter.gsdCm / 100,
          global: this.shutter.global,
          labels: shutterLabels(this.shutter, r),
        },
        this.timeS,
      );
    }
    ctx.restore();
  }
}
