/**
 * Rasterização por software em Canvas 2D (holo-table §5.1): quads com sombreamento flat,
 * painter's algorithm pela profundidade média, backface culling no espaço de tela,
 * linhas e pontos. Os buffers de projeção são reaproveitados entre quadros.
 */
import { quantizedColor } from '@/engines/flight/terrainRenderer';
import type { Mat4 } from './mat4';
import { cross, normalize, sub, type Vec3 } from './vec3';

export interface Mesh {
  /** xyz por vértice. */
  positions: Float32Array;
  /** 4 índices por quad, anti-horário visto de fora. */
  quads: Uint32Array;
  /** rgb (0–255) por quad. */
  colors: Uint8Array;
  /** Normal (mundo) por quad. */
  normals: Float32Array;
  /** Sem luz: cor pura (gesso, oceano). */
  unlit?: boolean;
}

export interface MeshInstance {
  mesh: Mesh;
  /** Escala de Y em torno de `yBase` (animação de esculpir). */
  yScale?: number;
  yBase?: number;
  alpha?: number;
  /**
   * Fundo: desenhado antes de tudo, fora da ordenação. Polígonos grandes (o tampo da mesa)
   * teriam profundidade média menor que a de objetos sobre eles.
   */
  background?: boolean;
}

export interface LineSet {
  /** xyz por vértice. */
  positions: Float32Array;
  /** 2 índices por segmento. */
  segments: Uint32Array;
  color: string;
  width: number;
  /** Traço largo e fraco por baixo (NEON). */
  glow?: string;
}

export interface PointSet {
  positions: Float32Array;
  color: string;
  size: number;
}

/** Monta um mesh calculando a normal de cada quad. */
export function buildMesh(
  positions: Float32Array,
  quads: Uint32Array,
  colors: Uint8Array,
  unlit = false,
): Mesh {
  const normals = new Float32Array((quads.length / 4) * 3);
  const p = (i: number): Vec3 => [
    positions[i * 3] as number,
    positions[i * 3 + 1] as number,
    positions[i * 3 + 2] as number,
  ];
  for (let q = 0; q < quads.length / 4; q++) {
    const a = p(quads[q * 4] as number);
    const b = p(quads[q * 4 + 1] as number);
    const c = p(quads[q * 4 + 2] as number);
    const n = normalize(cross(sub(b, a), sub(c, a)));
    normals.set(n, q * 3);
  }
  return { positions, quads, colors, normals, unlit };
}

export interface RenderOptions {
  light: Vec3;
  ambient?: number;
  diffuse?: number;
}

export interface RenderStats {
  quadsDrawn: number;
  quadsCulled: number;
}

export class Soft3DRenderer {
  private sx = new Float32Array(0);
  private sy = new Float32Array(0);
  private sw = new Float32Array(0);
  private keys = new Float32Array(0);
  private order = new Uint32Array(0);
  private refs = new Uint32Array(0);

  private ensure(vertices: number, quads: number): void {
    if (this.sx.length < vertices) {
      this.sx = new Float32Array(vertices);
      this.sy = new Float32Array(vertices);
      this.sw = new Float32Array(vertices);
    }
    if (this.keys.length < quads) {
      this.keys = new Float32Array(quads);
      this.order = new Uint32Array(quads);
      this.refs = new Uint32Array(quads * 2);
    }
  }

  /** Projeta os vértices de um conjunto para os buffers (a partir de `offset`). */
  private project(
    m: Mat4,
    positions: Float32Array,
    width: number,
    height: number,
    offset: number,
    yScale = 1,
    yBase = 0,
  ): void {
    for (let v = 0; v < positions.length / 3; v++) {
      const x = positions[v * 3] as number;
      const y = yBase + ((positions[v * 3 + 1] as number) - yBase) * yScale;
      const z = positions[v * 3 + 2] as number;
      const cx =
        (m[0] as number) * x + (m[4] as number) * y + (m[8] as number) * z + (m[12] as number);
      const cy =
        (m[1] as number) * x + (m[5] as number) * y + (m[9] as number) * z + (m[13] as number);
      const cw =
        (m[3] as number) * x + (m[7] as number) * y + (m[11] as number) * z + (m[15] as number);
      const iw = cw > 1e-6 ? 1 / cw : 0;
      const k = offset + v;
      this.sx[k] = (cx * iw * 0.5 + 0.5) * width;
      this.sy[k] = (1 - (cy * iw * 0.5 + 0.5)) * height;
      this.sw[k] = cw;
    }
  }

  /** Desenha os meshes (ordenados por profundidade), depois as linhas e os pontos. */
  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    m: Mat4,
    meshes: readonly MeshInstance[],
    lines: readonly LineSet[] = [],
    points: readonly PointSet[] = [],
    opts: RenderOptions = { light: normalize([0.4, 1, 0.3]) },
  ): RenderStats {
    const nVerts = meshes.reduce((s, i) => s + i.mesh.positions.length / 3, 0);
    const nQuads = meshes.reduce((s, i) => s + i.mesh.quads.length / 4, 0);
    this.ensure(nVerts, nQuads);
    let vOff = 0;
    let count = 0;
    let culled = 0;
    const offsets: number[] = [];
    meshes.forEach((inst, mi) => {
      offsets.push(vOff);
      this.project(m, inst.mesh.positions, width, height, vOff, inst.yScale ?? 1, inst.yBase ?? 0);
      const quads = inst.mesh.quads;
      for (let q = 0; q < quads.length / 4; q++) {
        const a = vOff + (quads[q * 4] as number);
        const b = vOff + (quads[q * 4 + 1] as number);
        const c = vOff + (quads[q * 4 + 2] as number);
        const d = vOff + (quads[q * 4 + 3] as number);
        const wa = this.sw[a] as number;
        const wb = this.sw[b] as number;
        const wc = this.sw[c] as number;
        const wd = this.sw[d] as number;
        if (wa <= 1e-6 || wb <= 1e-6 || wc <= 1e-6 || wd <= 1e-6) {
          culled++;
          continue;
        }
        // Área assinada na tela (y para baixo): anti-horário no mundo vira negativo aqui.
        const area =
          ((this.sx[b] as number) - (this.sx[a] as number)) *
            ((this.sy[c] as number) - (this.sy[a] as number)) -
          ((this.sy[b] as number) - (this.sy[a] as number)) *
            ((this.sx[c] as number) - (this.sx[a] as number));
        if (area >= 0) {
          culled++;
          continue;
        }
        this.keys[count] = (wa + wb + wc + wd) / 4;
        this.refs[count * 2] = mi;
        this.refs[count * 2 + 1] = q;
        this.order[count] = count;
        count++;
      }
      vOff += inst.mesh.positions.length / 3;
    });

    const keys = this.keys;
    const refs = this.refs;
    const isBackground = (idx: number) => meshes[refs[idx * 2] as number]?.background === true;
    // Fundo primeiro (na ordem dada); o resto, de longe para perto.
    const order = this.order.subarray(0, count).sort((i, j) => {
      const bi = isBackground(i);
      const bj = isBackground(j);
      if (bi !== bj) return bi ? -1 : 1;
      return (keys[j] as number) - (keys[i] as number);
    });
    const ambient = opts.ambient ?? 0.45;
    const diffuse = opts.diffuse ?? 0.6;
    const [lx, ly, lz] = opts.light;
    for (const idx of order) {
      const mi = this.refs[idx * 2] as number;
      const q = this.refs[idx * 2 + 1] as number;
      const inst = meshes[mi] as MeshInstance;
      const mesh = inst.mesh;
      const off = offsets[mi] as number;
      let k = 1;
      if (!mesh.unlit) {
        const n = mesh.normals;
        k =
          ambient +
          diffuse *
            Math.max(
              0,
              (n[q * 3] as number) * lx +
                (n[q * 3 + 1] as number) * ly +
                (n[q * 3 + 2] as number) * lz,
            );
      }
      const color = quantizedColor(
        (mesh.colors[q * 3] as number) * k,
        (mesh.colors[q * 3 + 1] as number) * k,
        (mesh.colors[q * 3 + 2] as number) * k,
      );
      ctx.globalAlpha = inst.alpha ?? 1;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let c = 0; c < 4; c++) {
        const v = off + (mesh.quads[q * 4 + c] as number);
        if (c === 0) ctx.moveTo(this.sx[v] as number, this.sy[v] as number);
        else ctx.lineTo(this.sx[v] as number, this.sy[v] as number);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const set of lines) {
      this.ensure(set.positions.length / 3, 0);
      this.project(m, set.positions, width, height, 0);
      const strokes: Array<[string, number]> = set.glow
        ? [
            [set.glow, set.width * 3],
            [set.color, set.width],
          ]
        : [[set.color, set.width]];
      for (const [color, w] of strokes) {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        for (let s = 0; s < set.segments.length / 2; s++) {
          const a = set.segments[s * 2] as number;
          const b = set.segments[s * 2 + 1] as number;
          if ((this.sw[a] as number) <= 1e-6 || (this.sw[b] as number) <= 1e-6) continue;
          ctx.moveTo(this.sx[a] as number, this.sy[a] as number);
          ctx.lineTo(this.sx[b] as number, this.sy[b] as number);
        }
        ctx.stroke();
      }
    }
    for (const set of points) {
      this.ensure(set.positions.length / 3, 0);
      this.project(m, set.positions, width, height, 0);
      ctx.fillStyle = set.color;
      for (let v = 0; v < set.positions.length / 3; v++) {
        if ((this.sw[v] as number) <= 1e-6) continue;
        ctx.fillRect(
          (this.sx[v] as number) - set.size / 2,
          (this.sy[v] as number) - set.size / 2,
          set.size,
          set.size,
        );
      }
    }
    return { quadsDrawn: count, quadsCulled: culled };
  }
}
