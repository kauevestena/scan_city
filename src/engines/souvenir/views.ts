/**
 * As vistas do exame (office §5.1): no caderno, a capa fechada, as páginas duplas e a contracapa
 * fechada (com `P` páginas, `P/2 + 1` vistas); no objeto, uma face por vista. E o texto de cada
 * vista para o leitor de tela.
 */
import { STRINGS } from '@/data/strings';
import type { Souvenir, SouvenirBlock, SouvenirFace, SouvenirForm } from '@/types';
import { plainText } from './hand';

/** As faces que existem agora: a contracapa da caderneta muda depois do final. */
export function visibleFaces(souvenir: Souvenir, finaleSeen: boolean): SouvenirFace[] {
  return souvenir.faces.filter(
    (f) => f.when === undefined || (f.when === 'AFTER_FINALE') === finaleSeen,
  );
}

/** Índices em `visibleFaces`. */
export type SouvenirView =
  { kind: 'SINGLE'; face: number } | { kind: 'SPREAD'; left: number | null; right: number | null };

export function souvenirViews(form: SouvenirForm, faceCount: number): SouvenirView[] {
  if (form === 'OBJECT') {
    return Array.from({ length: faceCount }, (_, face) => ({ kind: 'SINGLE', face }));
  }
  const views: SouvenirView[] = [];
  for (let v = 0; v <= faceCount / 2; v++) {
    const left = 2 * v - 1;
    const right = 2 * v;
    views.push({
      kind: 'SPREAD',
      left: left >= 0 && left < faceCount ? left : null,
      right: right < faceCount ? right : null,
    });
  }
  return views;
}

/** As faces de uma vista, da esquerda para a direita. */
export function viewFaces(view: SouvenirView): number[] {
  if (view.kind === 'SINGLE') return [view.face];
  return [view.left, view.right].filter((f): f is number => f !== null);
}

/** A vista do caderno está fechada (só a capa ou só a contracapa). */
export function isClosedSpread(view: SouvenirView): boolean {
  return view.kind === 'SPREAD' && (view.left === null || view.right === null);
}

export function viewLabel(faces: readonly SouvenirFace[], view: SouvenirView): string {
  return viewFaces(view)
    .map((i) => faces[i]?.label ?? '')
    .join(' · ');
}

const S = STRINGS.souvenirViewer.reader;

function blockText(block: SouvenirBlock): string {
  switch (block.type) {
    case 'TITLE':
    case 'TEXT':
      return plainText(block.text);
    case 'LIST':
      return block.items
        .map((item, i) => `${block.ordered ? `${i + 1}.` : '•'} ${plainText(item)}`)
        .join(' ');
    case 'TABLE':
      return [block.columns, ...block.rows].map((row) => row.join(', ')).join('; ');
    case 'FIELDS':
      return block.rows.map(([label, value]) => `${label}: ${plainText(value)}`).join('; ');
    case 'SKETCH':
      return S.sketch((block.labels ?? []).join(', '));
    case 'SIGNATURE':
      return S.signature(block.text);
    case 'STAMP':
      return S.stamp(block.text);
    case 'GAP':
      return '';
  }
}

/** O texto de uma face, como frases: o que a região viva lê. */
export function faceText(face: SouvenirFace): string {
  const parts = face.blocks.map(blockText).filter((t) => t !== '');
  return [`${face.label}.`, ...parts].join(' ');
}

export function viewText(faces: readonly SouvenirFace[], view: SouvenirView): string {
  return viewFaces(view)
    .map((i) => (faces[i] ? faceText(faces[i]) : ''))
    .join(' ');
}
