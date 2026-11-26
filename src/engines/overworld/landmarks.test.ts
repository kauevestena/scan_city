import { STRINGS } from '@/data/strings';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { drawHeadquarters, drawNavArrow, hqRect, NAV_RING_PX } from './landmarks';
import { drawMinimap } from './minimap';
import { TILE_PX } from './tileRenderer';

const ctx2d = () => document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

describe('a sede no mapa', () => {
  it('ocupa o quarteirão acima da porta, centrada nela', () => {
    const r = hqRect(WORLD_MAP.door);
    expect(r.x + r.w / 2).toBeCloseTo((WORLD_MAP.door.x + 0.5) * TILE_PX, 6);
    expect(r.y + r.h).toBeLessThanOrEqual(WORLD_MAP.door.y * TILE_PX);
  });

  it('tem a faixa com o nome, e a luz do mastro pisca (acesa parada com reduzir flashes)', () => {
    const ctx = ctx2d();
    drawHeadquarters(ctx, WORLD_MAP.door, 0, true);
    expect(ctx.fillText).toHaveBeenCalledWith(
      STRINGS.world.hqSign,
      expect.any(Number),
      expect.any(Number),
    );
    const light = (t: number, animate: boolean) => {
      const c = ctx2d();
      const styles: string[] = [];
      const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(c), 'fillStyle');
      Object.defineProperty(c, 'fillStyle', {
        set(v: string) {
          styles.push(v);
          desc?.set?.call(c, v);
        },
        get() {
          return desc?.get?.call(c);
        },
      });
      drawHeadquarters(c, WORLD_MAP.door, t, animate);
      return styles.includes('#f43f5e');
    };
    expect(light(0, true)).toBe(true);
    expect(light(0.8, true)).toBe(false);
    expect(light(0.8, false)).toBe(true);
  });
});

describe('seta GNSS', () => {
  it('fica no anel em volta do avatar, na direção do destino', () => {
    const ctx = ctx2d();
    drawNavArrow(ctx, { x: 100, y: 100 }, Math.PI / 2, 0, false);
    expect(ctx.translate).toHaveBeenCalledWith(
      expect.closeTo(100, 6),
      expect.closeTo(100 + NAV_RING_PX, 6),
    );
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
  });

  it('o minimapa traça a linha até o destino só com a navegação ligada', () => {
    const off = ctx2d();
    drawMinimap(off, document.createElement('canvas'), [], { x: 5, y: 5 }, { x: 2, y: 2 }, 0);
    expect(off.setLineDash).not.toHaveBeenCalled();
    const on = ctx2d();
    drawMinimap(on, document.createElement('canvas'), [], { x: 5, y: 5 }, { x: 2, y: 2 }, 0, {
      x: 40,
      y: 9,
    });
    expect(on.lineTo).toHaveBeenCalledWith(40.5, 9.5);
  });
});
