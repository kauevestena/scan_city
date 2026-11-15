import { OFFICE_H, OFFICE_HOTSPOTS, OFFICE_W } from '@/data/office';
import { hasIcon } from '@/ui/iconRegistry';
import { fitOffice, hitHotspot, hotspotStyle } from './hotspots';
import {
  atlasPose,
  dustParticle,
  DUST_COUNT,
  fleetSprites,
  OfficeRenderer,
  shelfSlots,
} from './OfficeRenderer';

const scene = {
  aircraft: ['ATLAS'] as const,
  vehicles: ['FOOT_BIKE'] as const,
  hardware: 'OLD_LAPTOP' as const,
  souvenirColors: [] as string[],
  staff: { INTERN: 0, JUNIOR_ENG: 0 },
  atlasAccessory: null,
};

describe('hotspots', () => {
  it('os 9 móveis cabem na sala, sem sobreposição, e têm ícone registrado', () => {
    expect(OFFICE_HOTSPOTS).toHaveLength(9);
    for (const h of OFFICE_HOTSPOTS) expect(hasIcon(h.icon), h.icon).toBe(true);
    for (const h of OFFICE_HOTSPOTS) {
      expect(h.rect.x + h.rect.w).toBeLessThanOrEqual(OFFICE_W);
      expect(h.rect.y + h.rect.h).toBeLessThanOrEqual(OFFICE_H);
    }
    for (const a of OFFICE_HOTSPOTS) {
      for (const b of OFFICE_HOTSPOTS) {
        if (a === b) continue;
        const overlap =
          a.rect.x < b.rect.x + b.rect.w &&
          b.rect.x < a.rect.x + a.rect.w &&
          a.rect.y < b.rect.y + b.rect.h &&
          b.rect.y < a.rect.y + a.rect.h;
        expect(overlap, `${a.id} × ${b.id}`).toBe(false);
      }
    }
  });

  it('posição em porcentagem, acerto e encaixe proporcional', () => {
    const door = OFFICE_HOTSPOTS.find((h) => h.id === 'DOOR') as (typeof OFFICE_HOTSPOTS)[number];
    expect(hotspotStyle(door).left).toBe(`${(1044 / 1280) * 100}%`);
    expect(hitHotspot(door, 1100, 200)).toBe(true);
    expect(hitHotspot(door, 10, 10)).toBe(false);
    expect(fitOffice(1280, 1000)).toEqual({ width: 1280, height: 672 });
    expect(fitOffice(2000, 672)).toEqual({ width: 1280, height: 672 });
    expect(fitOffice(640, 672)).toEqual({ width: 640, height: 336 });
  });
});

describe('OfficeRenderer', () => {
  it('a frota na garagem cresce com as compras', () => {
    expect(fleetSprites(['ATLAS'], ['FOOT_BIKE'])).toEqual([]);
    const fleet = fleetSprites(
      ['ATLAS', 'DRONE_T1', 'VTOL_T3'],
      ['FOOT_BIKE', 'PICKUP_4X4', 'LAB_VAN'],
    );
    expect(fleet.map((f) => f.kind)).toEqual(['DRONE_T1', 'VTOL_T3', 'PICKUP_4X4', 'LAB_VAN']);
  });

  it('a estante tem 18 nichos e mostra os souvenirs obtidos', () => {
    const slots = shelfSlots(5);
    expect(slots).toHaveLength(18);
    expect(slots.filter((s) => s.filled)).toHaveLength(5);
  });

  it('Atlas pisca e bica de tempos em tempos', () => {
    expect(atlasPose(0.05).blink).toBe(true);
    expect(atlasPose(1).blink).toBe(false);
    expect(atlasPose(0.3).peck).toBeGreaterThan(0.9);
    expect(atlasPose(3).peck).toBe(0);
  });

  it('a poeira é determinística e fica no cone das luzes', () => {
    for (let i = 0; i < DUST_COUNT; i++) {
      const p = dustParticle(i, 12.5);
      expect(p).toEqual(dustParticle(i, 12.5));
      expect(p.y).toBeGreaterThanOrEqual(60);
      expect(p.y).toBeLessThanOrEqual(380);
    }
  });

  it('desenha a sala escalada ao tamanho do canvas, com todos os móveis', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const renderer = new OfficeRenderer();
    renderer.update(1.5);
    expect(renderer.time).toBe(1.5);
    const scale = vi.spyOn(ctx, 'scale');
    const fill = vi.spyOn(ctx, 'fillRect');
    renderer.render(ctx, scene, 640, 336);
    expect(scale).toHaveBeenCalledWith(0.5, 0.5);
    const calls = fill.mock.calls.length;
    renderer.render(
      ctx,
      {
        ...scene,
        aircraft: ['ATLAS', 'DRONE_T1', 'DRONE_T2', 'VTOL_T3'],
        vehicles: ['FOOT_BIKE', 'COMPACT_CAR', 'PICKUP_4X4', 'LAB_VAN'],
        hardware: 'GAMER_PC',
        souvenirColors: ['#fde68a', '#fbbf24'],
        staff: { INTERN: 2, JUNIOR_ENG: 1 },
        atlasAccessory: { primary: '#dc2626', secondary: '#fecaca' },
      },
      640,
      336,
    );
    // Frota, souvenirs, equipe e acessório acrescentam desenhos.
    expect(fill.mock.calls.length - calls).toBeGreaterThan(calls);
  });
});
