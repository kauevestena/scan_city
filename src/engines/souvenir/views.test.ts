import { SOUVENIRS } from '@/data/souvenirs';
import type { Souvenir, SouvenirFace } from '@/types';
import {
  faceText,
  isClosedSpread,
  souvenirViews,
  viewFaces,
  viewLabel,
  viewText,
  visibleFaces,
} from './views';

const notebook = SOUVENIRS.find((s) => s.id === 'SV_NOTEBOOK') as Souvenir;

describe('vistas do exame (office §5.1)', () => {
  it('caderno de 14 páginas: a capa fechada, 6 páginas duplas e a contracapa fechada', () => {
    const views = souvenirViews('BOOK', 14);
    expect(views).toHaveLength(8);
    expect(views[0]).toEqual({ kind: 'SPREAD', left: null, right: 0 });
    expect(views[1]).toEqual({ kind: 'SPREAD', left: 1, right: 2 });
    expect(views[6]).toEqual({ kind: 'SPREAD', left: 11, right: 12 });
    expect(views[7]).toEqual({ kind: 'SPREAD', left: 13, right: null });
    expect(views.filter(isClosedSpread)).toHaveLength(2);
    expect(viewFaces(views[3] as (typeof views)[number])).toEqual([5, 6]);
  });

  it('objeto: uma face por vista', () => {
    expect(souvenirViews('OBJECT', 3)).toEqual([
      { kind: 'SINGLE', face: 0 },
      { kind: 'SINGLE', face: 1 },
      { kind: 'SINGLE', face: 2 },
    ]);
    expect(isClosedSpread({ kind: 'SINGLE', face: 0 })).toBe(false);
  });

  it('a contracapa da caderneta troca o bolso pela carta depois do final', () => {
    const before = visibleFaces(notebook, false);
    const after = visibleFaces(notebook, true);
    expect(before).toHaveLength(14);
    expect(after).toHaveLength(14);
    expect(before.map((f) => f.label)).toContain('O bolso');
    expect(after.map((f) => f.label)).toContain('A carta do Vô');
    expect(after.map((f) => f.label)).not.toContain('O bolso');
    // Os outros souvenirs não mudam.
    const key = SOUVENIRS.find((s) => s.id === 'SV_CITY_KEY') as Souvenir;
    expect(visibleFaces(key, true)).toEqual(key.faces);
  });

  it('rótulo e texto da vista: as duas páginas, com tabela, esboço, assinatura e carimbo', () => {
    const faces = visibleFaces(notebook, false);
    const views = souvenirViews('BOOK', faces.length);
    const spread = views[2] as (typeof views)[number];
    expect(viewLabel(faces, spread)).toBe('Poligonal do sítio · Croqui do sítio');
    const text = viewText(faces, spread);
    expect(text).toContain('E2, E3, 92°05\'10", 98,12, vaca');
    expect(text).toContain('Esboço com: E1, E2, E3, E4, casa');
    const card: SouvenirFace = {
      label: 'Certificado',
      surface: 'CARD',
      blocks: [
        { type: 'FIELDS', rows: [['Massa', '312 g']] },
        { type: 'SIGNATURE', text: 'Aurélio' },
        { type: 'STAMP', text: 'CONFERE' },
        { type: 'GAP', size: 10 },
        { type: 'LIST', ordered: true, items: ['um', '~~dois~~'] },
      ],
    };
    expect(faceText(card)).toBe(
      'Certificado. Massa: 312 g Assinado: Aurélio. Carimbo: CONFERE. 1. um 2. [riscado: dois]',
    );
  });
});
