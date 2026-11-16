/**
 * Rasterização por software em Canvas 2D (holo-table §5.1): quads com sombreamento flat,
 * painter's algorithm pela profundidade média, backface culling no espaço de tela,
 * linhas e pontos. Os buffers de projeção são reaproveitados entre quadros.
 */
import { quantizedColor } from '@/engines/flight/terrainRenderer';
import type { Mat4 } from './mat4';
import { cross, normalize, sub, type Vec3 } from './vec3';

/** Passos de profundidade por unidade e faixa de índices da chave empacotada (ver `render`). */
const DEPTH_STEPS = 4096;
const INDEX_RANGE = 1 << 20;
const SEAM_PX = 0.45;

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
  /** Deslocamento vertical somado depois da escala (oscilação dos dioramas, pedestal). */
  yOffset?: number;
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
  /** Escala de Y em torno de `yBase` (animação de esculpir) e deslocamento vertical (mundo). */
  yScale?: number;
  yBase?: number;
  yOffset?: number;
}

export interface PointSet {
  positions: Float32Array;
  color: string;
  size: number;
  /** Escala de Y em torno de `yBase` (animação de esculpir) e deslocamento vertical (mundo). */
  yScale?: number;
  yBase?: number;
  yOffset?: number;
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
  /** Chave de ordenação e índice do quad empacotados num único double (ver `render`). */
  private packed = new Float64Array(0);
  /** Quads de fundo, na ordem em que foram coletados. */
  private background = new Uint32Array(0);
  private refs = new Uint32Array(0);

  private ensure(vertices: number, quads: number): void {
    if (this.sx.length < vertices) {
      this.sx = new Float32Array(vertices);
      this.sy = new Float32Array(vertices);
      this.sw = new Float32Array(vertices);
    }
    if (this.refs.length < quads * 2) {
      this.packed = new Float64Array(quads);
      this.background = new Uint32Array(quads);
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
    yOffset = 0,
  ): void {
    for (let v = 0; v < positions.length / 3; v++) {
      const x = positions[v * 3] as number;
      const y = yOffset + yBase + ((positions[v * 3 + 1] as number) - yBase) * yScale;
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
    let sorted = 0;
    let bgCount = 0;
    let culled = 0;
    const offsets: number[] = [];
    meshes.forEach((inst, mi) => {
      offsets.push(vOff);
      this.project(
        m,
        inst.mesh.positions,
        width,
        height,
        vOff,
        inst.yScale ?? 1,
        inst.yBase ?? 0,
        inst.yOffset ?? 0,
      );
      const quads = inst.mesh.quads;
      const isBackground = inst.background === true;
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
        this.refs[count * 2] = mi;
        this.refs[count * 2 + 1] = q;
        if (isBackground) {
          this.background[bgCount++] = count;
        } else {
          // Chave (profundidade média, em 1/4096) · 2²⁰ + índice: um `Float64Array.sort()` nativo,
          // sem comparador, ordena pela profundidade e desempata pela ordem de coleta.
          const depth = Math.round(((wa + wb + wc + wd) / 4) * DEPTH_STEPS);
          this.packed[sorted++] = depth * INDEX_RANGE + count;
        }
        count++;
      }
      vOff += inst.mesh.positions.length / 3;
    });

    // Fundo primeiro (na ordem dada); o resto, de longe para perto (o fim do vetor ordenado).
    const far = this.packed.subarray(0, sorted).sort();
    const ambient = opts.ambient ?? 0.45;
    const diffuse = opts.diffuse ?? 0.6;
    const [lx, ly, lz] = opts.light;
    // Quads seguidos da mesma cor (opacos) viram um só caminho, com um `fill` e um `stroke`: a
    // ordem de pintura não muda e o custo por quad cai (o terreno é cheio de runs de uma cor).
    ctx.lineWidth = 0.6;
    let runColor = '';
    let runOpen = false;
    let currentAlpha = -1;
    const flush = () => {
      if (!runOpen) return;
      ctx.fill();
      runOpen = false;
    };
    for (let n = 0; n < count; n++) {
      const idx =
        n < bgCount
          ? (this.background[n] as number)
          : (far[sorted - 1 - (n - bgCount)] as number) % INDEX_RANGE;
      const mi = this.refs[idx * 2] as number;
      const q = this.refs[idx * 2 + 1] as number;
      const inst = meshes[mi] as MeshInstance;
      const mesh = inst.mesh;
      const off = offsets[mi] as number;
      let k = 1;
      if (!mesh.unlit) {
        const nm = mesh.normals;
        k =
          ambient +
          diffuse *
            Math.max(
              0,
              (nm[q * 3] as number) * lx +
                (nm[q * 3 + 1] as number) * ly +
                (nm[q * 3 + 2] as number) * lz,
            );
      }
      const color = quantizedColor(
        (mesh.colors[q * 3] as number) * k,
        (mesh.colors[q * 3 + 1] as number) * k,
        (mesh.colors[q * 3 + 2] as number) * k,
      );
      const alpha = inst.alpha ?? 1;
      // Translúcido: cada quad mistura sozinho (num caminho único, a sobreposição não somaria).
      const solo = alpha !== 1;
      if (solo || alpha !== currentAlpha) flush();
      if (alpha !== currentAlpha) {
        ctx.globalAlpha = alpha;
        currentAlpha = alpha;
      }
      if (solo || color !== runColor) {
        flush();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        runColor = color;
      }
      if (!runOpen) {
        ctx.beginPath();
        runOpen = true;
      }
      const v0 = off + (mesh.quads[q * 4] as number);
      const v1 = off + (mesh.quads[q * 4 + 1] as number);
      const v2 = off + (mesh.quads[q * 4 + 2] as number);
      const v3 = off + (mesh.quads[q * 4 + 3] as number);
      const x0 = this.sx[v0] as number;
      const y0 = this.sy[v0] as number;
      const x1 = this.sx[v1] as number;
      const y1 = this.sy[v1] as number;
      const x2 = this.sx[v2] as number;
      const y2 = this.sy[v2] as number;
      const x3 = this.sx[v3] as number;
      const y3 = this.sy[v3] as number;
      const mx = (x0 + x1 + x2 + x3) / 4;
      const my = (y0 + y1 + y2 + y3) / 4;
      const grow = (v: number, c: number) => v + (v > c ? SEAM_PX : -SEAM_PX);
      ctx.moveTo(grow(x0, mx), grow(y0, my));
      ctx.lineTo(grow(x1, mx), grow(y1, my));
      ctx.lineTo(grow(x2, mx), grow(y2, my));
      ctx.lineTo(grow(x3, mx), grow(y3, my));
      ctx.closePath();
      if (solo) flush();
    }
    flush();
    ctx.globalAlpha = 1;

    for (const set of lines) {
      this.ensure(set.positions.length / 3, 0);
      this.project(
        m,
        set.positions,
        width,
        height,
        0,
        set.yScale ?? 1,
        set.yBase ?? 0,
        set.yOffset ?? 0,
      );
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
      this.project(
        m,
        set.positions,
        width,
        height,
        0,
        set.yScale ?? 1,
        set.yBase ?? 0,
        set.yOffset ?? 0,
      );
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
