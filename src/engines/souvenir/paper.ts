/**
 * Os papéis e as placas das faces dos souvenirs (catalog §11.1): página de caderneta (pautada,
 * quadriculada ou lisa), etiqueta com barbante, bilhete dobrado, certificado, etiqueta de amostra,
 * placa de latão e croqui antigo; e as marcas do uso (café, digital, pena, milho, fita, dobra).
 * Tudo em px lógicos da superfície, desenhado uma vez num bitmap (ADR-036).
 */
import type { Rng } from '@/lib/rng';
import type { SouvenirDecor, SouvenirPaper, SouvenirSurface } from '@/types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tamanho lógico de cada superfície (a página da caderneta tem 400 × 580). */
export const SURFACE_SIZE: Record<SouvenirSurface, { w: number; h: number }> = {
  OBJECT: { w: 560, h: 460 },
  COVER: { w: 400, h: 580 },
  BACK_COVER: { w: 400, h: 580 },
  PAGE: { w: 400, h: 580 },
  TAG: { w: 300, h: 480 },
  NOTE: { w: 440, h: 520 },
  CARD: { w: 560, h: 410 },
  LABEL: { w: 520, h: 340 },
  PLAQUE: { w: 620, h: 300 },
  MAP: { w: 680, h: 480 },
};

/** Pauta da caderneta: a primeira linha e o passo (o texto assenta nelas). */
export const RULE_FIRST_Y = 70;
export const RULE_STEP = 26;

/** Área dos blocos em cada papel. Na página pautada, o topo fica a um passo da primeira linha. */
export function paperContent(surface: SouvenirSurface): Box {
  const { w, h } = SURFACE_SIZE[surface];
  switch (surface) {
    case 'PAGE':
      return {
        x: 48,
        y: RULE_FIRST_Y - RULE_STEP,
        w: w - 48 - 24,
        h: h - (RULE_FIRST_Y - RULE_STEP) - 28,
      };
    case 'TAG':
      return { x: 26, y: 96, w: w - 52, h: h - 96 - 24 };
    case 'NOTE':
      return { x: 40, y: 44, w: w - 80, h: h - 44 - 40 };
    case 'CARD':
      return { x: 62, y: 76, w: w - 124, h: h - 76 - 46 };
    case 'LABEL':
      return { x: 34, y: 28, w: w - 68, h: h - 28 - 24 };
    case 'PLAQUE':
      return { x: 60, y: 40, w: w - 120, h: h - 80 };
    case 'MAP':
      return { x: 34, y: 28, w: w - 68, h: h - 28 - 26 };
    default:
      return { x: 0, y: 0, w, h };
  }
}

// --- primitivas ----------------------------------------------------------------

export function roundRect(ctx: CanvasRenderingContext2D, b: Box, r: number): void {
  ctx.beginPath();
  ctx.moveTo(b.x + r, b.y);
  ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, r);
  ctx.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, r);
  ctx.arcTo(b.x, b.y + b.h, b.x, b.y, r);
  ctx.arcTo(b.x, b.y, b.x + b.w, b.y, r);
  ctx.closePath();
}

/** Fibras, pintas de umidade e o amarelado das bordas: o papel velho. */
function agePaper(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, amount = 1): void {
  const yellow = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.28,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72,
  );
  yellow.addColorStop(0, 'rgba(160, 118, 48, 0)');
  yellow.addColorStop(1, `rgba(150, 104, 38, ${0.26 * amount})`);
  ctx.fillStyle = yellow;
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const a = rng.range(0, Math.PI);
    const len = rng.range(2, 8);
    ctx.strokeStyle = `rgba(110, 86, 52, ${rng.range(0.04, 0.11)})`;
    ctx.lineWidth = rng.range(0.4, 0.9);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const spots = rng.int(5, 10);
  for (let i = 0; i < spots; i++) {
    ctx.fillStyle = `rgba(150, 98, 40, ${rng.range(0.06, 0.14) * amount})`;
    ctx.beginPath();
    ctx.arc(rng.range(0, w), rng.range(0, h), rng.range(0.8, 3.6), 0, Math.PI * 2);
    ctx.fill();
  }
  // Borda gasta.
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `rgba(110, 76, 30, ${0.12 - k * 0.035})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(1 + k * 2, 1 + k * 2, w - 2 - k * 4, h - 2 - k * 4);
  }
}

// --- superfícies -----------------------------------------------------------------

function drawPage(ctx: CanvasRenderingContext2D, rng: Rng, paper: SouvenirPaper): void {
  const { w, h } = SURFACE_SIZE.PAGE;
  ctx.fillStyle = '#efe4c6';
  ctx.fillRect(0, 0, w, h);
  agePaper(ctx, w, h, rng);
  if (paper === 'RULED') {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(64, 104, 156, 0.3)';
    for (let y = RULE_FIRST_Y; y < h - 22; y += RULE_STEP) {
      ctx.beginPath();
      ctx.moveTo(14, y + 0.5);
      ctx.lineTo(w - 10, y + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(184, 58, 52, 0.38)';
    ctx.beginPath();
    ctx.moveTo(38.5, 8);
    ctx.lineTo(38.5, h - 8);
    ctx.moveTo(41.5, 8);
    ctx.lineTo(41.5, h - 8);
    ctx.stroke();
  } else if (paper === 'GRID') {
    const cell = 13;
    for (let i = 1; i * cell < w; i++) {
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(52, 116, 118, 0.24)' : 'rgba(52, 116, 118, 0.13)';
      ctx.lineWidth = i % 5 === 0 ? 0.9 : 0.6;
      ctx.beginPath();
      ctx.moveTo(i * cell + 0.5, 6);
      ctx.lineTo(i * cell + 0.5, h - 6);
      ctx.stroke();
    }
    for (let j = 1; j * cell < h; j++) {
      ctx.strokeStyle = j % 5 === 0 ? 'rgba(52, 116, 118, 0.24)' : 'rgba(52, 116, 118, 0.13)';
      ctx.lineWidth = j % 5 === 0 ? 0.9 : 0.6;
      ctx.beginPath();
      ctx.moveTo(6, j * cell + 0.5);
      ctx.lineTo(w - 6, j * cell + 0.5);
      ctx.stroke();
    }
  }
}

function drawTag(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const { w, h } = SURFACE_SIZE.TAG;
  const cut = 44;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cut, 22);
  ctx.lineTo(w - cut, 22);
  ctx.lineTo(w - 4, 22 + cut);
  ctx.lineTo(w - 4, h - 4);
  ctx.lineTo(4, h - 4);
  ctx.lineTo(4, 22 + cut);
  ctx.closePath();
  ctx.fillStyle = '#e4cc93';
  ctx.fill();
  ctx.clip();
  agePaper(ctx, w, h, rng, 0.8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(120, 88, 40, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cut, 22);
  ctx.lineTo(w - cut, 22);
  ctx.lineTo(w - 4, 22 + cut);
  ctx.lineTo(w - 4, h - 4);
  ctx.lineTo(4, h - 4);
  ctx.lineTo(4, 22 + cut);
  ctx.closePath();
  ctx.stroke();
  // O ilhós e o barbante saindo pelo alto.
  const hx = w / 2;
  const hy = 56;
  ctx.fillStyle = '#cdb072';
  ctx.beginPath();
  ctx.arc(hx, hy, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110, 80, 34, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#2a1d10';
  ctx.beginPath();
  ctx.arc(hx, hy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a7834d';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx - 3, hy + 2);
  ctx.bezierCurveTo(hx - 40, hy - 10, hx - 30, 10, hx - 70, -6);
  ctx.moveTo(hx + 3, hy + 2);
  ctx.bezierCurveTo(hx + 36, hy - 16, hx + 52, 8, hx + 90, -6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70, 48, 20, 0.45)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const x = hx - 3 - t * 60;
    const y = hy + 2 - t * 52 + Math.sin(t * 6) * 6;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y - 1.5);
    ctx.lineTo(x + 1.5, y + 1.5);
    ctx.stroke();
  }
}

function drawNote(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const { w, h } = SURFACE_SIZE.NOTE;
  ctx.fillStyle = '#f1e9d6';
  ctx.fillRect(0, 0, w, h);
  agePaper(ctx, w, h, rng, 0.6);
  // Dobrado em quatro: as metades com sombra leve e os vincos.
  ctx.fillStyle = 'rgba(90, 70, 40, 0.035)';
  ctx.fillRect(w / 2, 0, w / 2, h / 2);
  ctx.fillRect(0, h / 2, w / 2, h / 2);
  crease(ctx, 0, h / 2, w, h / 2);
  crease(ctx, w / 2, 0, w / 2, h);
}

function crease(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const vertical = x1 === x2;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 252, 240, 0.55)';
  ctx.beginPath();
  ctx.moveTo(x1 + (vertical ? -1 : 0), y1 + (vertical ? 0 : -1));
  ctx.lineTo(x2 + (vertical ? -1 : 0), y2 + (vertical ? 0 : -1));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(96, 72, 38, 0.18)';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCard(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const { w, h } = SURFACE_SIZE.CARD;
  ctx.fillStyle = '#f3ead1';
  ctx.fillRect(0, 0, w, h);
  agePaper(ctx, w, h, rng, 0.5);
  ctx.strokeStyle = '#7c5a2a';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.lineWidth = 1;
  ctx.strokeRect(27, 27, w - 54, h - 54);
  // Losangos nos cantos e o brasão no alto.
  ctx.fillStyle = '#9c7432';
  for (const [x, y] of [
    [22.5, 22.5],
    [w - 22.5, 22.5],
    [22.5, h - 22.5],
    [w - 22.5, h - 22.5],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x, y + 9);
    ctx.lineTo(x - 9, y);
    ctx.closePath();
    ctx.fill();
  }
  const cx = w / 2;
  ctx.fillStyle = '#c9a24a';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 22 : 13;
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = 44 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7c5a2a';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#f3ead1';
  ctx.beginPath();
  ctx.arc(cx, 44, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawLabel(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const { w, h } = SURFACE_SIZE.LABEL;
  ctx.fillStyle = '#f3f0e6';
  roundRect(ctx, { x: 2, y: 2, w: w - 4, h: h - 4 }, 14);
  ctx.fill();
  ctx.save();
  ctx.clip();
  agePaper(ctx, w, h, rng, 0.45);
  ctx.restore();
  ctx.strokeStyle = '#b4392e';
  ctx.lineWidth = 2.5;
  roundRect(ctx, { x: 11, y: 11, w: w - 22, h: h - 22 }, 9);
  ctx.stroke();
}

function drawPlaque(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const { w, h } = SURFACE_SIZE.PLAQUE;
  const plate = { x: 6, y: 6, w: w - 12, h: h - 12 };
  const brass = ctx.createLinearGradient(0, plate.y, 0, plate.y + plate.h);
  brass.addColorStop(0, '#efd585');
  brass.addColorStop(0.45, '#c99e40');
  brass.addColorStop(1, '#9a7225');
  ctx.fillStyle = brass;
  roundRect(ctx, plate, 16);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Escovado: riscos finos na horizontal.
  for (let i = 0; i < 120; i++) {
    const y = rng.range(plate.y, plate.y + plate.h);
    ctx.strokeStyle = rng.next() < 0.5 ? 'rgba(255, 240, 190, 0.12)' : 'rgba(90, 60, 10, 0.1)';
    ctx.lineWidth = rng.range(0.4, 1);
    const x = rng.range(plate.x, plate.x + plate.w * 0.7);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rng.range(60, 260), y + rng.range(-0.6, 0.6));
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#7a5818';
  roundRect(ctx, plate, 16);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 240, 180, 0.7)';
  roundRect(ctx, { x: 16, y: 16, w: w - 32, h: h - 32 }, 10);
  ctx.stroke();
  for (const [x, y] of [
    [30, 30],
    [w - 30, 30],
    [30, h - 30],
    [w - 30, h - 30],
  ] as const) {
    const screw = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
    screw.addColorStop(0, '#f6e4a6');
    screw.addColorStop(1, '#7d5b1d');
    ctx.fillStyle = screw;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    const a = rng.range(0, Math.PI);
    ctx.strokeStyle = '#4b360c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5);
    ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
    ctx.stroke();
  }
}

function drawMap(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const { w, h } = SURFACE_SIZE.MAP;
  // Borda irregular: o papel do croqui ficou anos enrolado na garrafa.
  ctx.save();
  ctx.beginPath();
  const pts: Array<[number, number]> = [];
  const step = 24;
  for (let x = 8; x <= w - 8; x += step) pts.push([x, 8 + rng.range(-3, 4)]);
  for (let y = 8; y <= h - 8; y += step) pts.push([w - 8 + rng.range(-4, 3), y]);
  for (let x = w - 8; x >= 8; x -= step) pts.push([x, h - 8 + rng.range(-4, 3)]);
  for (let y = h - 8; y >= 8; y -= step) pts.push([8 + rng.range(-3, 4), y]);
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = '#e5d09c';
  ctx.fill();
  ctx.clip();
  agePaper(ctx, w, h, rng, 1.4);
  // As pontas ainda querem enrolar: sombra e brilho nas laterais.
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : w - 46;
    const roll = ctx.createLinearGradient(x0, 0, x0 + 46, 0);
    const dark = 'rgba(96, 64, 24, 0.32)';
    const light = 'rgba(255, 246, 214, 0.25)';
    roll.addColorStop(0, side === 0 ? dark : 'rgba(0,0,0,0)');
    roll.addColorStop(0.5, light);
    roll.addColorStop(1, side === 0 ? 'rgba(0,0,0,0)' : dark);
    ctx.fillStyle = roll;
    ctx.fillRect(x0, 0, 46, h);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(100, 66, 24, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.stroke();
}

/** Desenha o papel (ou a placa) e devolve a área dos blocos. */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  surface: SouvenirSurface,
  rng: Rng,
  paper: SouvenirPaper = 'RULED',
): Box {
  if (surface === 'PAGE') drawPage(ctx, rng, paper);
  else if (surface === 'TAG') drawTag(ctx, rng);
  else if (surface === 'NOTE') drawNote(ctx, rng);
  else if (surface === 'CARD') drawCard(ctx, rng);
  else if (surface === 'LABEL') drawLabel(ctx, rng);
  else if (surface === 'PLAQUE') drawPlaque(ctx, rng);
  else if (surface === 'MAP') drawMap(ctx, rng);
  return paperContent(surface);
}

// --- marcas do uso -------------------------------------------------------------

/** Um canto do papel, sorteado, para a marca. */
function corner(rng: Rng, w: number, h: number, inset: number): [number, number] {
  const right = rng.next() < 0.5;
  const bottom = rng.next() < 0.6;
  return [right ? w - inset : inset, bottom ? h - inset : inset + 30];
}

/** As marcas vão por cima do texto (o café caiu depois de escrever). */
export function drawDecor(
  ctx: CanvasRenderingContext2D,
  decor: SouvenirDecor,
  w: number,
  h: number,
  rng: Rng,
): void {
  ctx.save();
  if (decor === 'COFFEE_RING') {
    const [cx, cy] = corner(rng, w, h, 70);
    const r = rng.range(36, 50);
    ctx.fillStyle = 'rgba(122, 74, 30, 0.045)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    for (const [dr, width, alpha] of [
      [0, 4.5, 0.2],
      [-3, 1.6, 0.14],
    ] as const) {
      ctx.strokeStyle = `rgba(118, 70, 28, ${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      const start = rng.range(0, Math.PI * 2);
      const sweep = rng.range(Math.PI * 1.55, Math.PI * 1.95);
      for (let i = 0; i <= 40; i++) {
        const a = start + (i / 40) * sweep;
        const rr = r + dr + Math.sin(a * 3 + start) * 1.4;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (decor === 'COFFEE_DROPS') {
    const [cx, cy] = corner(rng, w, h, 60);
    const n = rng.int(4, 7);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(108, 66, 26, ${rng.range(0.16, 0.3)})`;
      ctx.beginPath();
      ctx.arc(cx + rng.range(-34, 34), cy + rng.range(-26, 26), rng.range(1.4, 6), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (decor === 'THUMBPRINT') {
    const cx = w - rng.range(46, 70);
    const cy = h - rng.range(40, 64);
    ctx.translate(cx, cy);
    ctx.rotate(rng.range(-0.8, 0.8));
    ctx.strokeStyle = 'rgba(76, 64, 52, 0.13)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 9; i++) {
      const rx = 5 + i * 2.6;
      const gap = rng.range(0.2, 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, rx * 1.3, 0, gap, Math.PI * 2 - gap * 0.4);
      ctx.stroke();
    }
  } else if (decor === 'FEATHER') {
    // Enfiada no canto de baixo, onde a página costuma estar livre.
    ctx.translate(w - 64, h - 112);
    ctx.rotate(-0.9);
    const vane = ctx.createLinearGradient(0, -70, 0, 80);
    vane.addColorStop(0, '#5f6773');
    vane.addColorStop(0.7, '#9aa2ad');
    vane.addColorStop(1, '#c9cdd3');
    ctx.fillStyle = vane;
    ctx.beginPath();
    ctx.moveTo(0, 86);
    ctx.bezierCurveTo(-22, 30, -20, -40, 0, -78);
    ctx.bezierCurveTo(18, -40, 24, 28, 0, 86);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 44, 52, 0.35)';
    ctx.lineWidth = 0.7;
    for (let y = -64; y < 70; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(-16 + Math.abs(y) * 0.06, y + 9);
      ctx.moveTo(0, y);
      ctx.lineTo(15 - Math.abs(y) * 0.06, y + 9);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e7e5df';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 104);
    ctx.quadraticCurveTo(2, 10, 0, -78);
    ctx.stroke();
  } else if (decor === 'CORN_KERNEL') {
    const cx = w - 70;
    const cy = h - 70;
    const kernel = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 13);
    kernel.addColorStop(0, '#fff1a6');
    kernel.addColorStop(1, '#e3a81c');
    ctx.fillStyle = kernel;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 9);
    ctx.quadraticCurveTo(cx, cy - 13, cx + 9, cy - 9);
    ctx.quadraticCurveTo(cx + 8, cy + 6, cx, cy + 12);
    ctx.quadraticCurveTo(cx - 8, cy + 6, cx - 9, cy - 9);
    ctx.fill();
    tape(ctx, cx, cy, 64, -0.35);
  } else if (decor === 'TAPE') {
    tape(ctx, w / 2 + rng.range(-40, 40), 12, 120, rng.range(-0.12, 0.12));
  } else if (decor === 'FOLD') {
    crease(ctx, 6, h / 3, w - 6, h / 3);
    crease(ctx, 6, (h * 2) / 3, w - 6, (h * 2) / 3);
  }
  ctx.restore();
}

/** Fita adesiva amarelada, com as pontas picotadas. */
function tape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  len: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(232, 222, 186, 0.62)';
  ctx.beginPath();
  ctx.moveTo(-len / 2, -11);
  for (let i = 0; i <= 4; i++) ctx.lineTo(len / 2 + (i % 2 === 0 ? 0 : 3), -11 + i * 5.5);
  for (let i = 0; i <= 4; i++) ctx.lineTo(-len / 2 - (i % 2 === 0 ? 0 : 3), 11 - i * 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150, 130, 80, 0.25)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}
