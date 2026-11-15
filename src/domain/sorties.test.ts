import { getAircraft } from '@/data/catalog';
import {
  batteriesLeft,
  canStartNewSortie,
  CROP_CAPACITY,
  feedCrop,
  missionHasData,
} from './sorties';

const plan = { lines: [{ index: 0 }, { index: 1 }, { index: 2 }] } as never;
const mission = (over: object = {}) =>
  ({ sorties: [{}], completedLines: [0], plan, ...over }) as never;
const inv = (stock: number) => ({ corn: { stock, crop: 10 } });

describe('missionHasData', () => {
  const grid = { cols: 1, rows: 1, pulses: [1], firstAbove: [0], ground: [1], cellAreaM2: 1 };
  it('fotos ou nuvem LiDAR contam; missão vazia, não', () => {
    expect(missionHasData({ shots: [], lidar: undefined })).toBe(false);
    expect(missionHasData({ shots: [{} as never], lidar: undefined })).toBe(true);
    expect(missionHasData({ shots: [], lidar: { grid, samples: [] } })).toBe(true);
  });
});

describe('Nova surtida (§5.12)', () => {
  it('baterias: 1 + reservas − surtidas já voadas (DRONE_T1 e DRONE_T2)', () => {
    const t2 = getAircraft('DRONE_T2');
    expect(batteriesLeft({ sorties: [] }, t2)).toBe(1 + t2.spareBatteries);
    expect(batteriesLeft(mission(), t2)).toBe(t2.spareBatteries);
  });

  it('visível só com linhas incompletas e energia reserva; sem reservas, some', () => {
    const t2 = getAircraft('DRONE_T2');
    expect(canStartNewSortie(mission(), t2, inv(0))).toBe(t2.spareBatteries > 0);
    expect(canStartNewSortie(mission({ completedLines: [0, 1, 2] }), t2, inv(0))).toBe(false);
    const spent = mission({ sorties: Array.from({ length: 1 + t2.spareBatteries }, () => ({})) });
    expect(canStartNewSortie(spent, t2, inv(0))).toBe(false);
  });

  it('Atlas: depende do estoque de milho > 0', () => {
    const atlas = getAircraft('ATLAS');
    expect(canStartNewSortie(mission(), atlas, inv(5))).toBe(true);
    expect(canStartNewSortie(mission(), atlas, inv(0))).toBe(false);
  });

  it('alimentar enche o papo com o estoque, até 10', () => {
    expect(feedCrop({ stock: 20, crop: 4 })).toEqual({ stock: 14, crop: CROP_CAPACITY });
    expect(feedCrop({ stock: 3, crop: 4 })).toEqual({ stock: 0, crop: 7 });
    expect(feedCrop({ stock: 20, crop: 10 })).toEqual({ stock: 20, crop: 10 });
  });
});
