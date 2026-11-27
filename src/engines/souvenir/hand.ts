/**
 * Letra à mão sem fonte externa (ADR-036 §4): a primeira fonte manuscrita instalada da lista, ou
 * uma serifada itálica; cada letra sai com um tremor seedado (rotação, linha de base, tamanho e
 * tinta). Também a marcação dos textos (`~~riscado~~`, `__sublinhado__`) e a quebra de linha.
 */
import type { Rng } from '@/lib/rng';
import type { SouvenirInk } from '@/types';

export type FontRole = 'HAND' | 'PRINT' | 'ENGRAVED';

export interface InkStyle {
  role: FontRole;
  color: string;
  alpha: number;
}

/** As tintas: grafite, caneta azul-escura, caneta vermelha, impressa e gravada no latão. */
export const INKS: Record<SouvenirInk, InkStyle> = {
  PENCIL: { role: 'HAND', color: '#4f4c47', alpha: 0.78 },
  INK: { role: 'HAND', color: '#1d2847', alpha: 0.92 },
  RED: { role: 'HAND', color: '#a3241c', alpha: 0.9 },
  PRINT: { role: 'PRINT', color: '#2a241e', alpha: 0.94 },
  ENGRAVED: { role: 'ENGRAVED', color: '#3b2a10', alpha: 0.9 },
};

/** Fonte manuscrita e o ajuste de tamanho dela (umas são bem mais largas que outras). */
export interface HandFont {
  /** `null`: nenhuma instalada; vale a serifada itálica. */
  family: string | null;
  scale: number;
}

/**
 * Em ordem de preferência: Windows (Segoe Print, Ink Free), macOS (Bradley Hand, Noteworthy,
 * Chalkboard SE), Linux (Z003, URW Chancery L) e Android (Dancing Script).
 */
export const HAND_FONTS: readonly HandFont[] = [
  { family: 'Segoe Print', scale: 0.84 },
  { family: 'Ink Free', scale: 1.04 },
  { family: 'Bradley Hand', scale: 1.0 },
  { family: 'Noteworthy', scale: 0.96 },
  { family: 'Chalkboard SE', scale: 0.86 },
  { family: 'Z003', scale: 1.14 },
  { family: 'URW Chancery L', scale: 1.14 },
  { family: 'Dancing Script', scale: 1.08 },
];

const FALLBACK_HAND: HandFont = { family: null, scale: 1 };
const SERIF = 'Georgia, "Times New Roman", "Liberation Serif", "DejaVu Serif", serif';
const PROBE = 'Hamburgefonstiv 0123 áçõ';

let detected: HandFont | null = null;

/**
 * Uma fonte está instalada quando a largura medida com ela difere da largura com a genérica de
 * reserva, contra duas genéricas diferentes (`document.fonts.check` diz `true` para qualquer
 * fonte do sistema, instalada ou não).
 */
export function isFontInstalled(ctx: CanvasRenderingContext2D, family: string): boolean {
  const width = (font: string) => {
    ctx.font = font;
    return ctx.measureText(PROBE).width;
  };
  const mono = width('32px monospace');
  const serif = width('32px serif');
  return (
    width(`32px "${family}", monospace`) !== mono && width(`32px "${family}", serif`) !== serif
  );
}

/** A fonte manuscrita desta máquina, detectada uma vez. */
export function handFont(ctx: CanvasRenderingContext2D): HandFont {
  if (detected) return detected;
  ctx.save();
  detected = HAND_FONTS.find((f) => f.family && isFontInstalled(ctx, f.family)) ?? FALLBACK_HAND;
  ctx.restore();
  return detected;
}

/** Só para testes: esquece a fonte detectada. */
export function resetHandFont(): void {
  detected = null;
}

/** O `font` do Canvas para uma tinta, no tamanho nominal `px` (já com o ajuste da fonte). */
export function fontFor(ctx: CanvasRenderingContext2D, role: FontRole, px: number): string {
  if (role === 'PRINT') return `${px.toFixed(2)}px ${SERIF}`;
  if (role === 'ENGRAVED') return `600 ${px.toFixed(2)}px ${SERIF}`;
  const hand = handFont(ctx);
  const size = (px * hand.scale).toFixed(2);
  return hand.family ? `${size}px "${hand.family}", cursive` : `italic ${size}px ${SERIF}`;
}

// --- marcação ------------------------------------------------------------------

export interface Span {
  text: string;
  strike: boolean;
  underline: boolean;
}

/** `~~riscado~~` e `__sublinhado__` (sem aninhar). */
export function parseMarkup(text: string): Span[] {
  const out: Span[] = [];
  const re = /~~(.+?)~~|__(.+?)__/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last)
      out.push({ text: text.slice(last, m.index), strike: false, underline: false });
    if (m[1] !== undefined) out.push({ text: m[1], strike: true, underline: false });
    else out.push({ text: m[2] ?? '', strike: false, underline: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), strike: false, underline: false });
  return out;
}

/** O texto sem a marcação: o que vai para o leitor de tela. O riscado sai entre colchetes. */
export function plainText(text: string): string {
  return parseMarkup(text)
    .map((s) => (s.strike ? `[riscado: ${s.text}]` : s.text))
    .join('');
}

// --- quebra de linha -----------------------------------------------------------

export interface Piece extends Span {
  width: number;
}

/** Uma palavra pode ter pedaços de estilos diferentes ("abc__def__"). */
export interface Word {
  pieces: Piece[];
  width: number;
}

export interface Line {
  words: Word[];
  width: number;
}

export type Measure = (text: string) => number;

/** Quebra os trechos em linhas de até `maxWidth`; uma palavra maior que a linha é cortada. */
export function wrapSpans(spans: readonly Span[], maxWidth: number, measure: Measure): Line[] {
  const words: Word[] = [];
  let current: Piece[] = [];
  const flush = () => {
    if (current.length === 0) return;
    words.push({ pieces: current, width: current.reduce((a, p) => a + p.width, 0) });
    current = [];
  };
  for (const span of spans) {
    // Só o espaço comum quebra a linha: o espaço não separável (U+00A0) segura "5 cm" junto.
    for (const token of span.text.split(/([ \t\n\r]+)/)) {
      if (token === '') continue;
      if (/^[ \t\n\r]+$/.test(token)) {
        flush();
        continue;
      }
      current.push({ ...span, text: token, width: measure(token) });
    }
  }
  flush();

  const space = measure(' ');
  const lines: Line[] = [];
  let line: Word[] = [];
  let width = 0;
  const push = () => {
    if (line.length > 0) lines.push({ words: line, width });
    line = [];
    width = 0;
  };
  for (const word of splitLongWords(words, maxWidth, measure)) {
    const next = line.length === 0 ? word.width : width + space + word.width;
    if (line.length > 0 && next > maxWidth) push();
    width = line.length === 0 ? word.width : width + space + word.width;
    line.push(word);
  }
  push();
  return lines;
}

function splitLongWords(words: readonly Word[], maxWidth: number, measure: Measure): Word[] {
  const out: Word[] = [];
  for (const word of words) {
    if (word.width <= maxWidth || word.pieces.length !== 1) {
      out.push(word);
      continue;
    }
    const piece = word.pieces[0] as Piece;
    let chunk = '';
    for (const ch of piece.text) {
      if (chunk !== '' && measure(chunk + ch) > maxWidth) {
        const w = measure(chunk);
        out.push({ pieces: [{ ...piece, text: chunk, width: w }], width: w });
        chunk = '';
      }
      chunk += ch;
    }
    const w = measure(chunk);
    out.push({ pieces: [{ ...piece, text: chunk, width: w }], width: w });
  }
  return out;
}

// --- desenho -------------------------------------------------------------------

/**
 * Medidor de uma tinta num tamanho: a largura é a soma das letras (cada uma é desenhada
 * sozinha, com o tremor), com o `tracking` entre elas; o cache evita medir a mesma letra.
 */
export function charMeasure(ctx: CanvasRenderingContext2D, font: string, tracking = 0): Measure {
  const cache = new Map<string, number>();
  const charWidth = (ch: string) => {
    let w = cache.get(ch);
    if (w === undefined) {
      ctx.font = font;
      w = ctx.measureText(ch).width;
      cache.set(ch, w);
    }
    return w;
  };
  return (text) => {
    let total = 0;
    for (const ch of text) total += charWidth(ch) + tracking;
    return total;
  };
}

export interface DrawLineOptions {
  ink: InkStyle;
  font: string;
  /** Tamanho nominal (px): define o traço do riscado e do sublinhado. */
  px: number;
  measure: Measure;
  rng: Rng;
  tracking?: number;
}

/** Linha de caneta levemente torta, como o riscado e o sublinhado à mão. */
export function handStroke(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: Rng,
  width: number,
): void {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + rng.range(-0.9, 0.9);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1 + rng.range(-1, 1), y1 + rng.range(-0.6, 0.6));
  ctx.quadraticCurveTo(mx, my, x2 + rng.range(-1, 1.5), y2 + rng.range(-0.6, 0.6));
  ctx.stroke();
}

/**
 * Desenha uma linha começando em `x`, na linha de base `baseline`. Na letra à mão, cada letra
 * gira, sobe ou desce e muda de tinta um pouco, e a linha inteira ondula e inclina de leve.
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  line: Line,
  x: number,
  baseline: number,
  { ink, font, px, measure, rng, tracking = 0 }: DrawLineOptions,
): void {
  const hand = ink.role === 'HAND';
  const space = measure(' ');
  const slope = hand ? rng.range(-0.006, 0.006) : 0;
  const phase = rng.range(0, Math.PI * 2);
  const drift = (at: number) =>
    hand ? Math.sin((at - x) / 85 + phase) * 0.7 + (at - x) * slope : 0;
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink.color;
  ctx.strokeStyle = ink.color;
  let cx = x;
  line.words.forEach((word, wi) => {
    if (wi > 0) cx += space;
    for (const piece of word.pieces) {
      const start = cx;
      for (const ch of piece.text) {
        const w = measure(ch) - tracking;
        const y = baseline + drift(cx);
        if (ch === ' ' || ch === '\u00a0') {
          // Espaço (inclusive o não separável): só avança.
        } else if (ink.role === 'ENGRAVED') {
          // Gravado: o brilho embaixo e o sulco por cima.
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#fbefc4';
          ctx.fillText(ch, cx, y + 1);
          ctx.globalAlpha = ink.alpha;
          ctx.fillStyle = ink.color;
          ctx.fillText(ch, cx, y);
        } else if (hand) {
          const rot = Math.max(-0.044, Math.min(0.044, rng.normal() * 0.022));
          const scale = 1 + rng.range(-0.04, 0.04);
          const alpha = ink.alpha * rng.range(0.86, 1);
          ctx.save();
          ctx.translate(cx + w / 2, y + rng.normal() * 0.3);
          ctx.rotate(rot);
          ctx.scale(scale, scale);
          ctx.globalAlpha = alpha;
          ctx.fillText(ch, -w / 2, 0);
          // A pressão da caneta: um segundo traço, deslocado e fraco, engrossa a letra.
          ctx.globalAlpha = alpha * 0.32;
          ctx.fillText(ch, -w / 2 + 0.35, 0.25);
          ctx.restore();
        } else {
          ctx.globalAlpha = ink.alpha;
          ctx.fillText(ch, cx, y);
        }
        cx += w + tracking;
      }
      ctx.globalAlpha = ink.alpha;
      if (piece.strike) {
        const y = baseline - px * 0.3 + drift(start);
        handStroke(ctx, start - 2, y + 1, cx + 2, y - 1, rng, Math.max(1.2, px * 0.09));
        handStroke(ctx, start - 1, y - 1.5, cx + 1, y + 0.5, rng, Math.max(1, px * 0.06));
      }
      if (piece.underline) {
        const y = baseline + px * 0.2 + drift(start);
        handStroke(ctx, start - 1, y, cx + 1, y + rng.range(-1, 1), rng, Math.max(1, px * 0.075));
      }
    }
  });
  ctx.globalAlpha = 1;
}
