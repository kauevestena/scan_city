/**
 * Engine da Mesa Holográfica (holo-table §3, §5): câmera orbital, render `soft3d` da cena,
 * miniaturas nas linhas da melhor missão, *fly-to* e animação de esculpir ao chegar do
 * processamento, e picking dos setores.
 */
import { getAircraft } from '@/data/catalog';
import type { AxisAction } from '@/input/actions';
import { mulberry32 } from '@/lib/rng';
import { COLORS, FONTS, withAlpha } from '@/ui/tokens';
import type { CanvasSurface } from '../canvas';
import { drawAircraft } from '../flight/aircraftSprite';
import type { Simulation } from '../loop';
import { projectPoint } from '../soft3d/mat4';
import { OrbitCamera } from '../soft3d/OrbitCamera';
import { pickSector } from '../soft3d/picking';
import { Soft3DRenderer, type LineSet, type MeshInstance, type PointSet } from '../soft3d/Renderer';
import { normalize } from '../soft3d/vec3';
import { BLOCK_Y, trajectoryAt, type HoloScene, type HoloSector } from './sceneBuilder';

export const FLY_TO_S = 1.2;
export const SCULPT_S = 1.5;
/** Velocidade do orbitar pelo teclado/analógico (rad/s). */
const ORBIT_SPEED = 1.5;
const CLICK_PX = 4;

export interface HoloEngineOptions {
  scene: HoloScene;
  input: { axis(a: AxisAction): number };
  /** Slot a focar na entrada (vindo de "Enviar ao Museu"). */
  focusSlot: number | null;
  onSelect?: (slot: number | null) => void;
  onSculptDone?: () => void;
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
  private surface: CanvasSurface | null = null;
  private timeS = 0;
  selected: number | null = null;
  private sculpt: { slot: number; t: number } | null = null;
  private particles: Particle[] = [];
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private readonly rng = mulberry32(0x401c);

  constructor(private readonly opts: HoloEngineOptions) {
    this.scene = opts.scene;
    this.camera = new OrbitCamera(opts.scene.radius);
    const focus = opts.focusSlot === null ? undefined : this.sectorAt(opts.focusSlot);
    if (focus) {
      this.camera.flyTo(focus.center, FLY_TO_S, 0.9 * opts.scene.radius);
      this.selected = focus.slot;
      if (focus.mapped) this.sculpt = { slot: focus.slot, t: 0 };
    }
  }

  setScene(scene: HoloScene): void {
    this.scene = scene;
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

  pick(x: number, y: number): number | null {
    const s = this.surface;
    if (!s) return null;
    const m = this.camera.matrix(s.width / Math.max(1, s.height));
    const id = pickSector(
      x,
      y,
      this.scene.sectors.map((sec) => ({ id: String(sec.slot), corners: sec.corners })),
      m,
      s.width,
      s.height,
    );
    return id === null ? null : Number(id);
  }

  // --- simulação --------------------------------------------------------------------

  update(dtS: number): void {
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

  render(): void {
    const s = this.surface;
    if (!s) return;
    const { ctx, width, height, dpr } = s;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.bgBase;
    ctx.fillRect(0, 0, width, height);
    const m = this.camera.matrix(width / Math.max(1, height));

    const meshes: MeshInstance[] = [
      { mesh: this.scene.table, background: true },
      { mesh: this.scene.ocean.mesh },
    ];
    const lines: LineSet[] = [this.floorGrid(), this.scene.rim];
    for (const sec of this.scene.sectors) {
      const yScale = this.sculpt?.slot === sec.slot ? Math.max(0.02, this.sculpt.t) : 1;
      meshes.push({ mesh: sec.mesh, yScale, yBase: 0 });
      if (sec.buildings && sec.buildings.quads.length > 0)
        meshes.push({ mesh: sec.buildings, yScale, yBase: 0 });
      if (sec.wire) lines.push(sec.wire);
    }
    const sel = this.selected === null ? undefined : this.sectorAt(this.selected);
    if (sel) lines.push(this.outline(sel));
    const points: PointSet[] = [];
    if (this.particles.length > 0) {
      const pos = new Float32Array(this.particles.length * 3);
      this.particles.forEach((p, k) => pos.set([p.x, p.y, p.z], k * 3));
      points.push({ positions: pos, color: withAlpha(COLORS.radar, 0.9), size: 2 });
    }
    this.renderer.render(ctx, width, height, m, meshes, lines, points, {
      light: normalize([0.5, 1, 0.35]),
    });
    this.drawSprites(ctx, width, height, m);
    ctx.restore();
  }

  /** Grade de chão ciano a 10 % (fundo do modo ORTHO). */
  private floorGrid(): LineSet {
    const r = this.scene.radius * 1.6;
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
    const pos = new Float32Array(sec.corners.flatMap((c) => [c[0], c[1] + 0.005, c[2]]));
    return {
      positions: pos,
      segments: new Uint32Array([0, 1, 1, 2, 2, 3, 3, 0]),
      color: COLORS.radar,
      width: 2,
      glow: withAlpha(COLORS.radar, 0.25),
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
      if (!sec.mapped) {
        // "?" flutuante sobre o gesso.
        const p = projectPoint(
          m,
          sec.center[0],
          0.25 + 0.03 * Math.sin(this.timeS * 2 + sec.slot),
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
      // Miniatura percorrendo a melhor missão.
      const { lengthM, widthM } = sec.contract.aoi;
      const t = trajectoryAt(sec.bestLines, this.timeS);
      const u = Math.min(1, Math.max(0, t.u / lengthM));
      const v = Math.min(1, Math.max(0, t.v / widthM));
      const p = projectPoint(m, sec.x0 + u, sec.topY + 0.1, sec.z0 + v, width, height);
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
        colors: { primary: '#cbd5e1', secondary: '#475569' },
      });
    }
  }
}
