/**
 * Matrizes 4 × 4 em coluna-maior (`Float32Array(16)`), como na convenção do WebGL.
 * As funções escrevem em `out` para não alocar no hot path.
 */
import type { Vec3 } from './vec3';

export type Mat4 = Float32Array;

export const mat4 = (): Mat4 => identity(new Float32Array(16));

export function identity(out: Mat4): Mat4 {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

/** out = a · b. `out` pode ser `a` ou `b`. */
export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += (a[k * 4 + row] as number) * (b[c * 4 + k] as number);
      r[c * 4 + row] = s;
    }
  }
  out.set(r);
  return out;
}

/** Perspectiva (fovY em rad), com profundidade em [−1, 1]. */
export function perspective(
  out: Mat4,
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/** Matriz de visão olhando de `eye` para `center`, com `up`. */
export function lookAt(out: Mat4, eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** Profundidade normalizada (maior = mais longe); `w ≤ 0` atrás da câmera. */
  depth: number;
  w: number;
}

/** Projeta (x, y, z) para pixels com a matriz view·projection. */
export function projectPoint(
  m: Mat4,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  out: ScreenPoint = { x: 0, y: 0, depth: 0, w: 0 },
): ScreenPoint {
  const cx = (m[0] as number) * x + (m[4] as number) * y + (m[8] as number) * z + (m[12] as number);
  const cy = (m[1] as number) * x + (m[5] as number) * y + (m[9] as number) * z + (m[13] as number);
  const cz =
    (m[2] as number) * x + (m[6] as number) * y + (m[10] as number) * z + (m[14] as number);
  const cw =
    (m[3] as number) * x + (m[7] as number) * y + (m[11] as number) * z + (m[15] as number);
  out.w = cw;
  const iw = cw !== 0 ? 1 / cw : 0;
  out.x = (cx * iw * 0.5 + 0.5) * width;
  out.y = (1 - (cy * iw * 0.5 + 0.5)) * height;
  out.depth = cz * iw;
  return out;
}
