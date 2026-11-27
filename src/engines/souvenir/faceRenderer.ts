/**
 * Desenha uma face de souvenir no tamanho lógico da superfície (o chamador escala o contexto):
 * o objeto, a capa ou o papel; os blocos na área útil; e as marcas do uso por cima. A seed é o
 * id do souvenir e o rótulo da face (ADR-036): a mesma face sai sempre igual.
 */
import { hashString, mulberry32 } from '@/lib/rng';
import type { Souvenir, SouvenirFace } from '@/types';
import { layoutBlocks, type BlockLayout } from './blocks';
import { drawNotebookCover, drawObject } from './objects';
import { drawDecor, drawPaper, SURFACE_SIZE, type Box } from './paper';

export function faceSize(face: SouvenirFace): { w: number; h: number } {
  return SURFACE_SIZE[face.surface];
}

/** A seed de uma face. */
export function faceSeed(souvenirId: string, face: SouvenirFace): number {
  return hashString(`${souvenirId}:${face.label}`);
}

/**
 * Desenha a face `index` de `faces` (as visíveis) em (0, 0), no tamanho lógico. Devolve o
 * arranjo dos blocos (para os testes conferirem que o texto coube), ou `null` sem blocos.
 */
export function renderFace(
  ctx: CanvasRenderingContext2D,
  souvenir: Souvenir,
  faces: readonly SouvenirFace[],
  index: number,
): BlockLayout | null {
  const face = faces[index];
  if (!face) return null;
  const rng = mulberry32(faceSeed(souvenir.id, face));
  const { w, h } = faceSize(face);
  let content: Box | null;
  ctx.save();
  if (face.surface === 'OBJECT') {
    // O lado do objeto: quantas faces de objeto vêm antes desta.
    const side = faces.slice(0, index).filter((f) => f.surface === 'OBJECT').length;
    content = drawObject(ctx, souvenir.id, { x: 0, y: 0, w, h }, side, rng.fork('object'));
  } else if (face.surface === 'COVER' || face.surface === 'BACK_COVER') {
    content = drawNotebookCover(ctx, face.surface === 'BACK_COVER', rng.fork('cover'));
  } else {
    content = drawPaper(ctx, face.surface, rng.fork('paper'), face.paper);
  }
  ctx.restore();
  let layout: BlockLayout | null = null;
  if (content && face.blocks.length > 0) {
    ctx.save();
    layout = layoutBlocks(ctx, face.blocks, content, {
      surface: face.surface,
      ...(face.paper ? { paper: face.paper } : {}),
      rng: rng.fork('blocks'),
    });
    layout.draw();
    ctx.restore();
  }
  for (const decor of face.decor ?? []) drawDecor(ctx, decor, w, h, rng.fork(decor));
  return layout;
}

/** As miniaturas dão um zoom no objeto: o desenho tem margem para a sombra e a flutuação. */
const THUMB_ZOOM = 1.22;

/**
 * A primeira face (o objeto ou a capa) ajustada à caixa: a miniatura da grade, do card do
 * relatório e da estante da sala.
 */
export function drawSouvenirFront(
  ctx: CanvasRenderingContext2D,
  souvenir: Souvenir,
  box: Box,
): void {
  const face = souvenir.faces[0];
  if (!face) return;
  const { w, h } = faceSize(face);
  const zoom = face.surface === 'OBJECT' ? THUMB_ZOOM : 1;
  const u = Math.min(box.w / w, box.h / h) * zoom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.translate(box.x + (box.w - w * u) / 2, box.y + (box.h - h * u) / 2);
  ctx.scale(u, u);
  renderFace(ctx, souvenir, souvenir.faces, 0);
  ctx.restore();
}
