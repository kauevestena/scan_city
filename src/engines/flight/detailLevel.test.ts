import {
  DetailGovernor,
  detailCap,
  detailFx,
  flightDetailLevel,
  lowerQuality,
  resetRememberedDetail,
} from './detailLevel';

/** `n` quadros a `fps`. */
function feed(g: DetailGovernor, fps: number, seconds: number): number[] {
  const changes: number[] = [];
  for (let t = 0; t < seconds * 1000; t += 1000 / fps) {
    const c = g.sample(1000 / fps);
    if (c !== null) changes.push(c);
  }
  return changes;
}

beforeEach(() => resetRememberedDetail());

describe('degraus de detalhe do voo', () => {
  it('o que cada degrau desliga: primeiro a inclinação, depois nuvens e vinheta, depois o relevo', () => {
    expect(detailFx(3)).toEqual({ roll: true, wisps: true, vignette: true, qualityDrop: 0 });
    expect(detailFx(2)).toEqual({ roll: false, wisps: true, vignette: true, qualityDrop: 0 });
    expect(detailFx(1)).toEqual({ roll: false, wisps: false, vignette: false, qualityDrop: 0 });
    expect(detailFx(0)).toEqual({ roll: false, wisps: false, vignette: false, qualityDrop: 1 });
  });

  it('o teto vem da qualidade escolhida; a qualidade desce até a Baixa', () => {
    expect([detailCap('HIGH'), detailCap('MEDIUM'), detailCap('LOW')]).toEqual([3, 2, 1]);
    expect(lowerQuality('HIGH', 1)).toBe('MEDIUM');
    expect(lowerQuality('MEDIUM', 1)).toBe('LOW');
    expect(lowerQuality('LOW', 1)).toBe('LOW');
    expect(lowerQuality('HIGH', 0)).toBe('HIGH');
  });

  it('lento, desce um degrau por janela (se ajudou); com folga, volta a subir', () => {
    const g = new DetailGovernor('HIGH');
    expect(g.level).toBe(3);
    expect(flightDetailLevel()).toBe(3);
    // 40 FPS: desce; a janela seguinte a 50 FPS ajudou (≥ 5 %) e o degrau fica.
    expect(feed(g, 40, 1.6)).toEqual([2]);
    feed(g, 50, 1.6);
    expect(g.level).toBeLessThanOrEqual(2);
    // Com folga seguida, sobe.
    const up = feed(g, 60, 12);
    expect(up.length).toBeGreaterThan(0);
    expect(g.level).toBeGreaterThan(1);
  });

  it('a descida que não ajudou é desfeita', () => {
    const g = new DetailGovernor('HIGH');
    expect(feed(g, 30, 1.6)).toEqual([2]);
    // Continua a 30 FPS (navegador limitado): volta ao 3.
    expect(feed(g, 30, 1.6)).toEqual([3]);
  });

  it('a próxima surtida começa no degrau que se segurou; subir a qualidade leva ao teto novo', () => {
    const g = new DetailGovernor('HIGH');
    feed(g, 40, 1.6);
    feed(g, 50, 1.6);
    const held = g.level;
    expect(new DetailGovernor('HIGH').level).toBe(held);
    const low = new DetailGovernor('LOW');
    expect(low.level).toBeLessThanOrEqual(1);
    low.setQuality('HIGH');
    expect(low.level).toBe(3);
  });
});
