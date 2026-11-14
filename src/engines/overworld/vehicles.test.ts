import type { TileType, VehicleId } from '@/types';
import { canEnter, LEGEND, parseMap, speedOn } from '@/world/overworld/tiles';
import { stepAvatar, type AvatarState } from './avatar';
import { OverworldEngine } from './OverworldEngine';
import { drawAvatar } from './vehicleSprites';

/** catalog §5: tiles/s por tipo de tile e veículo; `null` = intransponível. */
const TABLE: Record<TileType, Record<VehicleId, number | null>> = {
  ROAD_PAVED: { FOOT_BIKE: 6, COMPACT_CAR: 12, PICKUP_4X4: 10, LAB_VAN: 10 },
  ROAD_DIRT: { FOOT_BIKE: 5, COMPACT_CAR: 7, PICKUP_4X4: 9, LAB_VAN: 6 },
  TRAIL: { FOOT_BIKE: 4, COMPACT_CAR: null, PICKUP_4X4: 7, LAB_VAN: null },
  GRASS: { FOOT_BIKE: 3, COMPACT_CAR: null, PICKUP_4X4: 6, LAB_VAN: null },
  FOREST: { FOOT_BIKE: 2, COMPACT_CAR: null, PICKUP_4X4: 3, LAB_VAN: null },
  SAND: { FOOT_BIKE: 2.5, COMPACT_CAR: null, PICKUP_4X4: 5, LAB_VAN: null },
  HILL: { FOOT_BIKE: 2, COMPACT_CAR: null, PICKUP_4X4: 5, LAB_VAN: null },
  HILL_STEEP: { FOOT_BIKE: null, COMPACT_CAR: null, PICKUP_4X4: 3, LAB_VAN: null },
  SWAMP: { FOOT_BIKE: null, COMPACT_CAR: null, PICKUP_4X4: 3, LAB_VAN: null },
  SNOW: { FOOT_BIKE: 1.5, COMPACT_CAR: null, PICKUP_4X4: 4, LAB_VAN: null },
  URBAN: { FOOT_BIKE: 5, COMPACT_CAR: 9, PICKUP_4X4: 7, LAB_VAN: 8 },
  BRIDGE: { FOOT_BIKE: 6, COMPACT_CAR: 12, PICKUP_4X4: 10, LAB_VAN: 10 },
  WATER: { FOOT_BIKE: null, COMPACT_CAR: null, PICKUP_4X4: null, LAB_VAN: null },
  MOUNTAIN: { FOOT_BIKE: null, COMPACT_CAR: null, PICKUP_4X4: null, LAB_VAN: null },
  BUILDING: { FOOT_BIKE: null, COMPACT_CAR: null, PICKUP_4X4: null, LAB_VAN: null },
};
const VEHICLES: VehicleId[] = ['FOOT_BIKE', 'COMPACT_CAR', 'PICKUP_4X4', 'LAB_VAN'];
const CHAR_OF: Record<TileType, string> = {
  ROAD_PAVED: '=',
  ROAD_DIRT: '-',
  TRAIL: ':',
  GRASS: '.',
  FOREST: 'T',
  SAND: 's',
  HILL: '^',
  HILL_STEEP: 'A',
  SWAMP: '%',
  SNOW: '*',
  URBAN: 'u',
  BRIDGE: 'H',
  WATER: '~',
  MOUNTAIN: 'M',
  BUILDING: '#',
};

describe('velocidades por veículo e tile (catalog §5)', () => {
  it('a legenda ASCII cobre os 15 tipos de tile', () => {
    for (const [tile, char] of Object.entries(CHAR_OF)) expect(LEGEND[char]).toBe(tile);
  });

  it.each(Object.entries(TABLE))('%s: velocidade e passabilidade de cada veículo', (tile, row) => {
    for (const v of VEHICLES) {
      const expected = row[v];
      expect(speedOn(tile as TileType, v), `${tile}/${v}`).toBe(expected ?? undefined);
      expect(canEnter(tile as TileType, v)).toBe(expected !== null);
    }
  });

  it('andar 1 s num tile transponível percorre exatamente `tiles/s` (com speedMod 1)', () => {
    for (const [tile, row] of Object.entries(TABLE)) {
      for (const v of VEHICLES) {
        const speed = row[v];
        if (speed === null) continue;
        // Faixa larga do mesmo tile, para não esbarrar em nada.
        const char = CHAR_OF[tile as TileType];
        const map = parseMap(Array.from({ length: 5 }, () => char.repeat(40)));
        const start: AvatarState = { x: 2.5, y: 2.5, facing: 'E', walked: 0 };
        const r = stepAvatar(map, start, 1, 0, v, 1, 1);
        expect(r.moved, `${tile}/${v}`).toBeCloseTo(speed, 6);
      }
    }
  });
});

/** Contexto que só registra as chamadas de desenho. */
function recorder() {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === 'fillStyle' || prop === 'strokeStyle' || prop === 'lineWidth') return '';
        return (...args: unknown[]) => {
          calls.push(
            `${prop}(${args.map((a) => (typeof a === 'number' ? a.toFixed(2) : '')).join(',')})`,
          );
        };
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const SKIN = { primary: '#f97316', secondary: '#1e293b' };
const draw = (
  vehicle: VehicleId,
  over: { tile?: TileType; moving?: boolean; facing?: 'N' | 'E' } = {},
) => {
  const { ctx, calls } = recorder();
  drawAvatar(ctx, {
    avatar: { x: 4.5, y: 4.5, facing: over.facing ?? 'E', walked: 0.3 },
    vehicle,
    tile: over.tile ?? 'GRASS',
    skin: SKIN,
    moving: over.moving ?? false,
  });
  return calls.join('|');
};

describe('sprites por modo (world-map §5.2)', () => {
  it('cada modo desenha um sprite distinto', () => {
    const sprites = VEHICLES.map((v) => draw(v));
    expect(new Set(sprites).size).toBe(4);
  });

  it('a pé usa o corpo + cabeça; na via, em movimento, vira bicicleta (rodas em arco)', () => {
    const foot = draw('FOOT_BIKE', { tile: 'GRASS', moving: true });
    const bike = draw('FOOT_BIKE', { tile: 'ROAD_PAVED', moving: true });
    expect(foot).toContain('roundRect');
    expect(bike).not.toContain('roundRect');
    expect(bike.match(/arc\(/g)?.length).toBeGreaterThanOrEqual(3);
    // Parado na via, segue a pé.
    expect(draw('FOOT_BIKE', { tile: 'ROAD_PAVED', moving: false })).toBe(
      draw('FOOT_BIKE', { tile: 'GRASS', moving: false }),
    );
  });

  it('veículos rodam para o rumo: leste e norte desenham com ângulos diferentes', () => {
    expect(draw('COMPACT_CAR', { facing: 'E' })).not.toBe(draw('COMPACT_CAR', { facing: 'N' }));
    expect(draw('COMPACT_CAR', { facing: 'N' })).toContain('rotate(-1.57)');
  });

  it('a van tem antena (traço extra) e a picape, caçamba (retângulo a mais)', () => {
    const count = (s: string, token: string) => s.split(token).length - 1;
    expect(count(draw('PICKUP_4X4'), 'fillRect')).toBeGreaterThan(
      count(draw('COMPACT_CAR'), 'fillRect'),
    );
    expect(count(draw('LAB_VAN'), 'lineTo')).toBeGreaterThan(count(draw('COMPACT_CAR'), 'lineTo'));
  });
});

describe('troca de veículo no tile atual (world-map §5.3)', () => {
  const MAP = parseMap(['..........', '.O@:===...', '..........']);
  const make = (x: number, y: number) =>
    new OverworldEngine({
      map: MAP,
      input: { axis: () => 0 },
      start: { x, y, facing: 'S' },
      vehicle: () => 'FOOT_BIKE',
      speedMod: () => 1,
      skin: () => SKIN,
      markers: () => [],
    });

  it('recusa carro na trilha, com a dica; na estrada, aceita', () => {
    // O tile (3,1) é trilha (':'), onde o carro não passa.
    expect(make(3.5, 1.5).switchRefusal('COMPACT_CAR')).toMatch(/carros não passam/);
    expect(make(5.5, 1.5).switchRefusal('COMPACT_CAR')).toBeNull();
  });

  it('a picape cabe em qualquer tile transponível a pé; o brejo/encosta barram o oposto', () => {
    expect(make(3.5, 1.5).switchRefusal('PICKUP_4X4')).toBeNull();
    const swamp = parseMap(['%%%%%', '%%%%%', '%%%%%']);
    const e = new OverworldEngine({
      map: swamp,
      input: { axis: () => 0 },
      start: { x: 2.5, y: 1.5, facing: 'S' },
      vehicle: () => 'PICKUP_4X4',
      speedMod: () => 1,
      skin: () => SKIN,
      markers: () => [],
    });
    expect(e.switchRefusal('FOOT_BIKE')).toBe('Brejo — requer Picape 4x4');
  });
});
