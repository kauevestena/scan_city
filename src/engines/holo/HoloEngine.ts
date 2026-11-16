/**
 * Engine da Mesa Holográfica (holo-table §3, §5): câmera orbital, render `soft3d` da cena nos três
 * modos (ortofoto, hipsometria, LiDAR neon), as duas dimensões (grade Real e anel do Multiverso),
 * miniaturas nas linhas da melhor missão, *fly-to* e animação de esculpir ao chegar do
 * processamento, picking dos setores e a queda automática de qualidade.
 */
import { getAircraft } from '@/data/catalog';
import type { AxisAction } from '@/input/actions';
import { pickNeighbor, type NavDirection } from '@/input/spatial';
import { mulberry32 } from '@/lib/rng';
import { COLORS, FONTS, withAlpha } from '@/ui/tokens';
import type { CanvasSurface } from '../canvas';
import { drawAircraft } from '../flight/aircraftSprite';
import type { Simulation } from '../loop';
import { HOLO_STAGE, PERF } from '../perf';
import { projectPoint } from '../soft3d/mat4';
import { OrbitCamera } from '../soft3d/OrbitCamera';
import { pickSector } from '../soft3d/picking';
import { Soft3DRenderer, type LineSet, type MeshInstance, type PointSet } from '../soft3d/Renderer';
import { normalize } from '../soft3d/vec3';
import { QualityGovernor } from './qualityGovernor';
import {
  BLOCK_Y,
  BOB_AMPLITUDE,
  CUBE_SIZE,
  oceanWaves,
  trajectoryAt,
  wireCube,
  type HoloScene,
  type HoloSector,
} from './sceneBuilder';

/** Distância da câmera na visão geral: a grade Real cabe em 1,8 raios; o anel pede 2,2. */
export function overviewDistance(scene: HoloScene): number {
  return (scene.dimension === 'RIFT' ? 2.2 : 1.8) * scene.radius;
}

export const FLY_TO_S = 1.2;
export const SCULPT_S = 1.5;
/** Duração do voo da câmera ao trocar de dimensão. */
export const DIMENSION_FLY_S = 0.8;
/** Distância da câmera ao focar um setor ou diorama (unidades da mesa). */
export const FOCUS_DISTANCE = 2.4;
/** Velocidade do orbitar pelo teclado/analógico (rad/s). */
const ORBIT_SPEED = 1.5;
const CLICK_PX = 4;
const BACKGROUND = '#000000';
const SPOT_ALPHA = 0.13;

export interface HoloEngineOptions {
  scene: HoloScene;
  input: { axis(a: AxisAction): number };
  /** Slot a focar na entrada (vindo de "Enviar ao Museu"), na ala da cena. */
  focusSlot: number | null;
  onSelect?: (slot: number | null) => void;
  onSculptDone?: () => void;
  /** O FPS médio ficou abaixo de 50 por 3 s: a tela baixa a qualidade da mesa (§5.7). */
  onLowFps?: () => void;
  /** Pintura equipada nos drones; a ave (Atlas) mantém as cores do pombo. */
  droneColors?: () => { primary: string; secondary: string };
  /** Relógio em ms (padrão: `performance.now`), injetável nos testes. */
  now?: () => number;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vy: number;
  life: number;
}

export class HoloEngine implements Simulation {
  readonly camera: OrbitCamera;
  private scene: HoloScene;
  private readonly renderer = new Soft3DRenderer();
  private readonly governor = new QualityGovernor();
  private lowFps: (() => void) | undefined;
  private lastFrameMs: number | null = null;
  private surface: CanvasSurface | null = null;
  private floor: LineSet;
  private timeS = 0;
  selected: number | null = null;
  private sculpt: { slot: number; t: number } | null = null;
  private particles: Particle[] = [];
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private readonly rng = mulberry32(0x401c);

  constructor(private readonly opts: HoloEngineOptions) {
    this.scene = opts.scene;
    this.lowFps = opts.onLowFps;
    this.floor = this.floorGrid(opts.scene.radius);
    this.camera = new OrbitCamera(opts.scene.radius);
    this.camera.distance = overviewDistance(opts.scene);
    const focus = opts.focusSlot === null ? undefined : this.sectorAt(opts.focusSlot);
    if (focus) {
      this.camera.flyTo(focus.center, FLY_TO_S, FOCUS_DISTANCE);
      this.selected = focus.slot;
      if (focus.mapped) this.sculpt = { slot: focus.slot, t: 0 };
    }
  }

  /** Troca o ouvinte de FPS baixo (a tela o renova num efeito, com o nível de qualidade atual). */
  setLowFpsHandler(handler: (() => void) | undefined): void {
    this.lowFps = handler;
  }

  /**
   * Troca a cena (modo, qualidade, destaque, dimensão). Mudando de dimensão, o raio da mesa muda:
   * a câmera se reajusta e voa de volta ao centro.
   */
  setScene(scene: HoloScene): void {
    const dimensionChanged = scene.dimension !== this.scene.dimension;
    this.scene = scene;
    this.governor.reset();
    this.lastFrameMs = null;
    if (scene.radius !== this.floorRadius) this.floor = this.floorGrid(scene.radius);
    if (dimensionChanged) {
      this.camera.setRadius(scene.radius);
      this.camera.flyTo([0, 0, 0], DIMENSION_FLY_S, overviewDistance(scene));
      this.sculpt = null;
      this.particles = [];
    }
  }

  attach(surface: CanvasSurface): void {
    this.surface = surface;
  }

  sectorAt(slot: number): HoloSector | undefined {
    return this.scene.sectors.find((s) => s.slot === slot);
  }

  get sculpting(): boolean {
    return this.sculpt !== null;
  }

  /** Oscilação vertical do diorama: `0,05·sin(t + i)` (holo-table §5.2). */
  bob(sec: HoloSector): number {
    return sec.floating ? BOB_AMPLITUDE * Math.sin(this.timeS + sec.slot) : 0;
  }

  /** Elevação do setor: a estática (pedestal ou flutuação) mais a oscilação. */
  private offsetOf(sec: HoloSector): number {
    return sec.hover + this.bob(sec);
  }

  // --- entrada -------------------------------------------------------------------

  pointerDown(x: number, y: number): void {
    this.drag = { x, y, moved: false };
  }

  pointerMove(x: number, y: number): void {
    if (!this.drag) return;
    const dx = x - this.drag.x;
    const dy = y - this.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > CLICK_PX) this.drag.moved = true;
    if (this.drag.moved) this.camera.orbit(-dx * 0.008, dy * 0.006);
    this.drag = { ...this.drag, x, y };
  }

  pointerUp(x: number, y: number): void {
    const wasClick = this.drag && !this.drag.moved;
    this.drag = null;
    if (wasClick) this.select(this.pick(x, y));
  }

  wheel(deltaY: number): void {
    this.camera.zoom(deltaY > 0 ? 1.1 : 1 / 1.1);
  }

  select(slot: number | null): void {
    this.selected = slot;
    this.opts.onSelect?.(slot);
  }

  /** Seleciona o setor e leva a câmera até ele (as linhas do painel de alas). */
  focus(slot: number): void {
    const sec = this.sectorAt(slot);
    if (!sec) return;
    this.select(slot);
    this.camera.flyTo(sec.center, FLY_TO_S, FOCUS_DISTANCE);
  }

  pick(x: number, y: number): number | null {
    const s = this.surface;
    if (!s) return null;
    const m = this.camera.matrix(s.width / Math.max(1, s.height));
    const id = pickSector(
      x,
      y,
      this.scene.sectors.map((sec) => {
        const bob = this.bob(sec);
        return {
          id: String(sec.slot),
          corners: bob === 0 ? sec.corners : sec.corners.map((c) => [c[0], c[1] + bob, c[2]]),
        };
      }),
      m,
      s.width,
      s.height,
    );
    return id === null ? null : Number(id);
  }

  /**
   * Move a seleção ao setor mais próximo na direção da tela (analógico esquerdo/D-pad, §5.6):
   * navegação espacial pelos centros projetados. Sem seleção, escolhe o mais central.
   */
  moveSelection(dir: NavDirection): number | null {
    const s = this.surface;
    if (!s) return this.selected;
    const m = this.camera.matrix(s.width / Math.max(1, s.height));
    const centers = this.scene.sectors
      .map((sec) => {
        const p = projectPoint(
          m,
          sec.center[0],
          sec.center[1] + this.bob(sec),
          sec.center[2],
          s.width,
          s.height,
        );
        return { slot: sec.slot, x: p.x, y: p.y, w: p.w };
      })
      .filter((c) => c.w > 0);
    if (centers.length === 0) return this.selected;
    const current =
      this.selected === null ? undefined : centers.find((c) => c.slot === this.selected);
    if (!current) {
      let best = centers[0] as (typeof centers)[number];
      for (const c of centers) {
        const d = Math.hypot(c.x - s.width / 2, c.y - s.height / 2);
        if (d < Math.hypot(best.x - s.width / 2, best.y - s.height / 2)) best = c;
      }
      this.select(best.slot);
      return best.slot;
    }
    const others = centers.filter((c) => c !== current);
    const rect = (c: { x: number; y: number }) => ({ left: c.x, top: c.y, width: 0, height: 0 });
    const idx = pickNeighbor(rect(current), others.map(rect), dir);
    const next = others[idx];
    if (next) this.select(next.slot);
    return this.selected;
  }

  // --- simulação --------------------------------------------------------------------

  update(dtS: number): void {
    PERF.holo.enter(HOLO_STAGE.UPDATE);
    this.step(dtS);
    PERF.holo.leave();
  }

  private step(dtS: number): void {
    this.timeS += dtS;
    const lx = this.opts.input.axis('LOOK_X');
    const ly = this.opts.input.axis('LOOK_Y');
    if (lx !== 0 || ly !== 0)
      this.camera.orbit(-lx * ORBIT_SPEED * dtS, -ly * ORBIT_SPEED * dtS * 0.6);
    const z = this.opts.input.axis('ZOOM');
    if (z !== 0) this.camera.zoom(1 - z * dtS);
    this.camera.update(dtS, this.drag?.moved ?? false);

    if (this.sculpt) {
      this.sculpt.t += dtS / SCULPT_S;
      const sec = this.sectorAt(this.sculpt.slot);
      if (sec && this.particles.length < 120) {
        for (let k = 0; k < 3; k++) {
          this.particles.push({
            x: sec.x0 + this.rng.next(),
            y: BLOCK_Y + sec.topY * this.sculpt.t * this.rng.next(),
            z: sec.z0 + this.rng.next(),
            vy: 0.2 + 0.3 * this.rng.next(),
            life: 1,
          });
        }
      }
      if (this.sculpt.t >= 1) {
        this.sculpt = null;
        this.opts.onSculptDone?.();
      }
    }
    this.particles = this.particles
      .map((p) => ({ ...p, y: p.y + p.vy * dtS, life: p.life - dtS }))
      .filter((p) => p.life > 0);
  }

  /**
   * Mede o FPS real entre desenhos: o `GameLoop` divide cada quadro em sub-passos de `update`,
   * então só o `render` (uma vez por quadro) enxerga a taxa de verdade.
   */
  private trackFrameRate(): void {
    const nowMs = this.opts.now ? this.opts.now() : performance.now();
    if (this.lastFrameMs !== null && this.governor.sample((nowMs - this.lastFrameMs) / 1000)) {
      this.lowFps?.();
    }
    this.lastFrameMs = nowMs;
  }

  render(): void {
    const s = this.surface;
    if (!s) return;
    PERF.holo.enter(HOLO_STAGE.SCENE);
    this.trackFrameRate();
    const { ctx, width, height, dpr } = s;
    const neon = this.scene.mode === 'NEON';
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = neon ? BACKGROUND : COLORS.bgBase;
    ctx.fillRect(0, 0, width, height);
    const m = this.camera.matrix(width / Math.max(1, height));

    const meshes: MeshInstance[] = [{ mesh: this.scene.table, background: true }];
    // O fundo do NEON é preto puro: sem grade de chão.
    const lines: LineSet[] = neon ? [this.scene.rim] : [this.floor, this.scene.rim];
    const points: PointSet[] = [];
    const ocean = this.scene.ocean;
    if (ocean) {
      if (ocean.mesh.quads.length > 0) meshes.push({ mesh: ocean.mesh });
      lines.push(oceanWaves(ocean.x0, ocean.z0, this.timeS));
    }
    for (const sec of this.scene.sectors) {
      const yOffset = this.offsetOf(sec);
      const sculpting = this.sculpt?.slot === sec.slot;
      const yScale = sculpting ? Math.max(0.02, this.sculpt?.t ?? 1) : 1;
      if (sec.pedestal) meshes.push({ mesh: sec.pedestal });
      if (sec.mesh.quads.length > 0) meshes.push({ mesh: sec.mesh, yScale, yBase: 0, yOffset });
      if (sec.buildings && sec.buildings.quads.length > 0) {
        meshes.push({
          mesh: sec.buildings,
          yScale,
          yBase: 0,
          yOffset,
          alpha: sec.buildingsAlpha ?? 1,
        });
      }
      if (sec.spot) meshes.push({ mesh: sec.spot, alpha: SPOT_ALPHA });
      if (sec.wire) lines.push({ ...sec.wire, yOffset });
      for (const overlay of sec.overlays ?? [])
        lines.push({ ...overlay, yScale, yBase: 0, yOffset });
      if (sec.points) points.push({ ...sec.points, yScale, yBase: 0, yOffset });
      if (sec.rim) lines.push({ ...sec.rim, yOffset });
      if (sec.cube) {
        lines.push(
          wireCube(
            [sec.x0 + 0.5, yOffset + 0.1 + CUBE_SIZE / 2, sec.z0 + 0.5],
            CUBE_SIZE,
            this.timeS * 0.5 + sec.slot,
            withAlpha(COLORS.rift, 0.95),
            withAlpha(COLORS.rift, 0.25),
          ),
        );
      }
    }
    const sel = this.selected === null ? undefined : this.sectorAt(this.selected);
    if (sel) lines.push(this.outline(sel));
    if (this.particles.length > 0) {
      const pos = new Float32Array(this.particles.length * 3);
      this.particles.forEach((p, k) => pos.set([p.x, p.y, p.z], k * 3));
      const sculptSec = this.sculpt ? this.sectorAt(this.sculpt.slot) : undefined;
      points.push({
        positions: pos,
        color: withAlpha(COLORS.radar, 0.9),
        size: 2,
        yOffset: sculptSec ? this.offsetOf(sculptSec) : 0,
      });
    }
    PERF.holo.enter(HOLO_STAGE.RASTER);
    this.renderer.render(ctx, width, height, m, meshes, lines, points, {
      light: normalize([0.5, 1, 0.35]),
    });
    PERF.holo.enter(HOLO_STAGE.SPRITES);
    this.drawSprites(ctx, width, height, m);
    ctx.restore();
    PERF.holo.endFrame();
  }

  private floorRadius = 0;

  /** Grade de chão ciano a 10 % (fundo dos modos ORTHO e HYPSO). */
  private floorGrid(radius: number): LineSet {
    this.floorRadius = radius;
    const r = radius * 1.6;
    const pos: number[] = [];
    const seg: number[] = [];
    for (let k = -8; k <= 8; k++) {
      const t = (k / 8) * r;
      const i = pos.length / 3;
      pos.push(t, -0.05, -r, t, -0.05, r, -r, -0.05, t, r, -0.05, t);
      seg.push(i, i + 1, i + 2, i + 3);
    }
    return {
      positions: new Float32Array(pos),
      segments: new Uint32Array(seg),
      color: withAlpha(COLORS.radar, 0.1),
      width: 1,
    };
  }

  private outline(sec: HoloSector): LineSet {
    const y = sec.topY + 0.005;
    const pos = new Float32Array(sec.corners.flatMap((c) => [c[0], y, c[2]]));
    return {
      positions: pos,
      segments: new Uint32Array([0, 1, 1, 2, 2, 3, 3, 0]),
      color: COLORS.radar,
      width: 2,
      glow: withAlpha(COLORS.radar, 0.25),
      yOffset: this.offsetOf(sec),
    };
  }

  private drawSprites(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    m: Float32Array,
  ): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const sec of this.scene.sectors) {
      const offset = this.offsetOf(sec);
      if (!sec.mapped) {
        // O diorama em névoa é o cubo violeta; o setor em gesso ganha um "?" flutuante.
        if (sec.cube) continue;
        const p = projectPoint(
          m,
          sec.center[0],
          0.25 + 0.03 * Math.sin(this.timeS * 2 + sec.slot) + offset,
          sec.center[2],
          width,
          height,
        );
        if (p.w <= 0) continue;
        ctx.font = `bold ${Math.max(12, 120 / p.w)}px ${FONTS.sans}`;
        ctx.fillStyle = withAlpha(COLORS.radar, 0.85);
        ctx.fillText('?', p.x, p.y);
        continue;
      }
      if (!sec.bestLines || !sec.contract || this.sculpt?.slot === sec.slot) continue;
      // Miniatura (pombo, drone ou asa, conforme a aeronave) percorrendo a melhor missão.
      const { lengthM, widthM } = sec.contract.aoi;
      const t = trajectoryAt(sec.bestLines, this.timeS);
      const u = Math.min(1, Math.max(0, t.u / lengthM));
      const v = Math.min(1, Math.max(0, t.v / widthM));
      const p = projectPoint(m, sec.x0 + u, sec.topY + 0.1 + offset, sec.z0 + v, width, height);
      if (p.w <= 0) continue;
      const kind = sec.bestAircraftId ? getAircraft(sec.bestAircraftId).kind : 'BIRD';
      drawAircraft(ctx, {
        kind,
        x: p.x,
        y: p.y,
        scale: 1,
        unitPx: Math.max(3, 18 / p.w),
        timeS: this.timeS,
        speedMs: 10,
        bankRad: 0,
        colors:
          kind === 'BIRD' || !this.opts.droneColors
            ? { primary: '#cbd5e1', secondary: '#475569' }
            : this.opts.droneColors(),
      });
    }
  }
}
