import { SOUVENIRS } from '@/data/souvenirs';
import { mulberry32 } from '@/lib/rng';
import { canvasContext, measureByFont } from '@/test/fakeFonts';
import type { Souvenir } from '@/types';
import { layoutBlocks } from './blocks';
import { drawSouvenirFront, renderFace } from './faceRenderer';
import { handFont, resetHandFont } from './hand';
import { drawObject, OBJECT_DRAWINGS } from './objects';
import { paperContent, RULE_FIRST_Y, RULE_STEP, SURFACE_SIZE } from './paper';
import { SKETCH_LABELS } from './sketches';
import { visibleFaces } from './views';

const events = (ctx: CanvasRenderingContext2D) =>
  JSON.stringify((ctx as unknown as { __getEvents(): unknown[] }).__getEvents());

/** As faces das duas versões da caderneta (antes e depois do final), sem repetir. */
function allFaces(souvenir: Souvenir) {
  const before = visibleFaces(souvenir, false);
  const after = visibleFaces(souvenir, true);
  const out = before.map((face, index) => ({ faces: before, index, face }));
  after.forEach((face, index) => {
    if (!before.includes(face)) out.push({ faces: after, index, face });
  });
  return out;
}

afterEach(() => resetHandFont());

describe('cada face cabe no papel, mesmo com uma letra manuscrita larga (ADR-036)', () => {
  for (const souvenir of SOUVENIRS) {
    for (const { faces, index, face } of allFaces(souvenir)) {
      if (face.blocks.length === 0) continue;
      it(`${souvenir.id} · ${face.label}`, () => {
        const ctx = canvasContext();
        // 0,56 em por letra: mais larga que a serifada itálica e que a Segoe Print já ajustada.
        measureByFont(ctx, 0.56);
        const layout = renderFace(ctx, souvenir, faces, index);
        expect(layout?.overflow, `${souvenir.id} · ${face.label}`).toBe(false);
      });
    }
  }

  it('com uma letra comum, as páginas pautadas assentam na pauta e na escala cheia', () => {
    const notebook = SOUVENIRS.find((s) => s.id === 'SV_NOTEBOOK') as Souvenir;
    const ruled = visibleFaces(notebook, false).filter(
      (f) => f.surface === 'PAGE' && (f.paper ?? 'RULED') === 'RULED',
    );
    expect(ruled.length).toBeGreaterThanOrEqual(5);
    for (const face of ruled) {
      const ctx = canvasContext();
      measureByFont(ctx, 0.45);
      const layout = layoutBlocks(ctx, face.blocks, paperContent('PAGE'), {
        surface: 'PAGE',
        paper: 'RULED',
        rng: mulberry32(1),
      });
      expect(layout.ruled, face.label).toBe(true);
      expect(layout.overflow, face.label).toBe(false);
    }
  });

  it('na pauta, cada linha de texto assenta numa linha da página', () => {
    const ctx = canvasContext();
    measureByFont(ctx, 0.45);
    const fill = vi.spyOn(ctx, 'fillText');
    layoutBlocks(
      ctx,
      [
        { type: 'TITLE', text: 'Amanhã' },
        { type: 'TEXT', text: 'Ensinar o neto a nivelar o tripé. Paciência: ele puxou a mim.' },
      ],
      paperContent('PAGE'),
      { surface: 'PAGE', paper: 'RULED', rng: mulberry32(2) },
    ).draw();
    // Cada letra gira em torno do próprio centro: o `translate` dela leva a linha de base, com o
    // tremor da letra e a ondulação da linha (alguns px). A linha de base fica 2 px acima da pauta.
    const ys = vi.mocked(ctx.translate).mock.calls.map(([, y]) => y + 2);
    expect(fill).toHaveBeenCalled();
    expect(ys.length).toBeGreaterThan(20);
    for (const y of ys) {
      const r = (((y - RULE_FIRST_Y) % RULE_STEP) + RULE_STEP) % RULE_STEP;
      expect(Math.min(r, RULE_STEP - r)).toBeLessThan(4.5);
    }
    // E o texto ocupa mais de uma linha da pauta.
    expect(
      new Set(ys.map((y) => Math.round((y - RULE_FIRST_Y) / RULE_STEP))).size,
    ).toBeGreaterThanOrEqual(2);
  });

  it('sem caber nem a 70 %, o arranjo avisa o transbordo', () => {
    const ctx = canvasContext();
    measureByFont(ctx, 0.5);
    const layout = layoutBlocks(
      ctx,
      Array.from({ length: 40 }, () => ({
        type: 'TEXT' as const,
        text: 'linha comprida '.repeat(6),
      })),
      { x: 0, y: 0, w: 200, h: 200 },
      { surface: 'NOTE', rng: mulberry32(3) },
    );
    expect(layout.scale).toBe(0.7);
    expect(layout.overflow).toBe(true);
  });
});

describe('os desenhos', () => {
  it('todo souvenir-objeto tem desenho, e todo esboço recebe os rótulos que posiciona', () => {
    for (const souvenir of SOUVENIRS) {
      if (souvenir.form === 'OBJECT')
        expect(OBJECT_DRAWINGS[souvenir.id], souvenir.id).toBeDefined();
      for (const face of souvenir.faces) {
        for (const block of face.blocks) {
          if (block.type !== 'SKETCH') continue;
          expect(block.labels?.length ?? 0, `${souvenir.id} · ${block.sketch}`).toBe(
            SKETCH_LABELS[block.sketch],
          );
        }
      }
    }
  });

  it('cada face sai igual toda vez (seed do souvenir e da face)', () => {
    // A detecção da fonte acontece uma vez só: fora das comparações.
    handFont(canvasContext());
    for (const souvenir of SOUVENIRS) {
      const faces = visibleFaces(souvenir, true);
      faces.forEach((_, index) => {
        const a = canvasContext();
        const b = canvasContext();
        renderFace(a, souvenir, faces, index);
        renderFace(b, souvenir, faces, index);
        expect(events(a), `${souvenir.id} #${index}`).toBe(events(b));
      });
    }
  });

  it('o verso do azulejo e o fundo da caixa devolvem a área do texto, dentro do objeto', () => {
    const box = { x: 0, y: 0, ...SURFACE_SIZE.OBJECT };
    for (const id of ['SV_TILE', 'SV_CARDBOARD_BOX']) {
      expect(drawObject(canvasContext(), id, box, 0, mulberry32(1)), `${id} frente`).toBeNull();
      const area = drawObject(canvasContext(), id, box, 1, mulberry32(1));
      expect(area, id).not.toBeNull();
      if (!area) continue;
      expect(area.x).toBeGreaterThan(box.x);
      expect(area.y).toBeGreaterThan(box.y);
      expect(area.x + area.w).toBeLessThan(box.x + box.w);
      expect(area.y + area.h).toBeLessThan(box.y + box.h);
    }
    // Sem desenho para o id, nada é desenhado.
    const ctx = canvasContext();
    expect(drawObject(ctx, 'SV_NOPE', box, 0, mulberry32(1))).toBeNull();
    expect(events(ctx)).toBe('[]');
  });

  it('a miniatura recorta o desenho na caixa pedida', () => {
    const ctx = canvasContext();
    const clip = vi.spyOn(ctx, 'rect');
    drawSouvenirFront(ctx, SOUVENIRS[0] as Souvenir, { x: 4, y: 6, w: 40, h: 40 });
    expect(clip).toHaveBeenCalledWith(4, 6, 40, 40);
  });
});
