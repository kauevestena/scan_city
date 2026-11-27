/**
 * Os blocos de uma face (catalog §11.1) dispostos na área útil do papel. Na página pautada, cada
 * linha de texto assenta numa linha da pauta. Se o conteúdo não cabe (as fontes manuscritas têm
 * larguras muito diferentes), a letra encolhe em passos de 5 %, até 70 %; e, na pautada, por
 * último, a letra deixa a pauta.
 */
import type { Rng } from '@/lib/rng';
import type { SouvenirBlock, SouvenirInk, SouvenirPaper, SouvenirSurface } from '@/types';
import {
  charMeasure,
  drawLine,
  fontFor,
  handStroke,
  INKS,
  parseMarkup,
  wrapSpans,
  type InkStyle,
  type Line,
  type Measure,
} from './hand';
import { RULE_STEP, type Box } from './paper';
import { drawSketch } from './sketches';

/** Tinta padrão de cada superfície. */
export function defaultInk(surface: SouvenirSurface): SouvenirInk {
  if (surface === 'CARD') return 'PRINT';
  if (surface === 'PLAQUE') return 'ENGRAVED';
  return 'INK';
}

const CENTERED: ReadonlySet<SouvenirSurface> = new Set([
  'TAG',
  'CARD',
  'LABEL',
  'PLAQUE',
  'COVER',
  'BACK_COVER',
  'OBJECT',
]);
const MIDDLE: ReadonlySet<SouvenirSurface> = new Set(['PLAQUE', 'COVER', 'BACK_COVER', 'OBJECT']);

const TEXT_PX = { SM: 16, MD: 19, LG: 24 } as const;
const SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7];

interface Op {
  h: number;
  draw: (top: number) => void;
}

export interface BlockOptions {
  surface: SouvenirSurface;
  paper?: SouvenirPaper;
  rng: Rng;
}

export interface BlockLayout {
  /** Escala da letra que coube (1 = o tamanho nominal). */
  scale: number;
  /** Se as linhas assentam na pauta. */
  ruled: boolean;
  height: number;
  /** Se, mesmo a 70 %, o conteúdo passou da área. */
  overflow: boolean;
  draw: () => void;
}

interface Ctx {
  ctx: CanvasRenderingContext2D;
  box: Box;
  k: number;
  ruled: boolean;
  surface: SouvenirSurface;
  rng: Rng;
}

function inkOf(id: SouvenirInk | undefined, surface: SouvenirSurface): InkStyle {
  return INKS[id ?? defaultInk(surface)];
}

function trackingOf(ink: InkStyle, px: number): number {
  if (ink.role === 'ENGRAVED') return px * 0.08;
  if (ink.role === 'PRINT') return px * 0.02;
  return 0;
}

function stepOf(c: Ctx, px: number): number {
  return c.ruled ? RULE_STEP : px * 1.36;
}

function baselineOf(c: Ctx, top: number, i: number, px: number): number {
  const step = stepOf(c, px);
  return c.ruled ? top + (i + 1) * step - 2 : top + i * step + px * 1.02;
}

function lineX(x: number, width: number, line: Line, align: 'LEFT' | 'CENTER' | 'RIGHT'): number {
  if (align === 'CENTER') return x + (width - line.width) / 2;
  if (align === 'RIGHT') return x + width - line.width;
  return x;
}

function measurer(
  c: Ctx,
  ink: InkStyle,
  px: number,
): { font: string; measure: Measure; tracking: number } {
  const font = fontFor(c.ctx, ink.role, px);
  const tracking = trackingOf(ink, px);
  return { font, measure: charMeasure(c.ctx, font, tracking), tracking };
}

function textOp(
  c: Ctx,
  text: string,
  px: number,
  ink: InkStyle,
  align: 'LEFT' | 'CENTER' | 'RIGHT',
  x = c.box.x,
  width = c.box.w,
  underline = false,
): Op {
  const { font, measure, tracking } = measurer(c, ink, px);
  const lines = wrapSpans(parseMarkup(text), width, measure);
  return {
    h: lines.length * stepOf(c, px),
    draw: (top) => {
      lines.forEach((line, i) => {
        const lx = lineX(x, width, line, align);
        const baseline = baselineOf(c, top, i, px);
        drawLine(c.ctx, line, lx, baseline, { ink, font, px, measure, rng: c.rng, tracking });
        if (underline) {
          c.ctx.strokeStyle = ink.color;
          c.ctx.globalAlpha = ink.alpha * 0.85;
          handStroke(c.ctx, lx - 2, baseline + 5, lx + line.width + 4, baseline + 4, c.rng, 1.4);
          c.ctx.globalAlpha = 1;
        }
      });
    },
  };
}

function spacer(c: Ctx, px: number): number {
  return c.ruled ? 0 : px * 0.42;
}

function blockOp(c: Ctx, block: SouvenirBlock): Op {
  const { k, surface } = c;
  const centered = CENTERED.has(surface);
  switch (block.type) {
    case 'TITLE': {
      const ink = inkOf(block.ink, surface);
      const px = (ink.role === 'PRINT' ? 21 : 25) * k;
      const op = textOp(
        c,
        block.text,
        px,
        ink,
        centered ? 'CENTER' : 'LEFT',
        c.box.x,
        c.box.w,
        ink.role === 'HAND',
      );
      return { h: op.h + spacer(c, px), draw: op.draw };
    }
    case 'TEXT': {
      const px = TEXT_PX[block.size ?? 'MD'] * k;
      const op = textOp(c, block.text, px, inkOf(block.ink, surface), block.align ?? 'LEFT');
      return { h: op.h + spacer(c, px), draw: op.draw };
    }
    case 'LIST': {
      const ink = inkOf(block.ink, surface);
      const px = TEXT_PX.MD * k;
      const { font, measure } = measurer(c, ink, px);
      const bullets = block.items.map((_, i) => (block.ordered ? `${i + 1}.` : '•'));
      const indent = Math.max(...bullets.map((b) => measure(b))) + (block.ordered ? 7 : 9);
      const items = block.items.map((item) =>
        wrapSpans(parseMarkup(item), c.box.w - indent, measure),
      );
      const step = stepOf(c, px);
      const gap = c.ruled ? 0 : px * 0.18;
      const h = items.reduce((a, lines) => a + lines.length * step + gap, 0);
      return {
        h: h + spacer(c, px),
        draw: (top) => {
          let y = top;
          items.forEach((lines, i) => {
            const bullet = wrapSpans(parseMarkup(bullets[i] ?? ''), indent, measure)[0];
            if (bullet) {
              drawLine(c.ctx, bullet, c.box.x, baselineOf(c, y, 0, px), {
                ink,
                font,
                px,
                measure,
                rng: c.rng,
              });
            }
            lines.forEach((line, j) => {
              drawLine(c.ctx, line, c.box.x + indent, baselineOf(c, y, j, px), {
                ink,
                font,
                px,
                measure,
                rng: c.rng,
              });
            });
            y += lines.length * step + gap;
          });
        },
      };
    }
    case 'TABLE': {
      const ink = inkOf(block.ink, surface);
      const px = 16 * k;
      const { font, measure } = measurer(c, ink, px);
      const widths = block.widths.map((f) => f * c.box.w);
      const pad = 4;
      const wrapRow = (row: readonly string[]) =>
        row.map((cell, i) =>
          wrapSpans(parseMarkup(cell), Math.max(8, (widths[i] ?? 0) - pad * 2), measure),
        );
      const header = wrapRow(block.columns);
      const rows = block.rows.map(wrapRow);
      const step = stepOf(c, px);
      const rowH = (cells: Line[][]) => Math.max(1, ...cells.map((l) => l.length)) * step;
      const total = rowH(header) + rows.reduce((a, r) => a + rowH(r), 0);
      return {
        h: total + spacer(c, px) + (c.ruled ? 0 : 4),
        draw: (top) => {
          const ctx = c.ctx;
          const drawRow = (cells: Line[][], y: number) => {
            let x = c.box.x;
            cells.forEach((lines, i) => {
              lines.forEach((line, j) => {
                drawLine(ctx, line, x + pad, baselineOf(c, y, j, px), {
                  ink,
                  font,
                  px,
                  measure,
                  rng: c.rng,
                });
              });
              x += widths[i] ?? 0;
            });
          };
          drawRow(header, top);
          const headerBottom = top + rowH(header);
          ctx.strokeStyle = ink.color;
          ctx.globalAlpha = 0.7;
          handStroke(ctx, c.box.x, headerBottom + 1, c.box.x + c.box.w, headerBottom, c.rng, 1.2);
          let y = headerBottom;
          for (const row of rows) {
            drawRow(row, y);
            y += rowH(row);
          }
          ctx.globalAlpha = 0.5;
          let x = c.box.x;
          for (let i = 0; i < widths.length - 1; i++) {
            x += widths[i] ?? 0;
            handStroke(ctx, x, top + 3, x + c.rng.range(-1, 1), y - 2, c.rng, 1);
          }
          handStroke(ctx, c.box.x, y + 1, c.box.x + c.box.w, y + 1, c.rng, 1);
          ctx.globalAlpha = 1;
        },
      };
    }
    case 'FIELDS': {
      const ink = inkOf(block.ink, surface);
      const valuePx = TEXT_PX.MD * k;
      const labelPx = 12 * k;
      const label = measurer(c, INKS.PRINT, labelPx);
      const value = measurer(c, ink, valuePx);
      const labelW = Math.min(
        c.box.w * 0.5,
        Math.max(...block.rows.map(([l]) => label.measure(l.toUpperCase()))) + 12,
      );
      const valueW = c.box.w - labelW;
      const rows = block.rows.map(([l, v]) => ({
        label: wrapSpans(parseMarkup(l.toUpperCase()), labelW - 6, label.measure),
        value: wrapSpans(parseMarkup(v), valueW, value.measure),
      }));
      const step = c.ruled ? RULE_STEP : valuePx * 1.45;
      const h = rows.reduce((a, r) => a + Math.max(1, r.value.length) * step, 0);
      return {
        h: h + spacer(c, valuePx),
        draw: (top) => {
          const ctx = c.ctx;
          let y = top;
          for (const row of rows) {
            const first = c.ruled ? y + step - 2 : y + valuePx * 1.05;
            row.label.slice(0, 1).forEach((line) => {
              drawLine(ctx, line, c.box.x, first, {
                ink: { ...INKS.PRINT, color: '#5b5246' },
                font: label.font,
                px: labelPx,
                measure: label.measure,
                rng: c.rng,
                tracking: label.tracking,
              });
            });
            row.value.forEach((line, j) => {
              const baseline = first + j * step;
              drawLine(ctx, line, c.box.x + labelW, baseline, {
                ink,
                font: value.font,
                px: valuePx,
                measure: value.measure,
                rng: c.rng,
              });
              // A linha pontilhada da ficha.
              ctx.save();
              ctx.setLineDash([1.5, 3]);
              ctx.strokeStyle = 'rgba(90, 80, 66, 0.45)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(c.box.x + labelW - 4, baseline + 4);
              ctx.lineTo(c.box.x + c.box.w, baseline + 4);
              ctx.stroke();
              ctx.restore();
            });
            y += Math.max(1, row.value.length) * step;
          }
        },
      };
    }
    case 'SKETCH': {
      const raw = block.height * k;
      const h = c.ruled ? Math.ceil(raw / RULE_STEP) * RULE_STEP : raw;
      return {
        h: h + spacer(c, TEXT_PX.MD * k),
        draw: (top) =>
          drawSketch(
            c.ctx,
            block.sketch,
            { x: c.box.x, y: top, w: c.box.w, h },
            block.labels ?? [],
            c.rng,
          ),
      };
    }
    case 'SIGNATURE': {
      // A assinatura é sempre à mão, até no certificado impresso.
      const resolved = inkOf(block.ink, surface);
      const ink = resolved.role === 'HAND' ? resolved : INKS.INK;
      const px = 30 * k;
      const { font, measure } = measurer(c, ink, px);
      const line = wrapSpans(parseMarkup(block.text), c.box.w, measure)[0];
      const h = c.ruled ? RULE_STEP * 2 : px * 1.7;
      return {
        h,
        draw: (top) => {
          if (!line) return;
          const lx = c.box.x + c.box.w - line.width - 6;
          const baseline = c.ruled ? top + RULE_STEP * 2 - 4 : top + px * 1.1;
          drawLine(c.ctx, line, lx, baseline, { ink, font, px, measure, rng: c.rng });
          // O floreio por baixo.
          c.ctx.strokeStyle = ink.color;
          c.ctx.globalAlpha = ink.alpha * 0.8;
          c.ctx.lineWidth = 1.3;
          c.ctx.beginPath();
          c.ctx.moveTo(lx - 10, baseline + 7);
          c.ctx.bezierCurveTo(
            lx + line.width * 0.3,
            baseline + 14,
            lx + line.width * 0.8,
            baseline + 1,
            lx + line.width + 8,
            baseline + 6,
          );
          c.ctx.stroke();
          c.ctx.globalAlpha = 1;
        },
      };
    }
    case 'STAMP': {
      const px = 15 * k;
      const ctxFont = `700 ${px.toFixed(2)}px Georgia, "Times New Roman", "Liberation Serif", serif`;
      const tracking = px * 0.12;
      const measure = charMeasure(c.ctx, ctxFont, tracking);
      const text = block.text.toUpperCase();
      const textW = measure(text);
      const boxW = Math.min(c.box.w - 8, textW + 30);
      const boxH = px + 26;
      const raw = boxH * 1.25;
      const h = c.ruled ? Math.ceil(raw / RULE_STEP) * RULE_STEP : raw;
      const color = surface === 'OBJECT' ? '#6b2b16' : '#5c3480';
      return {
        h,
        draw: (top) => {
          const ctx = c.ctx;
          const cx = c.box.x + c.box.w / 2;
          const cy = top + h / 2;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(c.rng.range(-0.12, -0.04));
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.72;
          ctx.lineWidth = 2.4;
          ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
          ctx.lineWidth = 1;
          ctx.strokeRect(-boxW / 2 + 4, -boxH / 2 + 4, boxW - 8, boxH - 8);
          const line = wrapSpans([{ text, strike: false, underline: false }], Infinity, measure)[0];
          if (line) {
            ctx.translate(-line.width / 2, px * 0.36);
            drawLine(ctx, line, 0, 0, {
              ink: { role: 'PRINT', color, alpha: 0.78 },
              font: ctxFont,
              px,
              measure,
              rng: c.rng,
              tracking,
            });
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        },
      };
    }
    case 'GAP': {
      const raw = block.size * k;
      return { h: c.ruled ? Math.round(raw / RULE_STEP) * RULE_STEP : raw, draw: () => undefined };
    }
  }
}

function attempt(
  ctx: CanvasRenderingContext2D,
  blocks: readonly SouvenirBlock[],
  box: Box,
  k: number,
  ruled: boolean,
  { surface, rng }: BlockOptions,
): { ops: Op[]; height: number } {
  const c: Ctx = { ctx, box, k, ruled, surface, rng };
  const ops = blocks.map((b) => blockOp(c, b));
  return { ops, height: ops.reduce((a, op) => a + op.h, 0) };
}

/** Dispõe os blocos na caixa, encolhendo a letra até caber. */
export function layoutBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: readonly SouvenirBlock[],
  box: Box,
  options: BlockOptions,
): BlockLayout {
  const canRule = options.surface === 'PAGE' && (options.paper ?? 'RULED') === 'RULED';
  const modes = canRule ? [true, false] : [false];
  let last: { ops: Op[]; height: number; k: number; ruled: boolean } | null = null;
  for (const ruled of modes) {
    for (const k of SCALES) {
      const result = attempt(ctx, blocks, box, k, ruled, options);
      last = { ...result, k, ruled };
      if (result.height <= box.h) return finish(last, box, options.surface, false);
    }
  }
  const fallback = last ?? { ops: [], height: 0, k: 1, ruled: false };
  return finish(fallback, box, options.surface, fallback.height > box.h);
}

function finish(
  { ops, height, k, ruled }: { ops: Op[]; height: number; k: number; ruled: boolean },
  box: Box,
  surface: SouvenirSurface,
  overflow: boolean,
): BlockLayout {
  const offset = MIDDLE.has(surface) ? Math.max(0, (box.h - height) / 2) : 0;
  return {
    scale: k,
    ruled,
    height,
    overflow,
    draw: () => {
      let y = box.y + offset;
      for (const op of ops) {
        op.draw(y);
        y += op.h;
      }
    },
  };
}
