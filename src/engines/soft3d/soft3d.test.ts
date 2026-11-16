import { identity, lookAt, mat4, multiply, perspective, projectPoint } from './mat4';
import { easeInOut, OrbitCamera, PITCH_MAX, PITCH_MIN } from './OrbitCamera';
import { pickSector } from './picking';
import { buildMesh, Soft3DRenderer } from './Renderer';
import { add, cross, dot, length, lerp3, normalize, scale, sub, vec3 } from './vec3';

describe('vec3', () => {
  it('operações básicas', () => {
    expect(add([1, 2, 3], [1, 1, 1])).toEqual([2, 3, 4]);
    expect(sub([1, 2, 3], [1, 1, 1])).toEqual([0, 1, 2]);
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(length([3, 4, 0])).toBe(5);
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
    expect(lerp3([0, 0, 0], [2, 2, 2], 0.5)).toEqual([1, 1, 1]);
    expect(vec3()).toEqual([0, 0, 0]);
  });
});

describe('mat4', () => {
  it('identidade, multiplicação e projeção do centro', () => {
    const a = mat4();
    const b = identity(new Float32Array(16));
    expect(Array.from(multiply(mat4(), a, b))).toEqual(Array.from(identity(new Float32Array(16))));
    const view = lookAt(mat4(), [0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const proj = perspective(mat4(), Math.PI / 2, 2, 0.1, 100);
    const vp = multiply(mat4(), proj, view);
    // O alvo cai no centro da tela; algo à direita (x > 0) vai para a direita.
    const c = projectPoint(vp, 0, 0, 0, 800, 400);
    expect(c.x).toBeCloseTo(400, 3);
    expect(c.y).toBeCloseTo(200, 3);
    expect(c.w).toBeCloseTo(5, 6);
    expect(projectPoint(vp, 1, 0, 0, 800, 400).x).toBeGreaterThan(400);
    expect(projectPoint(vp, 0, 1, 0, 800, 400).y).toBeLessThan(200);
    // Mais longe: maior profundidade.
    expect(projectPoint(vp, 0, 0, -5, 800, 400).depth).toBeGreaterThan(c.depth);
    // Atrás da câmera: w negativo.
    expect(projectPoint(vp, 0, 0, 10, 800, 400).w).toBeLessThan(0);
  });
});

describe('OrbitCamera (REQ-HOL-001)', () => {
  it('pitch em [10°, 80°] e distância em [0,5×, 3×] do raio', () => {
    const cam = new OrbitCamera(2);
    cam.orbit(0, 10);
    expect(cam.pitch).toBe(PITCH_MAX);
    cam.orbit(0, -10);
    expect(cam.pitch).toBe(PITCH_MIN);
    cam.zoom(100);
    expect(cam.distance).toBe(6);
    cam.zoom(0.001);
    expect(cam.distance).toBe(1);
    // Yaw livre (360°).
    cam.orbit(10, 0);
    expect(cam.yaw).toBeGreaterThan(6);
  });

  it('setRadius: a distância acompanha o novo raio e os limites seguem o raio', () => {
    const cam = new OrbitCamera(2);
    cam.distance = 4;
    cam.flyTo([1, 0, 1], 1);
    cam.setRadius(4);
    expect(cam.radius).toBe(4);
    expect(cam.distance).toBe(8);
    expect(cam.flying).toBe(false);
    expect([cam.minDistance, cam.maxDistance]).toEqual([2, 12]);
    cam.setRadius(0.5);
    expect(cam.distance).toBe(1);
  });

  it('inércia de 0,9 por quadro e fly-to com ease-in-out', () => {
    const cam = new OrbitCamera(2);
    cam.orbit(0.1, 0);
    const yaw = cam.yaw;
    cam.update(1 / 60);
    expect(cam.yaw - yaw).toBeCloseTo(0.09, 6);
    cam.update(1 / 60, true);
    expect(cam.yaw - yaw).toBeCloseTo(0.09, 6);
    cam.flyTo([1, 0, 1], 1.2);
    expect(cam.flying).toBe(true);
    cam.update(0.6);
    expect(cam.target[0]).toBeCloseTo(0.5, 6);
    cam.update(0.6);
    expect(cam.target).toEqual([1, 0, 1]);
    expect(cam.flying).toBe(false);
    expect([easeInOut(0), easeInOut(0.5), easeInOut(1)]).toEqual([0, 0.5, 1]);
    // O olho fica acima do alvo (pitch > 0).
    expect(cam.eye()[1]).toBeGreaterThan(cam.target[1]);
    expect(cam.matrix(1.5)).toHaveLength(16);
  });
});

describe('Renderer e picking', () => {
  // Topo de um quadrado 1 × 1 em y = 0 (normal para cima).
  const top = buildMesh(
    new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0]),
    new Uint32Array([0, 1, 2, 3]),
    new Uint8Array([200, 100, 50]),
  );

  it('normal do quad para cima; visto de cima é desenhado, de baixo é descartado', () => {
    expect(Array.from(top.normals)).toEqual([0, 1, 0]);
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const r = new Soft3DRenderer();
    const above = new OrbitCamera(1);
    above.target = [0.5, 0, 0.5];
    above.pitch = 1.2;
    expect(r.render(ctx, 400, 300, above.matrix(4 / 3), [{ mesh: top }])).toEqual({
      quadsDrawn: 1,
      quadsCulled: 0,
    });
    const below = multiply(
      mat4(),
      perspective(mat4(), 1, 4 / 3, 0.05, 100),
      lookAt(mat4(), [0.5, -3, 0.6], [0.5, 0, 0.5], [0, 1, 0]),
    );
    expect(r.render(ctx, 400, 300, below, [{ mesh: top }])).toEqual({
      quadsDrawn: 0,
      quadsCulled: 1,
    });
    // Linhas, pontos e glow.
    r.render(
      ctx,
      400,
      300,
      above.matrix(4 / 3),
      [{ mesh: top, yScale: 0.5, alpha: 0.5 }],
      [
        {
          positions: new Float32Array([0, 0, 0, 1, 0, 1]),
          segments: new Uint32Array([0, 1]),
          color: '#22d3ee',
          width: 1,
          glow: 'rgba(34,211,238,0.2)',
        },
      ],
      [{ positions: new Float32Array([0.5, 0, 0.5]), color: '#22d3ee', size: 2 }],
    );
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('malhas de fundo são desenhadas antes, fora da ordenação', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const r = new Soft3DRenderer();
    const cam = new OrbitCamera(1);
    cam.target = [0.5, 0, 0.5];
    cam.pitch = 1.2;
    const floor = buildMesh(
      new Float32Array([-0.5, -0.1, -0.5, -0.5, -0.1, 1.5, 1.5, -0.1, 1.5, 1.5, -0.1, -0.5]),
      new Uint32Array([0, 1, 2, 3]),
      new Uint8Array([4, 4, 4]),
      true,
    );
    const fills: string[] = [];
    const spy = vi.spyOn(ctx, 'fill').mockImplementation(() => {
      fills.push(String(ctx.fillStyle));
    });
    r.render(ctx, 400, 300, cam.matrix(4 / 3), [{ mesh: top }, { mesh: floor, background: true }]);
    // O chão (fundo) sai primeiro, mesmo vindo depois na lista.
    expect(fills).toHaveLength(2);
    expect(fills[0]).toBe('#040404');
    spy.mockRestore();
  });

  it('ordena de longe para perto (chave empacotada) e reaproveita o estilo entre quads iguais', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const r = new Soft3DRenderer();
    const cam = new OrbitCamera(1);
    cam.target = [0.5, 0, 0.5];
    cam.pitch = 1.2;
    // Dois quads sobrepostos na tela: o de cima (y = 0,5) está mais perto da câmera.
    const quad = (y: number, rgb: [number, number, number]) =>
      buildMesh(
        new Float32Array([0, y, 0, 0, y, 1, 1, y, 1, 1, y, 0]),
        new Uint32Array([0, 1, 2, 3]),
        new Uint8Array(rgb),
        true,
      );
    const near = quad(0.5, [0, 200, 0]);
    const far = quad(0, [200, 0, 0]);
    const fills: string[] = [];
    const spy = vi.spyOn(ctx, 'fill').mockImplementation(() => {
      fills.push(String(ctx.fillStyle));
    });
    // A ordem dada não importa: o perto sempre sai por último.
    r.render(ctx, 400, 300, cam.matrix(4 / 3), [{ mesh: near }, { mesh: far }]);
    expect(fills).toHaveLength(2);
    expect(fills[0]).toBe('#c80000');
    expect(fills[1]).toBe('#00c800');
    spy.mockRestore();

    // Quatro quads da mesma cor: o `fillStyle` é atribuído uma só vez.
    const sets: string[] = [];
    Object.defineProperty(ctx, 'fillStyle', {
      set: (v: string) => sets.push(String(v)),
      get: () => '',
      configurable: true,
    });
    const same = [0, 0.1, 0.2, 0.3].map((y) => ({ mesh: quad(y, [10, 20, 30]) }));
    expect(r.render(ctx, 400, 300, cam.matrix(4 / 3), same).quadsDrawn).toBe(4);
    expect(sets).toHaveLength(1);
  });

  it('quads opacos seguidos da mesma cor viram um só fill, sem stroke; translúcidos misturam um a um', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const r = new Soft3DRenderer();
    const cam = new OrbitCamera(1);
    cam.target = [0.5, 0, 0.5];
    cam.pitch = 1.2;
    const quad = (y: number, rgb: [number, number, number]) =>
      buildMesh(
        new Float32Array([0, y, 0, 0, y, 1, 1, y, 1, 1, y, 0]),
        new Uint32Array([0, 1, 2, 3]),
        new Uint8Array(rgb),
        true,
      );
    const fill = vi.spyOn(ctx, 'fill');
    const stroke = vi.spyOn(ctx, 'stroke');
    const same = [0, 0.1, 0.2].map((y) => ({ mesh: quad(y, [10, 20, 30]) }));
    r.render(ctx, 400, 300, cam.matrix(4 / 3), same);
    expect(fill).toHaveBeenCalledTimes(1);
    // Sem traço: a costura entre vizinhos some com o quad levemente inflado.
    expect(stroke).not.toHaveBeenCalled();

    // Duas cores intercaladas em profundidade: um fill por troca de cor.
    fill.mockClear();
    const mixed = [
      { mesh: quad(0, [200, 0, 0]) },
      { mesh: quad(0.1, [0, 200, 0]) },
      { mesh: quad(0.2, [200, 0, 0]) },
    ];
    r.render(ctx, 400, 300, cam.matrix(4 / 3), mixed);
    expect(fill).toHaveBeenCalledTimes(3);

    // Translúcidos: numa só passada a sobreposição não somaria, então cada quad mistura sozinho.
    fill.mockClear();
    const glass = [0, 0.1, 0.2].map((y) => ({ mesh: quad(y, [10, 20, 30]), alpha: 0.5 }));
    r.render(ctx, 400, 300, cam.matrix(4 / 3), glass);
    expect(fill).toHaveBeenCalledTimes(3);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('o quad desenhado é um pouco maior que o projetado (cobre as costuras)', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const r = new Soft3DRenderer();
    const cam = new OrbitCamera(1);
    cam.target = [0.5, 0, 0.5];
    cam.pitch = 1.5;
    const m = cam.matrix(4 / 3);
    const corners = [
      projectPoint(m, 0, 0, 0, 400, 300),
      projectPoint(m, 0, 0, 1, 400, 300),
      projectPoint(m, 1, 0, 1, 400, 300),
      projectPoint(m, 1, 0, 0, 400, 300),
    ];
    const move = vi.spyOn(ctx, 'moveTo');
    r.render(ctx, 400, 300, m, [{ mesh: top }]);
    const [x, y] = move.mock.calls[0] as [number, number];
    const first = corners[0];
    // Empurrado para fora (o centro do quad fica no meio), por menos de 1 px.
    const cx = corners.reduce((a, c) => a + c.x, 0) / 4;
    const cy = corners.reduce((a, c) => a + c.y, 0) / 4;
    expect(Math.hypot(x - cx, y - cy)).toBeGreaterThan(
      Math.hypot((first?.x ?? 0) - cx, (first?.y ?? 0) - cy),
    );
    expect(Math.hypot(x - (first?.x ?? 0), y - (first?.y ?? 0))).toBeLessThan(1);
  });

  it('yOffset desloca malha, linhas e pontos na vertical', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const r = new Soft3DRenderer();
    const cam = new OrbitCamera(1);
    cam.target = [0.5, 0, 0.5];
    cam.pitch = 1.2;
    const m = cam.matrix(4 / 3);
    const firstMove = (offset: number) => {
      const move = vi.spyOn(ctx, 'moveTo');
      const rect = vi.spyOn(ctx, 'fillRect');
      r.render(
        ctx,
        400,
        300,
        m,
        [{ mesh: top, yOffset: offset }],
        [
          {
            positions: new Float32Array([0, 0, 0, 1, 0, 1]),
            segments: new Uint32Array([0, 1]),
            color: '#fff',
            width: 1,
            yOffset: offset,
          },
        ],
        [{ positions: new Float32Array([0.5, 0, 0.5]), color: '#fff', size: 2, yOffset: offset }],
      );
      const out = {
        quadY: (move.mock.calls[0] as number[])[1] as number,
        lineY: (move.mock.calls[1] as number[])[1] as number,
        pointY: (rect.mock.calls[0] as number[])[1] as number,
      };
      move.mockRestore();
      rect.mockRestore();
      return out;
    };
    const base = firstMove(0);
    const up = firstMove(0.4);
    // Visto de cima, subir no mundo leva o ponto para o topo da tela (y menor).
    expect(up.quadY).toBeLessThan(base.quadY);
    expect(up.lineY).toBeLessThan(base.lineY);
    expect(up.pointY).toBeLessThan(base.pointY);
  });

  it('pickSector: o topo sob o cursor; o mais próximo quando sobrepostos', () => {
    const cam = new OrbitCamera(2);
    cam.pitch = 1.5;
    cam.yaw = 0;
    const m = cam.matrix(1);
    const sq = (id: string, x: number, z: number, y = 0) => ({
      id,
      corners: [
        [x, y, z],
        [x, y, z + 1],
        [x + 1, y, z + 1],
        [x + 1, y, z],
      ] as Array<[number, number, number]>,
    });
    const targets = [sq('A', -0.5, -0.5), sq('B', 2, 2)];
    const center = projectPoint(m, 0, 0, 0, 500, 500);
    expect(pickSector(center.x, center.y, targets, m, 500, 500)).toBe('A');
    expect(pickSector(5, 5, targets, m, 500, 500)).toBeNull();
    // Mais alto (mais perto da câmera de cima) vence.
    expect(
      pickSector(center.x, center.y, [...targets, sq('C', -0.5, -0.5, 0.3)], m, 500, 500),
    ).toBe('C');
  });
});
