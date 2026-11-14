import { mulberry32 } from '@/lib/rng';
import {
  baseHeightRatio,
  depthPrecisionM,
  heightFromParallax,
  parallaxDiffM,
  photoBaseM,
} from './stereo';

const close = (a: number, e: number, rel = 1e-3) =>
  expect(Math.abs(a - e) / Math.abs(e)).toBeLessThanOrEqual(rel);

describe('estereoscopia (domain-math §3)', () => {
  it('G14 — B 30, H 100, f 35 mm, h 20: b 10,5 mm, Δp 2,625 mm, h 20 m', () => {
    const b = photoBaseM(30, 0.035, 100);
    const dp = parallaxDiffM(30, 0.035, 100, 20);
    close(b, 0.0105);
    close(dp, 0.002625);
    close(heightFromParallax(100, b, dp), 20);
  });

  it('G15 — σ_Z com σ = 0,5 px × 4,3823 µm = 2,0868 cm', () => {
    close(depthPrecisionM(100, 30, 0.035, 0.5 * 4.3823e-6), 0.020868);
  });

  it('B/H', () => {
    expect(baseHeightRatio(30, 100)).toBe(0.3);
  });

  it('a identidade da paralaxe vale (1e-9) em 50 combinações seedadas', () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 50; i++) {
      const H = rng.range(30, 500);
      const B = rng.range(5, 200);
      const f = rng.range(0.004, 0.05);
      const h = rng.range(0, H * 0.9);
      const recovered = heightFromParallax(H, photoBaseM(B, f, H), parallaxDiffM(B, f, H, h));
      expect(Math.abs(recovered - h)).toBeLessThan(1e-9);
    }
  });
});
