/** Regras do editor de emblema da empresa (catalog §10, REQ-PRG-008). */
import type { Emblem, EmblemIcon, EmblemShape } from '@/types';

export const EMBLEM_SHAPES: readonly EmblemShape[] = ['SHIELD', 'CIRCLE', 'HEXAGON', 'DIAMOND'];
export const EMBLEM_ICONS: readonly EmblemIcon[] = [
  'Compass',
  'Map',
  'Mountain',
  'Plane',
  'Bird',
  'Satellite',
  'Ruler',
  'Globe',
];
export const MAX_INITIALS = 4;

/** Sigla válida: maiúsculas e números, no máximo 4. Tira o que não for letra ou número. */
export function sanitizeInitials(raw: string): string {
  return raw
    .toLocaleUpperCase('pt-BR')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, MAX_INITIALS);
}

/** A sigla pode ser gravada? De 1 a 4 caracteres já saneados. */
export function validInitials(initials: string): boolean {
  return (
    initials.length >= 1 &&
    initials.length <= MAX_INITIALS &&
    initials === sanitizeInitials(initials)
  );
}

/** Emblema com a sigla saneada (a forma, o ícone e as cores seguem como estão). */
export function withInitials(emblem: Emblem, raw: string): Emblem {
  return { ...emblem, initials: sanitizeInitials(raw) };
}
