import { MAP_ROWS, MARKER_ACCESS } from '@/data/overworld/map';
import type { VehicleId } from '@/types';
import { isReachable, nearestWalkable, reachableTiles } from './pathfinding';
import {
  blockedHint,
  canEnter,
  LEGEND,
  MAP_H,
  MAP_W,
  parseMap,
  speedOn,
  superiorVehicles,
  tileAt,
  WORLD_MAP,
} from './tiles';

const ALL: VehicleId[] = ['FOOT_BIKE', 'COMPACT_CAR', 'PICKUP_4X4', 'LAB_VAN'];

describe('mapa ASCII', () => {
  it('tem 100 linhas × 160 colunas, só com caracteres da legenda', () => {
    expect(MAP_ROWS).toHaveLength(MAP_H);
    for (const row of MAP_ROWS) {
      expect(row).toHaveLength(MAP_W);
      for (const c of row) expect(LEGEND[c], c).toBeDefined();
    }
  });

  it('tem uma porta, um spawn ao lado dela e cada marcador uma vez', () => {
    const text = MAP_ROWS.join('');
    for (const c of ['O', '@', ...'0123456', ...'abcdefghijk']) {
      expect(text.split(c).length - 1, c).toBe(1);
    }
    expect(
      Math.abs(WORLD_MAP.door.x - WORLD_MAP.spawn.x) +
        Math.abs(WORLD_MAP.door.y - WORLD_MAP.spawn.y),
    ).toBe(1);
    expect(WORLD_MAP.markers).toHaveLength(18);
    expect(Object.keys(MARKER_ACCESS).sort()).toEqual(WORLD_MAP.markers.map((m) => m.char).sort());
  });

  it('respeita o layout macro (centros aproximados das regiões)', () => {
    const at = (c: string) =>
      WORLD_MAP.markers.find((m) => m.char === c) as { x: number; y: number };
    const near = (c: string, x: number, y: number) =>
      expect(Math.hypot(at(c).x - x, at(c).y - y), c).toBeLessThanOrEqual(10);
    near('0', 96, 78);
    near('1', 80, 18);
    near('5', 30, 56);
    near('6', 148, 48);
    near('2', 26, 86);
    near('4', 18, 14);
    near('3', 132, 14);
    for (const [c, x, y] of [
      ['a', 112, 60],
      ['b', 60, 80],
      ['c', 44, 30],
      ['d', 120, 26],
      ['e', 32, 10],
      ['f', 140, 30],
      ['g', 64, 6],
      ['h', 96, 26],
      ['i', 60, 62],
      ['j', 8, 48],
      ['k', 40, 44],
    ] as const) {
      expect(at(c)).toMatchObject({ x, y });
    }
    expect(tileAt(WORLD_MAP, WORLD_MAP.door.x, WORLD_MAP.door.y)).toBe('URBAN');
    expect(tileAt(WORLD_MAP, at('0').x, at('0').y)).toBe('ROAD_DIRT');
    expect(tileAt(WORLD_MAP, at('a').x, at('a').y)).toBe('GRASS');
    expect(tileAt(WORLD_MAP, 158, 50)).toBe('WATER');
    expect(tileAt(WORLD_MAP, -1, 5)).toBe('MOUNTAIN');
  });

  it('rejeita mapas malformados', () => {
    expect(() => parseMap(['..', '.'])).toThrow(RangeError);
    expect(() => parseMap(['.?'])).toThrow(RangeError);
  });
});

describe('BFS — alcance de todos os marcadores × veículos', () => {
  // A porta (URBAN) fica ao lado do spawn: é de onde qualquer veículo parte.
  const reach = Object.fromEntries(
    ALL.map((v) => [v, reachableTiles(WORLD_MAP, WORLD_MAP.door, v)]),
  ) as Record<VehicleId, Set<number>>;

  it('superiores em capacidade de terreno', () => {
    expect(superiorVehicles('FOOT_BIKE')).toEqual(['PICKUP_4X4']);
    // A pé passa por todos os tiles do carro (e mais): é "superior" em terreno.
    expect(superiorVehicles('COMPACT_CAR').sort()).toEqual(['FOOT_BIKE', 'LAB_VAN', 'PICKUP_4X4']);
    expect(superiorVehicles('PICKUP_4X4')).toEqual([]);
  });

  it.each(WORLD_MAP.markers.map((m) => [m.char, m] as const))(
    'marcador %s: alcançável com o veículo mínimo e os superiores',
    (char, marker) => {
      const min = MARKER_ACCESS[char] as VehicleId;
      for (const v of [min, ...superiorVehicles(min)]) {
        expect(
          isReachable(WORLD_MAP, WORLD_MAP.spawn, marker, v, reach[v]),
          `${char} com ${v}`,
        ).toBe(true);
      }
    },
  );

  it('os marcadores só de 4x4 não são alcançáveis a pé, de carro nem de van', () => {
    const fourByFour = WORLD_MAP.markers.filter((m) => MARKER_ACCESS[m.char] === 'PICKUP_4X4');
    expect(fourByFour.map((m) => m.char).sort()).toEqual(['3', '4', 'e', 'f']);
    for (const m of fourByFour) {
      for (const v of ['FOOT_BIKE', 'COMPACT_CAR', 'LAB_VAN'] as const) {
        expect(isReachable(WORLD_MAP, WORLD_MAP.spawn, m, v, reach[v]), `${m.char} com ${v}`).toBe(
          false,
        );
      }
    }
  });

  it('o carro chega aos contratos com estrada; a pé, do spawn, chega a tudo que não é 4x4', () => {
    for (const c of '01256') {
      const m = WORLD_MAP.markers.find((x) => x.char === c) as { x: number; y: number };
      expect(isReachable(WORLD_MAP, WORLD_MAP.door, m, 'COMPACT_CAR', reach.COMPACT_CAR), c).toBe(
        true,
      );
    }
    const fromSpawn = reachableTiles(WORLD_MAP, WORLD_MAP.spawn, 'FOOT_BIKE');
    expect(fromSpawn.size).toBe(reach.FOOT_BIKE.size);
    // O carro não nasce na grama do spawn.
    expect(reachableTiles(WORLD_MAP, WORLD_MAP.spawn, 'COMPACT_CAR').size).toBe(0);
  });

  it('nearestWalkable acha o tile válido mais próximo', () => {
    expect(nearestWalkable(WORLD_MAP, WORLD_MAP.spawn, 'FOOT_BIKE')).toEqual(WORLD_MAP.spawn);
    const fromWater = nearestWalkable(WORLD_MAP, { x: 158, y: 50 }, 'FOOT_BIKE') as {
      x: number;
      y: number;
    };
    expect(canEnter(tileAt(WORLD_MAP, fromWater.x, fromWater.y), 'FOOT_BIKE')).toBe(true);
    expect(nearestWalkable(parseMap(['~~', '~~']), { x: 0, y: 0 }, 'FOOT_BIKE')).toBeNull();
    expect(reachableTiles(parseMap(['~.']), { x: 0, y: 0 }, 'FOOT_BIKE').size).toBe(0);
  });
});

describe('passabilidade e dicas', () => {
  it('velocidades da tabela e tiles intransponíveis', () => {
    expect(speedOn('GRASS', 'FOOT_BIKE')).toBe(3);
    expect(speedOn('ROAD_PAVED', 'COMPACT_CAR')).toBe(12);
    expect(canEnter('SWAMP', 'FOOT_BIKE')).toBe(false);
    expect(canEnter('SWAMP', 'PICKUP_4X4')).toBe(true);
    expect(canEnter('WATER', 'PICKUP_4X4')).toBe(false);
  });

  it('dica contextual pelo tipo de tile', () => {
    expect(blockedHint('HILL_STEEP', 'FOOT_BIKE')).toBe('Encosta íngreme — requer Picape 4x4');
    expect(blockedHint('SWAMP', 'FOOT_BIKE')).toBe('Brejo — requer Picape 4x4');
    expect(blockedHint('GRASS', 'COMPACT_CAR')).toBe(
      'Fora de estrada — carros não passam; troque para A Pé [V]',
    );
    expect(blockedHint('WATER', 'FOOT_BIKE')).toBe('Água — procure uma ponte');
    expect(blockedHint('BUILDING', 'FOOT_BIKE')).toBe('Prédio — contorne pela rua');
    expect(blockedHint('MOUNTAIN', 'PICKUP_4X4')).toBe('Montanha — intransponível');
    expect(blockedHint('GRASS', 'FOOT_BIKE')).toBe('Montanha — intransponível');
  });
});
