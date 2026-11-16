/**
 * Laço do Laboratório: guarda os valores desenhados, que perseguem os dos sliders em ~150 ms
 * (infographic-lab §5.2), e chama o renderer do painel aberto a cada quadro. As leituras do
 * diagrama saem do domínio, com os valores já interpolados; as da coluna lateral, com os alvos.
 */
import type { CanvasSurface } from '@/engines/canvas';
import { renderOptics } from '@/engines/lab/opticsRenderer';
import { renderStereo } from '@/engines/lab/stereoRenderer';
import { approach } from '@/engines/lab/tween';
import type { Simulation } from '@/engines/loop';
import { opticsLabels, stereoLabels } from './labels';
import { opticsReadings, stereoReadings, type OpticsInput, type StereoInput } from './readings';

export type LabPanelId = 'OPTICS' | 'STEREO';

/** O que a tela quer mostrar agora (os alvos). */
export interface LabTargets {
  panel: LabPanelId;
  optics: OpticsInput;
  stereo: StereoInput;
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

  constructor(
    private readonly surface: CanvasSurface,
    private readonly targets: () => LabTargets,
  ) {
    const t = targets();
    this.optics = { ...t.optics };
    this.stereo = { ...t.stereo };
  }

  /** Os valores que o diagrama desenha agora (já interpolados). */
  get shown(): { optics: OpticsInput; stereo: StereoInput } {
    return { optics: this.optics, stereo: this.stereo };
  }

  update(dtS: number): void {
    this.timeS += dtS;
    const t = this.targets();
    this.optics = approachAll(this.optics, t.optics, dtS);
    this.stereo = approachAll(this.stereo, t.stereo, dtS);
  }

  render(): void {
    const { ctx, width, height, dpr } = this.surface;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.targets().panel === 'OPTICS') {
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
    } else {
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
    }
    ctx.restore();
  }
}
