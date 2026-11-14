import { mulberry32 } from '@/lib/rng';
import { EVENT_CHANCE_PER_TILE, rollFieldEvent, type FieldEventId } from './fieldEvents';

function sequence(
  seed: number,
  vehicle: 'FOOT_BIKE' | 'PICKUP_4X4',
  tiles = 5000,
): Array<[number, FieldEventId]> {
  const rng = mulberry32(seed);
  let last = -Infinity;
  const out: Array<[number, FieldEventId]> = [];
  for (let i = 0; i < tiles; i++) {
    const now = i * 0.5;
    const e = rollFieldEvent(rng, 'ROAD_DIRT', vehicle, now, last);
    if (e) {
      out.push([now, e]);
      last = now;
    }
  }
  return out;
}

describe('rollFieldEvent', () => {
  it('é determinístico pela seed', () => {
    expect(sequence(3, 'PICKUP_4X4')).toEqual(sequence(3, 'PICKUP_4X4'));
    expect(sequence(3, 'PICKUP_4X4')).not.toEqual(sequence(4, 'PICKUP_4X4'));
  });

  it('respeita o intervalo mínimo de 20 s', () => {
    const events = sequence(5, 'PICKUP_4X4');
    expect(events.length).toBeGreaterThan(10);
    for (let i = 1; i < events.length; i++) {
      expect((events[i]?.[0] ?? 0) - (events[i - 1]?.[0] ?? 0)).toBeGreaterThanOrEqual(20);
    }
  });

  it('pneu furado e gado só com veículo de rodas', () => {
    const onFoot = new Set(sequence(9, 'FOOT_BIKE', 40_000).map(([, e]) => e));
    expect(onFoot.has('FLAT_TIRE')).toBe(false);
    expect(onFoot.has('CATTLE')).toBe(false);
    expect(onFoot.has('LOST_BENCHMARK')).toBe(true);
    const wheels = new Set(sequence(9, 'PICKUP_4X4', 40_000).map(([, e]) => e));
    expect(wheels.has('FLAT_TIRE')).toBe(true);
    expect(wheels.size).toBe(6);
  });

  it('só em tiles de terra; probabilidade de 1,5 % por tile', () => {
    expect(rollFieldEvent(mulberry32(1), 'ROAD_PAVED', 'FOOT_BIKE', 100, 0)).toBeNull();
    expect(rollFieldEvent(mulberry32(1), 'URBAN', 'FOOT_BIKE', 100, 0)).toBeNull();
    const rng = mulberry32(77);
    let hits = 0;
    for (let i = 0; i < 20_000; i++)
      if (rollFieldEvent(rng, 'GRASS', 'FOOT_BIKE', 1000, -Infinity)) hits++;
    expect(Math.abs(hits / 20_000 - EVENT_CHANCE_PER_TILE)).toBeLessThan(0.004);
  });
});
