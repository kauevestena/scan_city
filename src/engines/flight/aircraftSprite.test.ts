import {
  ATLAS_BLINK_EVERY_S,
  ATLAS_BLINK_S,
  drawAircraft,
  mixHex,
  type SpriteParams,
} from './aircraftSprite';

const ctx2d = () => document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

const atlas = (over: Partial<SpriteParams> = {}): SpriteParams => ({
  kind: 'BIRD',
  x: 640,
  y: 600,
  scale: 30,
  timeS: 1,
  speedMs: 10,
  bankRad: 0,
  colors: { primary: '#94a3b8', secondary: '#475569' },
  ...over,
});

describe('o Atlas novo (T097)', () => {
  it('mistura de cores em hexadecimal', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#94a3b8', '#1e293b', 0.22)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('olhos abertos (íris, pupila e brilho) e, de vez em quando, uma piscada', () => {
    const open = ctx2d();
    drawAircraft(open, atlas({ timeS: 1 }));
    const blink = ctx2d();
    drawAircraft(blink, atlas({ timeS: ATLAS_BLINK_EVERY_S * 3 + ATLAS_BLINK_S / 2 }));
    const arcs = (c: CanvasRenderingContext2D) => vi.mocked(c.arc).mock.calls.length;
    // A cabeça e os dois olhos de três círculos cada; piscando, só a cabeça.
    expect(arcs(open)).toBe(7);
    expect(arcs(blink)).toBe(1);
  });

  it('as asas batem: a ponta muda de lugar com o tempo', () => {
    const path = (timeS: number) => {
      const c = ctx2d();
      drawAircraft(c, atlas({ timeS }));
      return JSON.stringify(vi.mocked(c.ellipse).mock.calls);
    };
    expect(path(1)).not.toBe(path(1.2));
  });

  it('cada acessório tem o seu desenho; sem id, a faixa no pescoço', () => {
    const colors = { primary: '#dc2626', secondary: '#fecaca' };
    const draw = (accessoryId?: string) => {
      const c = ctx2d();
      drawAircraft(c, atlas({ accessory: colors, ...(accessoryId ? { accessoryId } : {}) }));
      return c;
    };
    const plain = ctx2d();
    drawAircraft(plain, atlas());
    const base = {
      rect: vi.mocked(plain.fillRect).mock.calls.length,
      arc: vi.mocked(plain.arc).mock.calls.length,
      ellipse: vi.mocked(plain.ellipse).mock.calls.length,
      curve: vi.mocked(plain.quadraticCurveTo).mock.calls.length,
    };
    // Óculos: a tira e as duas lentes (três arcos a mais).
    expect(vi.mocked(draw('ATLAS_GOGGLES').arc).mock.calls.length).toBe(base.arc + 3);
    // Cachecol: a volta (uma elipse) e as pontas (curvas) tremulando.
    const scarf = draw('ATLAS_SCARF');
    expect(vi.mocked(scarf.ellipse).mock.calls.length).toBe(base.ellipse + 1);
    expect(vi.mocked(scarf.quadraticCurveTo).mock.calls.length).toBe(base.curve + 2);
    // Mochilinha: a caixa e o LED.
    const pack = draw('ATLAS_GPS_PACK');
    expect(vi.mocked(pack.fillRect).mock.calls.length).toBe(base.rect + 1);
    expect(vi.mocked(pack.arc).mock.calls.length).toBe(base.arc + 1);
    // Louros: sete folhas e a fita.
    const laurel = draw('ATLAS_LAUREL');
    expect(vi.mocked(laurel.ellipse).mock.calls.length).toBe(base.ellipse + 7);
    // Sem id: a faixa.
    expect(vi.mocked(draw().fillRect).mock.calls.length).toBe(base.rect + 1);
  });

  it('os outros tipos seguem desenhando (multirrotor e asa fixa)', () => {
    for (const kind of ['MULTIROTOR', 'FIXED_WING_VTOL'] as const) {
      const c = ctx2d();
      drawAircraft(c, atlas({ kind }));
      expect(vi.mocked(c.fill).mock.calls.length).toBeGreaterThan(0);
    }
  });
});
