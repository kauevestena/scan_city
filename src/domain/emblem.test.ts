import { DEFAULT_EMBLEM } from '@/state/slices/inventorySlice';
import {
  EMBLEM_ICONS,
  EMBLEM_SHAPES,
  MAX_INITIALS,
  sanitizeInitials,
  validInitials,
  withInitials,
} from './emblem';

describe('sigla do emblema (catalog §10)', () => {
  it('fica em maiúsculas, com no máximo 4 caracteres, só letras e números', () => {
    expect(MAX_INITIALS).toBe(4);
    expect(sanitizeInitials('gs')).toBe('GS');
    expect(sanitizeInitials('geosurvey')).toBe('GEOS');
    expect(sanitizeInitials('a-b c!1')).toBe('ABC1');
    expect(sanitizeInitials('çã')).toBe('ÇÃ');
    expect(sanitizeInitials('  ')).toBe('');
  });

  it('válida de 1 a 4 caracteres já saneados', () => {
    expect(validInitials('GS')).toBe(true);
    expect(validInitials('ABCD')).toBe(true);
    expect(validInitials('')).toBe(false);
    expect(validInitials('ABCDE')).toBe(false);
    expect(validInitials('gs')).toBe(false);
    expect(validInitials('A B')).toBe(false);
  });

  it('withInitials só troca a sigla', () => {
    expect(withInitials(DEFAULT_EMBLEM, 'scan city')).toEqual({
      ...DEFAULT_EMBLEM,
      initials: 'SCAN',
    });
  });

  it('4 formas e 8 ícones no editor', () => {
    expect(EMBLEM_SHAPES).toEqual(['SHIELD', 'CIRCLE', 'HEXAGON', 'DIAMOND']);
    expect(EMBLEM_ICONS).toHaveLength(8);
    expect(new Set(EMBLEM_ICONS).size).toBe(8);
  });
});
