import type { MarkerView } from './markers';
import { bearingTo, nextMissionMarker } from './navigation';

const m = (contractId: string, status: MarkerView['status'], x = 10, y = 10): MarkerView =>
  ({ char: '0', kind: 'CONTRACT', x, y, contractId, status }) as MarkerView;

describe('navegação GNSS', () => {
  it('a próxima missão é a primeira disponível na ordem da campanha', () => {
    const order = ['C00', 'C01', 'C02', 'C03'];
    const markers = [
      m('C03', 'AVAILABLE'),
      m('C00', 'COMPLETED'),
      m('C01', 'LOCKED'),
      m('C02', 'STOLEN'),
    ];
    expect(nextMissionMarker(markers, order)?.contractId).toBe('C02');
    expect(nextMissionMarker([m('C00', 'COMPLETED')], order)).toBeNull();
    expect(
      nextMissionMarker([m('ZZ', 'AVAILABLE'), m('C01', 'AVAILABLE')], order)?.contractId,
    ).toBe('C01');
  });

  it('rumo em tiles e pontos cardeais (norte em cima, y cresce para baixo)', () => {
    const at = { x: 10.5, y: 10.5 };
    expect(bearingTo(at, { x: 10, y: 0 }).compass).toBe('N');
    expect(bearingTo(at, { x: 20, y: 10 }).compass).toBe('L');
    expect(bearingTo(at, { x: 10, y: 20 }).compass).toBe('S');
    expect(bearingTo(at, { x: 0, y: 10 }).compass).toBe('O');
    expect(bearingTo(at, { x: 20, y: 0 }).compass).toBe('NE');
    expect(bearingTo(at, { x: 0, y: 20 }).compass).toBe('SO');
    const b = bearingTo(at, { x: 13, y: 14 });
    expect(b.distanceTiles).toBeCloseTo(5, 9);
    expect(b.angleRad).toBeCloseTo(Math.atan2(4, 3), 9);
    expect(b.arrived).toBe(false);
    expect(bearingTo(at, { x: 10, y: 10 }).arrived).toBe(true);
  });
});
