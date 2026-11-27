import { SOUVENIRS } from '@/data/souvenirs';
import { canvasContext } from '@/test/fakeFonts';
import type { Souvenir } from '@/types';
import {
  drawDesk,
  easeInOut,
  FADE_S,
  OBJECT_TURN_S,
  PAGE_TURN_S,
  SouvenirScene,
  type SceneOptions,
} from './scene';
import { visibleFaces } from './views';

const notebook = SOUVENIRS.find((s) => s.id === 'SV_NOTEBOOK') as Souvenir;
const key = SOUVENIRS.find((s) => s.id === 'SV_CITY_KEY') as Souvenir;
const INSETS = { top: 80, bottom: 120, side: 20 };

function sceneOf(souvenir: Souvenir, options: Partial<SceneOptions> = {}) {
  const onFlipStart = vi.fn();
  const scene = new SouvenirScene(souvenir, visibleFaces(souvenir, false), {
    reducedMotion: false,
    insets: INSETS,
    onFlipStart,
    ...options,
  });
  return { scene, onFlipStart };
}

/** As chamadas de `drawImage` com destino (x, y, w, h) de um quadro. */
function frame(scene: SouvenirScene, timeS: number, w = 1280, h = 720) {
  const ctx = canvasContext();
  const draw = vi.spyOn(ctx, 'drawImage');
  scene.render(ctx, w, h, 1, timeS);
  return draw.mock.calls.map((c) => c.slice(1, 5) as number[]);
}

describe('virar (ADR-036)', () => {
  it('um pedido começa a virada; outro fica guardado; o terceiro espera', () => {
    const { scene, onFlipStart } = sceneOf(notebook);
    expect(scene.views).toHaveLength(8);
    expect(scene.request(1, 0)).toBe(true);
    expect(onFlipStart).toHaveBeenCalledTimes(1);
    expect(scene.turning).toBe(true);
    expect(scene.request(2, 0.1)).toBe(true);
    expect(scene.request(3, 0.2)).toBe(false);
    expect(scene.target).toBe(2);
    expect(scene.view).toBe(0);
    // Termina a primeira: a guardada começa na hora.
    scene.update(PAGE_TURN_S);
    expect(scene.view).toBe(1);
    expect(scene.turning).toBe(true);
    expect(onFlipStart).toHaveBeenCalledTimes(2);
    scene.update(PAGE_TURN_S * 2 + 0.01);
    expect(scene.view).toBe(2);
    expect(scene.turning).toBe(false);
  });

  it('fora da lista, para a mesma vista ou repetindo a virada em curso, não aceita', () => {
    const { scene } = sceneOf(notebook);
    expect(scene.request(-1, 0)).toBe(false);
    expect(scene.request(8, 0)).toBe(false);
    expect(scene.request(0, 0)).toBe(false);
    scene.request(1, 0);
    expect(scene.request(1, 0.1)).toBe(false);
  });

  it('a duração: página, objeto e, com movimento reduzido, o esmaecimento', () => {
    const page = sceneOf(notebook).scene;
    page.request(1, 0);
    page.update(PAGE_TURN_S - 0.01);
    expect(page.turning).toBe(true);
    const object = sceneOf(key).scene;
    object.request(1, 0);
    object.update(OBJECT_TURN_S);
    expect(object.view).toBe(1);
    const reduced = sceneOf(key, { reducedMotion: true }).scene;
    reduced.request(1, 0);
    reduced.update(FADE_S);
    expect(reduced.view).toBe(1);
    // O objeto flutua (precisa de quadros); com movimento reduzido, não.
    expect(object.animating).toBe(true);
    expect(reduced.animating).toBe(false);
  });

  it('easeInOut vai de 0 a 1 passando por 0,5 no meio', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
  });
});

describe('o desenho da cena', () => {
  it('fechado, o caderno fica no centro; aberto, a lombada vai ao centro', () => {
    const { scene } = sceneOf(notebook);
    // A mesa ocupa o canvas inteiro; depois, a capa.
    const closed = frame(scene, 0);
    expect(closed[0]).toEqual([0, 0, 1280, 720]);
    const cover = closed.at(-1) as number[];
    const [x = 0, , w = 0] = cover;
    expect(x + w / 2).toBeCloseTo(640, 0);
    scene.request(1, 0);
    scene.update(1);
    const open = frame(scene, 1);
    // As duas páginas: a da esquerda termina e a da direita começa na lombada, no centro.
    const pages = open.filter(([, , pw]) => Math.abs((pw ?? 0) - w) < 1);
    const left = pages.find(([px = 0]) => px < 640);
    const right = pages.find(([px = 0]) => px >= 640);
    expect((left?.[0] ?? 0) + (left?.[2] ?? 0)).toBeCloseTo(640, 0);
    expect(right?.[0]).toBeCloseTo(640, 0);
  });

  it('no meio da virada, a folha fica estreita, colada na lombada', () => {
    const { scene } = sceneOf(notebook);
    // O tamanho da página: o da capa fechada (o último desenho do quadro).
    const [, , pageW = 0, pageH = 0] = frame(scene, 0).at(-1) as number[];
    scene.request(1, 0);
    scene.update(1);
    scene.request(2, 2);
    const mid = frame(scene, 2 + PAGE_TURN_S * 0.45);
    // A folha que vira "levanta" (até 6 % mais alta que a página) e estreita, a partir da lombada;
    // a mesa (o primeiro desenho) e a sombra borrada (bem mais alta) ficam de fora.
    const leaf = mid.slice(1).find(([, , , lh = 0]) => lh > pageH + 1 && lh < pageH * 1.07);
    expect(leaf).toBeDefined();
    const [lx = 0, , lw = 0] = leaf ?? [];
    expect(lw).toBeGreaterThan(0.5);
    expect(lw).toBeLessThan(pageW * 0.6);
    expect(lx).toBeCloseTo(640, 0);
  });

  it('com movimento reduzido, as duas vistas se sobrepõem por transparência', () => {
    const { scene } = sceneOf(key, { reducedMotion: true });
    scene.request(1, 0);
    const ctx = canvasContext();
    const alphas: number[] = [];
    vi.spyOn(ctx, 'drawImage').mockImplementation(() => void alphas.push(ctx.globalAlpha));
    scene.render(ctx, 1280, 720, 1, FADE_S / 2);
    // A mesa, a face que sai e a que entra (com a sombra de papel da etiqueta).
    expect(alphas[0]).toBe(1);
    expect(alphas.some((a) => a > 0 && a < 1)).toBe(true);
  });

  it('parada, a cena prepara as faces vizinhas, uma por quadro, até acabar', () => {
    const { scene } = sceneOf(key);
    frame(scene, 0);
    expect(scene.idle(1280, 720, 1)).toBe(false);
    const book = sceneOf(notebook).scene;
    frame(book, 0);
    // A capa já foi feita; a vista seguinte tem duas páginas (uma delas preparada no quadro).
    expect(book.idle(1280, 720, 1)).toBe(true);
    expect(book.idle(1280, 720, 1)).toBe(false);
  });

  it('a mesa: tábuas, a luz do abajur e a vinheta', () => {
    const ctx = canvasContext();
    const gradients = vi.spyOn(ctx, 'createRadialGradient');
    drawDesk(ctx, 800, 600);
    expect(gradients).toHaveBeenCalledTimes(2);
  });
});
