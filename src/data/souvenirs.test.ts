import { gsd } from '@/domain/photogrammetry';
import type { SouvenirBlock, SouvenirFace } from '@/types';
import { NOTEBOOK_FACES } from './grandpaNotebook';
import { FINALE_LETTER } from './office';
import { SOUVENIRS } from './souvenirs';

const blocks = (faces: readonly SouvenirFace[]) => faces.flatMap((f) => f.blocks);
const tables = (faces: readonly SouvenirFace[]) =>
  blocks(faces).filter((b): b is Extract<SouvenirBlock, { type: 'TABLE' }> => b.type === 'TABLE');

describe('souvenirs de verdade: formas e faces (catalog §11.1, ADR-036)', () => {
  it('os 18 têm forma e faces; a primeira é o objeto (ou a capa), e há o que ler em todos', () => {
    expect(SOUVENIRS).toHaveLength(18);
    for (const sv of SOUVENIRS) {
      expect(sv.faces.length, sv.id).toBeGreaterThanOrEqual(2);
      expect(sv.faces[0]?.surface, sv.id).toBe(sv.form === 'BOOK' ? 'COVER' : 'OBJECT');
      expect(
        blocks(sv.faces).some((b) => b.type === 'TEXT' || b.type === 'TITLE'),
        sv.id,
      ).toBe(true);
      // O rótulo é a seed do desenho: duas faces com o mesmo rótulo sairiam iguais.
      const labels = sv.faces.map((f) => f.label);
      expect(new Set(labels).size, sv.id).toBe(labels.length);
    }
  });

  it('só a caderneta é um caderno: 14 páginas, da capa à contracapa, nas duas versões', () => {
    expect(SOUVENIRS.filter((s) => s.form === 'BOOK').map((s) => s.id)).toEqual(['SV_NOTEBOOK']);
    for (const when of ['BEFORE_FINALE', 'AFTER_FINALE'] as const) {
      const pages = NOTEBOOK_FACES.filter((f) => f.when === undefined || f.when === when);
      expect(pages, when).toHaveLength(14);
      expect(pages[0]?.surface).toBe('COVER');
      expect(pages.at(-1)?.surface).toBe('BACK_COVER');
      expect(pages.slice(1, -1).every((p) => p.surface === 'PAGE')).toBe(true);
    }
  });

  it('a carta do Vô, depois do final, é o texto canônico (contracts-real §3)', () => {
    const letter = NOTEBOOK_FACES.find((f) => f.when === 'AFTER_FINALE');
    expect(blocks(letter ? [letter] : [])).toContainEqual(
      expect.objectContaining({ type: 'TEXT', text: FINALE_LETTER }),
    );
  });

  it('as tabelas fecham: frações que somam 1 e uma célula por coluna', () => {
    for (const sv of SOUVENIRS) {
      for (const table of tables(sv.faces)) {
        expect(table.widths.reduce((a, w) => a + w, 0)).toBeCloseTo(1, 9);
        expect(table.widths).toHaveLength(table.columns.length);
        for (const row of table.rows) expect(row).toHaveLength(table.columns.length);
      }
    }
  });
});

describe('o Vô fazia as contas certas', () => {
  it('a poligonal do sítio fecha: os ângulos internos somam (4 − 2) · 180° = 360°00\'00"', () => {
    const table = tables(NOTEBOOK_FACES).find((t) => t.columns.includes('Ângulo'));
    const column = table?.columns.indexOf('Ângulo') ?? -1;
    const seconds = (table?.rows ?? []).map((row) => {
      const m = /^(\d+)°(\d+)'(\d+)"$/.exec(row[column] ?? '');
      if (!m) throw new Error(`ângulo ilegível: ${row[column]}`);
      return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    });
    expect(seconds).toHaveLength(4);
    expect(seconds.reduce((a, s) => a + s, 0)).toBe(360 * 3600);
  });

  it('a conta do GSD da página dos moços do drone é a do domínio (domain-math §1)', () => {
    const page = NOTEBOOK_FACES.find((f) => f.label === 'Os moços do drone');
    const text = blocks(page ? [page] : [])
      .map((b) => ('text' in b ? b.text : ''))
      .join(' ')
      .replace(/\u00a0/g, ' ');
    expect(text).toContain('H = 100 m, pixel de 4,4 µm, f = 8,8 mm: GSD = 5 cm');
    expect(gsd(100, 4.4e-6, 8.8e-3)).toBeCloseTo(0.05, 12);
  });
});
