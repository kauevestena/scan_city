/**
 * Sprites das aeronaves (survey-flight §5.6), desenhados em Z = 0, vistos de trás.
 * Atlas (T097): fofo e destemido — cabeça grande e redonda, olhos que piscam e sobrancelha
 * franzida, topete em três pontas, pescoço iridescente, asas com as barras escuras e as rêmiges
 * abertas como dedos, cauda em leque; o acessório equipado é desenhado do jeito dele.
 */
import type { AircraftKind } from '@/types';

export interface SpriteColors {
  primary: string;
  secondary: string;
}

export interface SpriteParams {
  kind: AircraftKind;
  x: number;
  y: number;
  /** px por metro na distância da aeronave. */
  scale: number;
  timeS: number;
  speedMs: number;
  /** Inclinação visual: `MOVE_X × 20°`. */
  bankRad: number;
  colors: SpriteColors;
  /** Acessório do Atlas (cores), se houver. */
  accessory?: SpriteColors | null;
  /**
   * Qual acessório (`ATLAS_GOGGLES`, `ATLAS_SCARF`, `ATLAS_GPS_PACK`, `ATLAS_LAUREL`): cada um
   * tem o seu desenho. Sem id, uma faixa no pescoço nas cores dele.
   */
  accessoryId?: string;
  /** Translúcida (invulnerável com `reduceFlashes`). */
  alpha?: number;
  /** Tamanho da unidade do desenho em px (miniaturas); por padrão, pela escala. */
  unitPx?: number;
}

/** Sombra no chão, menor quanto maior o AGL. */
export function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  aglM: number,
): void {
  const r = Math.max(2, (scale * 1.6) / (1 + aglM / 40));
  ctx.fillStyle = 'rgba(2, 6, 23, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.6, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Tinta escura das penas (pontas das asas, barras, topete) e os acentos fixos do pombo. */
export const ATLAS_INK = '#1e293b';
export const ATLAS_NECK = '#10b981';
/** O brilho violeta do pescoço, meio transparente sobre o verde. */
export const ATLAS_NECK_SHEEN = 'rgba(168, 85, 247, 0.7)';
export const ATLAS_EYE = '#fb923c';
export const ATLAS_BEAK = '#f59e0b';
/** O Atlas pisca a cada tantos segundos, por um instante. */
export const ATLAS_BLINK_EVERY_S = 4.2;
export const ATLAS_BLINK_S = 0.14;

/** Mistura duas cores `#rrggbb` (t = 0, a primeira; 1, a segunda). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 0xff;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0')}`;
}

/** O olho do Atlas: íris laranja, pupila, brilho; piscando, um risco. */
function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, blink: boolean) {
  if (blink) {
    ctx.strokeStyle = ATLAS_INK;
    ctx.lineWidth = Math.max(1, u * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - u * 0.1, y);
    ctx.lineTo(x + u * 0.1, y);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = ATLAS_EYE;
  ctx.beginPath();
  ctx.arc(x, y, u * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(x, y, u * 0.062, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - u * 0.03, y - u * 0.035, u * 0.028, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Uma asa do Atlas (`side` = −1 esquerda, +1 direita): a cobertura na cor das asas, as duas
 * barras escuras de pombo-correio e quatro rêmiges abertas como dedos na ponta, escuras. `lift`
 * (−1..1) é a batida: a ponta sobe e desce.
 */
function drawAtlasWing(
  ctx: CanvasRenderingContext2D,
  p: SpriteParams,
  u: number,
  side: -1 | 1,
  lift: number,
): void {
  const s = side;
  const wristX = s * u * 1.05;
  const wristY = -u * (0.42 + 0.35 * lift);
  const tipX = s * u * 2.05;
  const tipY = u * (0.05 - 0.55 * lift);
  // Rêmiges: quatro penas compridas saindo do punho para a ponta, abertas em leque.
  const dir = Math.atan2(tipY - wristY, tipX - wristX);
  ctx.fillStyle = ATLAS_INK;
  for (let k = 0; k < 4; k++) {
    const a = dir + s * (0.32 - k * 0.2);
    const len = u * (0.72 - k * 0.05);
    const cx = wristX + Math.cos(a) * len * 0.62;
    const cy = wristY + Math.sin(a) * len * 0.62;
    ctx.beginPath();
    ctx.ellipse(cx, cy, len * 0.55, u * 0.11, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cobertura: do ombro ao punho e à ponta, com o bordo de fuga curvo até o corpo.
  ctx.fillStyle = p.colors.secondary;
  ctx.beginPath();
  ctx.moveTo(s * u * 0.28, -u * 0.12);
  ctx.quadraticCurveTo(s * u * 0.62, -u * (0.62 + 0.3 * lift), wristX, wristY);
  ctx.quadraticCurveTo(s * u * 1.6, -u * (0.3 + 0.45 * lift), tipX * 0.86, tipY * 0.9);
  ctx.quadraticCurveTo(s * u * 1.0, u * (0.42 - 0.2 * lift), s * u * 0.3, u * 0.3);
  ctx.closePath();
  ctx.fill();
  // As duas barras escuras atravessando a asa (a marca do pombo-correio).
  ctx.strokeStyle = ATLAS_INK;
  ctx.lineWidth = Math.max(1, u * 0.09);
  ctx.lineCap = 'round';
  for (const k of [0, 1]) {
    const f0 = 0.36 + k * 0.2;
    const x0 = s * u * (0.45 + k * 0.14);
    const y0 = u * (0.02 + k * 0.12) - u * 0.18 * lift * f0;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + s * u * 0.42, y0 - u * (0.12 + 0.2 * lift));
    ctx.stroke();
  }
}

/** Atlas: o pombo do avô, fofo e destemido, visto de trás e de cima. */
function drawAtlas(ctx: CanvasRenderingContext2D, p: SpriteParams, u: number): void {
  const flap = Math.sin(p.timeS * (4 + p.speedMs * 0.8));
  const lift = flap * 0.9;
  const blink = p.timeS % ATLAS_BLINK_EVERY_S < ATLAS_BLINK_S;
  // Cauda em leque, aberta, com as penas marcadas e a ponta escura.
  ctx.fillStyle = p.colors.secondary;
  ctx.beginPath();
  ctx.moveTo(-u * 0.16, u * 0.5);
  ctx.lineTo(-u * 0.56, u * 1.02);
  ctx.quadraticCurveTo(0, u * 1.36, u * 0.56, u * 1.02);
  ctx.lineTo(u * 0.16, u * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ATLAS_INK;
  ctx.beginPath();
  ctx.moveTo(-u * 0.5, u * 0.92);
  ctx.quadraticCurveTo(0, u * 1.24, u * 0.5, u * 0.92);
  ctx.lineTo(u * 0.56, u * 1.02);
  ctx.quadraticCurveTo(0, u * 1.36, -u * 0.56, u * 1.02);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.lineWidth = Math.max(1, u * 0.035);
  ctx.beginPath();
  for (const k of [-2, -1, 0, 1, 2]) {
    ctx.moveTo(k * u * 0.05, u * 0.62);
    ctx.lineTo(k * u * 0.2, u * (1.12 - Math.abs(k) * 0.05));
  }
  ctx.stroke();
  drawAtlasWing(ctx, p, u, -1, lift);
  drawAtlasWing(ctx, p, u, 1, lift);
  // Corpo gordinho, com o dorso mais claro.
  ctx.fillStyle = p.colors.primary;
  ctx.beginPath();
  ctx.ellipse(0, u * 0.12, u * 0.5, u * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.02, u * 0.3, u * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pescoço iridescente: a faixa verde e um brilho violeta que corre devagar de um lado ao outro
  // (cores chapadas: sem gradiente novo a cada quadro).
  ctx.fillStyle = ATLAS_NECK;
  ctx.beginPath();
  ctx.ellipse(0, -u * 0.32, u * 0.42, u * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ATLAS_NECK_SHEEN;
  ctx.beginPath();
  ctx.ellipse(Math.sin(p.timeS * 1.7) * u * 0.16, -u * 0.32, u * 0.22, u * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cabeça grande e redonda, um tom mais escuro que o corpo.
  const hy = -u * 0.66;
  ctx.fillStyle = mixHex(p.colors.primary, ATLAS_INK, 0.22);
  ctx.beginPath();
  ctx.arc(0, hy, u * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Topete em três pontas, para cima e para trás: o lado destemido.
  ctx.fillStyle = ATLAS_INK;
  ctx.beginPath();
  for (const [bx, tx, ty] of [
    [-0.16, -0.3, -1.22],
    [0, 0.02, -1.32],
    [0.16, 0.32, -1.22],
  ] as const) {
    ctx.moveTo(u * (bx - 0.09), hy - u * 0.28);
    ctx.lineTo(u * tx, u * ty);
    ctx.lineTo(u * (bx + 0.09), hy - u * 0.3);
  }
  ctx.fill();
  // Pontinha do bico, à frente.
  ctx.fillStyle = ATLAS_BEAK;
  ctx.beginPath();
  ctx.moveTo(-u * 0.07, hy - u * 0.36);
  ctx.lineTo(u * 0.07, hy - u * 0.36);
  ctx.lineTo(0, hy - u * 0.52);
  ctx.closePath();
  ctx.fill();
  // Olhos nos lados da cabeça, com a sobrancelha franzida.
  for (const s of [-1, 1] as const) {
    const ex = s * u * 0.3;
    const ey = hy - u * 0.02;
    drawEye(ctx, ex, ey, u, blink);
    ctx.strokeStyle = ATLAS_INK;
    ctx.lineWidth = Math.max(1, u * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex + s * u * 0.13, ey - u * 0.2);
    ctx.lineTo(ex - s * u * 0.11, ey - u * 0.12);
    ctx.stroke();
  }
  if (p.accessory) drawAtlasAccessory(ctx, p, u, hy);
}

/** O acessório do Atlas (cosméticos): óculos, cachecol, mochilinha GPS ou coroa de louros. */
function drawAtlasAccessory(
  ctx: CanvasRenderingContext2D,
  p: SpriteParams,
  u: number,
  hy: number,
): void {
  const a = p.accessory;
  if (!a) return;
  switch (p.accessoryId) {
    case 'ATLAS_GOGGLES': {
      // Óculos de aviador: a tira na cabeça e as duas lentes sobre os olhos.
      ctx.strokeStyle = a.primary;
      ctx.lineWidth = Math.max(1, u * 0.1);
      ctx.beginPath();
      ctx.arc(0, hy, u * 0.36, Math.PI * 0.95, Math.PI * 2.05);
      ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.fillStyle = a.secondary;
        ctx.strokeStyle = a.primary;
        ctx.lineWidth = Math.max(1, u * 0.06);
        ctx.beginPath();
        ctx.arc(s * u * 0.3, hy - u * 0.05, u * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      return;
    }
    case 'ATLAS_SCARF': {
      // Cachecol: a volta no pescoço e as duas pontas tremulando para trás.
      const wave = Math.sin(p.timeS * 9) * u * 0.1;
      ctx.fillStyle = a.primary;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.3, u * 0.44, u * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(u * 0.18, -u * 0.26);
      ctx.quadraticCurveTo(u * 0.5 + wave, u * 0.2, u * 0.32 - wave, u * 0.62);
      ctx.lineTo(u * 0.18, u * 0.6);
      ctx.quadraticCurveTo(u * 0.34 + wave, u * 0.2, u * 0.06, -u * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = a.secondary;
      ctx.fillRect(u * 0.18 - wave * 0.5, u * 0.5, u * 0.14, u * 0.06);
      return;
    }
    case 'ATLAS_GPS_PACK': {
      // Mochilinha GPS no dorso, com a antena e o LED que pisca.
      ctx.fillStyle = a.primary;
      ctx.fillRect(-u * 0.24, -u * 0.1, u * 0.48, u * 0.42);
      ctx.strokeStyle = a.primary;
      ctx.lineWidth = Math.max(1, u * 0.05);
      ctx.beginPath();
      ctx.moveTo(u * 0.14, -u * 0.1);
      ctx.lineTo(u * 0.22, -u * 0.42);
      ctx.stroke();
      ctx.fillStyle = Math.sin(p.timeS * 6) > 0 ? a.secondary : '#164e63';
      ctx.beginPath();
      ctx.arc(-u * 0.08, u * 0.06, u * 0.06, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'ATLAS_LAUREL': {
      // Coroa de louros: o ramo em volta da cabeça e as folhas alternadas, em espinha.
      ctx.strokeStyle = a.primary;
      ctx.lineWidth = Math.max(1, u * 0.03);
      ctx.beginPath();
      ctx.arc(0, hy, u * 0.38, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.fillStyle = a.primary;
      for (let k = 0; k < 7; k++) {
        const ang = Math.PI * (1.05 + (k / 6) * 0.9);
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(ang) * u * 0.38,
          hy + Math.sin(ang) * u * 0.38,
          u * 0.13,
          u * 0.055,
          ang + Math.PI / 2 + (k % 2 ? 0.6 : -0.6),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = a.secondary;
      ctx.beginPath();
      ctx.arc(0, hy - u * 0.4, u * 0.05, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    default: {
      // Acessório sem desenho próprio: a faixa no pescoço.
      ctx.fillStyle = a.primary;
      ctx.fillRect(-u * 0.34, -u * 0.36, u * 0.68, u * 0.14);
    }
  }
}

function drawMultirotor(ctx: CanvasRenderingContext2D, p: SpriteParams, u: number): void {
  ctx.strokeStyle = p.colors.secondary;
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.beginPath();
  ctx.moveTo(-u, -u * 0.5);
  ctx.lineTo(u, u * 0.5);
  ctx.moveTo(u, -u * 0.5);
  ctx.lineTo(-u, u * 0.5);
  ctx.stroke();
  const spin = p.timeS * 40;
  for (const [hx, hy] of [
    [-u, -u * 0.5],
    [u, -u * 0.5],
    [-u, u * 0.5],
    [u, u * 0.5],
  ] as const) {
    ctx.fillStyle = `rgba(226, 232, 240, ${0.25 + 0.1 * Math.sin(spin + hx)})`;
    ctx.beginPath();
    ctx.ellipse(hx, hy, u * 0.55, u * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = p.colors.primary;
  ctx.fillRect(-u * 0.35, -u * 0.25, u * 0.7, u * 0.5);
}

function drawVtol(ctx: CanvasRenderingContext2D, p: SpriteParams, u: number): void {
  ctx.fillStyle = p.colors.primary;
  ctx.fillRect(-u * 2.4, -u * 0.08, u * 4.8, u * 0.22);
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 0.3, u * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.colors.secondary;
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, -u * 0.2);
  ctx.lineTo(-u * 0.6, -u * 0.8);
  ctx.moveTo(0, -u * 0.2);
  ctx.lineTo(u * 0.6, -u * 0.8);
  ctx.stroke();
}

export function drawAircraft(ctx: CanvasRenderingContext2D, p: SpriteParams): void {
  // Unidade do desenho: ~0,6 m de envergadura por "u", com um mínimo legível.
  const u = p.unitPx ?? Math.max(10, p.scale * 0.6);
  ctx.save();
  ctx.globalAlpha = p.alpha ?? 1;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.bankRad);
  if (p.kind === 'BIRD') drawAtlas(ctx, p, u);
  else if (p.kind === 'MULTIROTOR') drawMultirotor(ctx, p, u);
  else drawVtol(ctx, p, u);
  ctx.restore();
}
