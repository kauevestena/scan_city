import {
  clamp,
  degToRad,
  invLerp,
  lerp,
  mod,
  radToDeg,
  remap,
  smoothstep,
  vec2,
  vec3,
} from './math';

describe('escalares', () => {
  it('clamp', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('lerp, invLerp e remap', () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(invLerp(10, 20, 12.5)).toBe(0.25);
    expect(invLerp(4, 4, 9)).toBe(0);
    expect(remap(5, 0, 10, 100, 200)).toBe(150);
    expect(remap(15, 0, 10, 100, 200)).toBe(250);
  });

  it('smoothstep satura fora das bordas e é suave no meio', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(2, 4, 2.5)).toBeCloseTo(0.15625, 12);
  });

  it('graus e radianos', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 12);
    expect(radToDeg(degToRad(37.5))).toBeCloseTo(37.5, 12);
  });

  it('mod nunca é negativo', () => {
    expect(mod(-1, 5)).toBe(4);
    expect(mod(7, 5)).toBe(2);
    expect(mod(-10, 5)).toBe(0);
  });
});

describe('vec2', () => {
  const a = vec2.of(3, 4);
  const b = vec2.of(1, -2);

  it('operações básicas', () => {
    expect(vec2.add(a, b)).toEqual({ x: 4, y: 2 });
    expect(vec2.sub(a, b)).toEqual({ x: 2, y: 6 });
    expect(vec2.scale(a, 2)).toEqual({ x: 6, y: 8 });
    expect(vec2.dot(a, b)).toBe(-5);
    expect(vec2.cross(a, b)).toBe(-10);
    expect(vec2.len(a)).toBe(5);
  });

  it('norm', () => {
    const n = vec2.norm(a);
    expect(n.x).toBeCloseTo(0.6, 12);
    expect(n.y).toBeCloseTo(0.8, 12);
    expect(vec2.norm(vec2.of(0, 0))).toEqual({ x: 0, y: 0 });
  });
});

describe('vec3', () => {
  const a = vec3.of(1, 2, 2);
  const b = vec3.of(0, 1, 0);

  it('operações básicas', () => {
    expect(vec3.add(a, b)).toEqual({ x: 1, y: 3, z: 2 });
    expect(vec3.sub(a, b)).toEqual({ x: 1, y: 1, z: 2 });
    expect(vec3.scale(a, 3)).toEqual({ x: 3, y: 6, z: 6 });
    expect(vec3.dot(a, b)).toBe(2);
    expect(vec3.len(a)).toBe(3);
  });

  it('cross segue a regra da mão direita', () => {
    expect(vec3.cross(vec3.of(1, 0, 0), vec3.of(0, 1, 0))).toEqual({ x: 0, y: 0, z: 1 });
    expect(vec3.cross(a, b)).toEqual({ x: -2, y: 0, z: 1 });
  });

  it('norm', () => {
    expect(vec3.len(vec3.norm(a))).toBeCloseTo(1, 12);
    expect(vec3.norm(vec3.of(0, 0, 0))).toEqual({ x: 0, y: 0, z: 0 });
  });
});
