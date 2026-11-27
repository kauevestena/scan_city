/**
 * A cena do exame (office §5.1, ADR-036): a mesa de madeira à luz do abajur e o souvenir em cima.
 * O caderno vira a página em torno da lombada (a largura da folha segue o cosseno do ângulo, com
 * sombra na dobra e na página de baixo) e desliza para o centro ao abrir e ao fechar; o objeto
 * gira em torno do próprio centro e flutua de leve. Cada face e a mesa são desenhadas uma vez
 * num bitmap na resolução da tela; a cada quadro só se compõem os bitmaps.
 */
import { hashString, mulberry32 } from '@/lib/rng';
import type { Souvenir, SouvenirFace } from '@/types';
import { faceSize, renderFace } from './faceRenderer';
import { souvenirViews, type SouvenirView } from './views';

export const PAGE_TURN_S = 0.52;
export const OBJECT_TURN_S = 0.42;
export const FADE_S = 0.16;
export const FLOAT_PERIOD_S = 7;
export const FLOAT_PX = 3;

/** Margens da área do desenho (px de CSS): o título em cima, a legenda e os botões embaixo. */
export interface SceneInsets {
  top: number;
  bottom: number;
  side: number;
}

export interface SceneOptions {
  reducedMotion: boolean;
  insets: SceneInsets;
  /** Chamado no começo de cada virada (o som). */
  onFlipStart?: () => void;
}

interface Flip {
  from: number;
  to: number;
  startS: number;
  durS: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Cached {
  key: string;
  canvas: HTMLCanvasElement | null;
}

export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function createBitmap(
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/** O tampo da mesa: tábuas com veios, a luz quente do abajur no centro e a vinheta. */
export function drawDesk(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const rng = mulberry32(hashString('mesa do exame'));
  ctx.fillStyle = '#24160d';
  ctx.fillRect(0, 0, w, h);
  const plank = 118;
  for (let y = -rng.range(0, plank), row = 0; y < h; y += plank, row++) {
    const tone = 30 + ((row * 37) % 11);
    ctx.fillStyle = `rgb(${tone + 22}, ${tone + 6}, ${Math.round(tone * 0.6)})`;
    ctx.fillRect(0, y, w, plank);
    for (let k = 0; k < 16; k++) {
      const gy = y + rng.range(4, plank - 4);
      const amp = rng.range(1, 5);
      const freq = rng.range(0.004, 0.012);
      const phase = rng.range(0, Math.PI * 2);
      ctx.strokeStyle = rng.next() < 0.7 ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 214, 170, 0.05)';
      ctx.lineWidth = rng.range(0.6, 1.6);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const yy = gy + Math.sin(x * freq + phase) * amp;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    if (rng.next() < 0.6) {
      ctx.strokeStyle = 'rgba(10, 4, 0, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        rng.range(0, w),
        y + plank / 2,
        rng.range(10, 22),
        rng.range(4, 8),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, y, w, 2);
  }
  const lamp = ctx.createRadialGradient(w / 2, h * 0.44, 10, w / 2, h * 0.44, Math.max(w, h) * 0.6);
  lamp.addColorStop(0, 'rgba(255, 198, 120, 0.3)');
  lamp.addColorStop(1, 'rgba(255, 198, 120, 0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h);
  const vignette = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.32,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.78,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.74)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

export class SouvenirScene {
  readonly views: readonly SouvenirView[];
  private shown: number;
  private flip: Flip | null = null;
  private pending: number | null = null;
  private readonly bitmaps = new Map<number, Cached>();
  private readonly shadows = new Map<string, HTMLCanvasElement | null>();
  private desk: Cached = { key: '', canvas: null };
  private gutter: HTMLCanvasElement | null | undefined;

  constructor(
    private readonly souvenir: Souvenir,
    private readonly faces: readonly SouvenirFace[],
    private readonly options: SceneOptions,
    initialView = 0,
  ) {
    this.views = souvenirViews(souvenir.form, faces.length);
    this.shown = Math.max(0, Math.min(this.views.length - 1, initialView));
  }

  /** A vista assentada (a que está na mesa quando nada vira). */
  get view(): number {
    return this.shown;
  }

  /** Para onde a cena vai: a última vista pedida. */
  get target(): number {
    return this.pending ?? this.flip?.to ?? this.shown;
  }

  get turning(): boolean {
    return this.flip !== null;
  }

  /** Há o que animar: uma virada ou a flutuação do objeto. */
  get animating(): boolean {
    return this.flip !== null || (this.souvenir.form === 'OBJECT' && !this.options.reducedMotion);
  }

  /**
   * Pede a vista `to`. Sem virada, ela começa; durante uma, o pedido fica guardado (um só) e
   * sai quando a virada termina. Devolve se aceitou.
   */
  request(to: number, nowS: number): boolean {
    if (to < 0 || to >= this.views.length) return false;
    if (!this.flip) {
      if (to === this.shown) return false;
      this.start(this.shown, to, nowS);
      return true;
    }
    if (this.pending !== null || to === this.flip.to) return false;
    this.pending = to;
    return true;
  }

  /** Avança o relógio: fecha a virada e começa a guardada. */
  update(nowS: number): void {
    if (!this.flip || nowS - this.flip.startS < this.flip.durS) return;
    this.shown = this.flip.to;
    this.flip = null;
    const next = this.pending;
    this.pending = null;
    if (next !== null && next !== this.shown) this.start(this.shown, next, nowS);
  }

  private start(from: number, to: number, nowS: number): void {
    const durS = this.options.reducedMotion
      ? FADE_S
      : this.souvenir.form === 'BOOK'
        ? PAGE_TURN_S
        : OBJECT_TURN_S;
    this.flip = { from, to, startS: nowS, durS };
    this.options.onFlipStart?.();
  }

  private stage(w: number, h: number): Rect {
    const { top, bottom, side } = this.options.insets;
    return { x: side, y: top, w: Math.max(40, w - side * 2), h: Math.max(40, h - top - bottom) };
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, nowS: number): void {
    this.update(nowS);
    const deskKey = `${w}x${h}@${dpr}`;
    if (this.desk.key !== deskKey) {
      const made = createBitmap(w * dpr, h * dpr);
      if (made) {
        made.ctx.scale(dpr, dpr);
        drawDesk(made.ctx, w, h);
      }
      this.desk = { key: deskKey, canvas: made?.canvas ?? null };
      // Mudou o tamanho: as sombras e as faces antigas não servem mais.
      this.shadows.clear();
      this.bitmaps.clear();
    }
    if (this.desk.canvas) ctx.drawImage(this.desk.canvas, 0, 0, w, h);
    else drawDesk(ctx, w, h);
    const stage = this.stage(w, h);
    const flip = this.flip;
    const e = flip ? easeInOut(Math.min(1, (nowS - flip.startS) / flip.durS)) : 0;
    const fade =
      flip !== null && (this.options.reducedMotion || Math.abs(flip.to - flip.from) !== 1);
    if (flip && fade) {
      this.drawView(ctx, stage, dpr, nowS, flip.from, 1 - e);
      this.drawView(ctx, stage, dpr, nowS, flip.to, e);
    } else if (flip) {
      if (this.souvenir.form === 'BOOK') this.drawBookTurn(ctx, stage, dpr, flip, e);
      else
        this.drawSingle(
          ctx,
          stage,
          dpr,
          nowS,
          e < 0.5 ? flip.from : flip.to,
          1,
          Math.abs(Math.cos(Math.PI * e)),
        );
    } else {
      this.drawView(ctx, stage, dpr, nowS, this.shown, 1);
      this.prewarm(stage, dpr);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Trabalho de quadro parado: desenha uma face das vistas vizinhas, se faltar (a virada não
   * engasga). Devolve se desenhou alguma.
   */
  idle(w: number, h: number, dpr: number): boolean {
    return this.prewarm(this.stage(w, h), dpr);
  }

  /** Desenha, fora da virada, uma face das vistas vizinhas por quadro: a virada não engasga. */
  private prewarm(stage: Rect, dpr: number): boolean {
    for (const v of [this.shown + 1, this.shown - 1]) {
      const view = this.views[v];
      if (!view) continue;
      const indices = view.kind === 'SINGLE' ? [view.face] : [view.left, view.right];
      for (const i of indices) {
        if (i === null) continue;
        const size = this.sizeOf(i, stage);
        const key = this.keyOf(size, dpr);
        if (this.bitmaps.get(i)?.key !== key) {
          this.faceBitmap(i, size, dpr);
          return true;
        }
      }
    }
    return false;
  }

  private drawView(
    ctx: CanvasRenderingContext2D,
    stage: Rect,
    dpr: number,
    nowS: number,
    index: number,
    alpha: number,
  ): void {
    const view = this.views[index];
    if (!view) return;
    if (view.kind === 'SINGLE') {
      this.drawSingle(ctx, stage, dpr, nowS, view.face, alpha, 1);
      return;
    }
    ctx.globalAlpha = alpha;
    this.drawSpread(ctx, stage, dpr, view, this.offsetOf(index, stage));
    ctx.globalAlpha = 1;
  }

  // --- caderno ---------------------------------------------------------------

  private book(stage: Rect): { pageW: number; pageH: number; top: number; cx: number } {
    const { w, h } = faceSize(this.faces[0] as SouvenirFace);
    const pageH = Math.min(stage.h * 0.94, (stage.w / 2) * (h / w) * 0.92);
    const pageW = (pageH * w) / h;
    return { pageW, pageH, top: stage.y + (stage.h - pageH) / 2, cx: stage.x + stage.w / 2 };
  }

  /** Fechado, o caderno fica no centro: a capa desliza meia página para a esquerda. */
  private offsetOf(viewIndex: number, stage: Rect): number {
    const view = this.views[viewIndex];
    if (!view || view.kind !== 'SPREAD') return 0;
    const { pageW } = this.book(stage);
    if (view.left === null) return -pageW / 2;
    if (view.right === null) return pageW / 2;
    return 0;
  }

  private drawSpread(
    ctx: CanvasRenderingContext2D,
    stage: Rect,
    dpr: number,
    view: Extract<SouvenirView, { kind: 'SPREAD' }>,
    offset: number,
  ): void {
    const g = this.book(stage);
    const spine = g.cx + offset;
    const open = view.left !== null && view.right !== null;
    const left = open || view.left !== null;
    const right = open || view.right !== null;
    this.bookShadow(ctx, spine, g, left, right, dpr);
    if (open) this.boards(ctx, spine, g, true, true);
    if (view.left !== null) this.page(ctx, view.left, spine - g.pageW, g, dpr, 'LEFT', open);
    if (view.right !== null) this.page(ctx, view.right, spine, g, dpr, 'RIGHT', open);
  }

  private drawBookTurn(
    ctx: CanvasRenderingContext2D,
    stage: Rect,
    dpr: number,
    flip: Flip,
    e: number,
  ): void {
    const a = Math.min(flip.from, flip.to);
    const va = this.views[a];
    const vb = this.views[a + 1];
    if (!va || !vb || va.kind !== 'SPREAD' || vb.kind !== 'SPREAD') return;
    const g = this.book(stage);
    const forward = flip.to > flip.from;
    const theta = Math.PI * (forward ? e : 1 - e);
    const offset = lerp(this.offsetOf(flip.from, stage), this.offsetOf(flip.to, stage), e);
    const spine = g.cx + offset;
    const cos = Math.cos(theta);
    const underLeft = va.left;
    const underRight = vb.right;
    this.bookShadow(
      ctx,
      spine,
      g,
      underLeft !== null || cos < 0,
      underRight !== null || cos >= 0,
      dpr,
    );
    this.boards(ctx, spine, g, underLeft !== null, underRight !== null);
    if (underLeft !== null) this.page(ctx, underLeft, spine - g.pageW, g, dpr, 'LEFT', true);
    if (underRight !== null) this.page(ctx, underRight, spine, g, dpr, 'RIGHT', true);
    // A folha que vira: a frente à direita até 90°, o verso à esquerda depois.
    const lift = g.pageH * 0.03 * Math.sin(theta);
    const leafW = g.pageW * Math.abs(cos);
    const faceIndex = cos >= 0 ? va.right : vb.left;
    const x = cos >= 0 ? spine : spine - leafW;
    const fall = 34 * Math.sin(theta);
    // A sombra da folha na página de baixo.
    if (fall > 1) {
      const edge = cos >= 0 ? spine + leafW : spine - leafW;
      const dir = cos >= 0 ? 1 : -1;
      const shade = ctx.createLinearGradient(edge, 0, edge + dir * fall, 0);
      shade.addColorStop(0, 'rgba(0, 0, 0, 0.32)');
      shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shade;
      ctx.fillRect(Math.min(edge, edge + dir * fall), g.top, fall, g.pageH);
    }
    if (faceIndex !== null && leafW > 0.5) {
      const bitmap = this.faceBitmap(faceIndex, { w: g.pageW, h: g.pageH }, dpr);
      if (bitmap) ctx.drawImage(bitmap, x, g.top - lift, leafW, g.pageH + lift * 2);
      // A folha escurece de lado, perto dos 90°.
      ctx.fillStyle = `rgba(0, 0, 0, ${(0.32 * (1 - Math.abs(cos))).toFixed(3)})`;
      ctx.fillRect(x, g.top - lift, leafW, g.pageH + lift * 2);
    }
  }

  private page(
    ctx: CanvasRenderingContext2D,
    index: number,
    x: number,
    g: { pageW: number; pageH: number; top: number },
    dpr: number,
    side: 'LEFT' | 'RIGHT',
    open: boolean,
  ): void {
    const face = this.faces[index];
    const bitmap = this.faceBitmap(index, { w: g.pageW, h: g.pageH }, dpr);
    if (!open) {
      // O miolo do caderno fechado aparece na borda, por baixo da capa.
      ctx.fillStyle = '#d9cba6';
      ctx.fillRect(x + (side === 'RIGHT' ? 6 : -6), g.top + 6, g.pageW, g.pageH - 4);
    }
    if (bitmap) ctx.drawImage(bitmap, x, g.top, g.pageW, g.pageH);
    if (open && face?.surface === 'PAGE')
      this.gutterShadow(ctx, side === 'LEFT' ? x + g.pageW : x, g, side);
  }

  /** As capas por baixo das páginas, um pouco maiores que elas. */
  private boards(
    ctx: CanvasRenderingContext2D,
    spine: number,
    g: { pageW: number; pageH: number; top: number },
    left: boolean,
    right: boolean,
  ): void {
    ctx.fillStyle = '#45331f';
    ctx.strokeStyle = '#2a1e12';
    ctx.lineWidth = 2;
    if (left) {
      ctx.fillRect(spine - g.pageW - 9, g.top - 8, g.pageW + 9, g.pageH + 16);
      ctx.strokeRect(spine - g.pageW - 9, g.top - 8, g.pageW + 9, g.pageH + 16);
    }
    if (right) {
      ctx.fillRect(spine, g.top - 8, g.pageW + 9, g.pageH + 16);
      ctx.strokeRect(spine, g.top - 8, g.pageW + 9, g.pageH + 16);
    }
  }

  private gutterShadow(
    ctx: CanvasRenderingContext2D,
    spine: number,
    g: { pageW: number; pageH: number; top: number },
    side: 'LEFT' | 'RIGHT',
  ): void {
    if (this.gutter === undefined) {
      const made = createBitmap(64, 4);
      if (made) {
        const grad = made.ctx.createLinearGradient(0, 0, 64, 0);
        grad.addColorStop(0, 'rgba(40, 24, 8, 0.42)');
        grad.addColorStop(0.35, 'rgba(40, 24, 8, 0.12)');
        grad.addColorStop(1, 'rgba(40, 24, 8, 0)');
        made.ctx.fillStyle = grad;
        made.ctx.fillRect(0, 0, 64, 4);
      }
      this.gutter = made?.canvas ?? null;
    }
    if (!this.gutter) return;
    const gw = g.pageW * 0.16;
    ctx.save();
    ctx.translate(spine, g.top);
    if (side === 'LEFT') ctx.scale(-1, 1);
    ctx.drawImage(this.gutter, 0, 0, gw, g.pageH);
    ctx.restore();
  }

  private bookShadow(
    ctx: CanvasRenderingContext2D,
    spine: number,
    g: { pageW: number; pageH: number; top: number },
    left: boolean,
    right: boolean,
    dpr: number,
  ): void {
    if (!left && !right) return;
    const x0 = left ? spine - g.pageW : spine;
    const x1 = right ? spine + g.pageW : spine;
    const r = { x: x0 + 8, y: g.top + 12, w: x1 - x0, h: g.pageH };
    this.softShadow(ctx, r, r, dpr);
  }

  // --- objeto ----------------------------------------------------------------

  private sizeOf(index: number, stage: Rect): { w: number; h: number } {
    const face = this.faces[index] as SouvenirFace;
    if (this.souvenir.form === 'BOOK') {
      const g = this.book(stage);
      return { w: g.pageW, h: g.pageH };
    }
    const { w, h } = faceSize(face);
    const fill = face.surface === 'OBJECT' ? 1 : 0.9;
    const u = Math.min((stage.w * fill) / w, (stage.h * fill) / h);
    return { w: w * u, h: h * u };
  }

  private drawSingle(
    ctx: CanvasRenderingContext2D,
    stage: Rect,
    dpr: number,
    nowS: number,
    index: number,
    alpha: number,
    scaleX: number,
  ): void {
    const face = this.faces[index];
    if (!face) return;
    const size = this.sizeOf(index, stage);
    const float = this.options.reducedMotion
      ? 0
      : Math.sin((nowS * Math.PI * 2) / FLOAT_PERIOD_S) * FLOAT_PX;
    const cx = stage.x + stage.w / 2;
    const y = stage.y + (stage.h - size.h) / 2 + float;
    const w = size.w * scaleX;
    ctx.globalAlpha = alpha;
    if (face.surface !== 'OBJECT' && w > 1) {
      this.softShadow(ctx, size, { x: cx - w / 2 + 8, y: y + 12, w, h: size.h }, dpr);
    }
    const bitmap = this.faceBitmap(index, size, dpr);
    if (bitmap && w > 0.5) ctx.drawImage(bitmap, cx - w / 2, y, w, size.h);
    ctx.globalAlpha = 1;
  }

  // --- bitmaps ---------------------------------------------------------------

  private keyOf(size: { w: number; h: number }, dpr: number): string {
    return `${Math.round(size.w * dpr)}x${Math.round(size.h * dpr)}`;
  }

  private faceBitmap(
    index: number,
    size: { w: number; h: number },
    dpr: number,
  ): HTMLCanvasElement | null {
    const key = this.keyOf(size, dpr);
    const cached = this.bitmaps.get(index);
    if (cached?.key === key) return cached.canvas;
    const face = this.faces[index];
    if (!face) return null;
    const logical = faceSize(face);
    const made = createBitmap(size.w * dpr, size.h * dpr);
    if (made) {
      made.ctx.scale(made.canvas.width / logical.w, made.canvas.height / logical.h);
      renderFace(made.ctx, this.souvenir, this.faces, index);
    }
    this.bitmaps.set(index, { key, canvas: made?.canvas ?? null });
    return made?.canvas ?? null;
  }

  /**
   * Sombra suave (um retângulo borrado), feita uma vez por tamanho (`size`) e esticada até `r`
   * (na virada do objeto, a largura muda a cada quadro e a sombra não é refeita).
   */
  private softShadow(
    ctx: CanvasRenderingContext2D,
    size: { w: number; h: number },
    r: Rect,
    dpr: number,
  ): void {
    const blur = 16;
    const pad = blur * 2;
    const key = `${Math.round(size.w)}x${Math.round(size.h)}@${dpr}`;
    let sprite = this.shadows.get(key);
    if (sprite === undefined) {
      const made = createBitmap((size.w + pad * 2) * dpr, (size.h + pad * 2) * dpr);
      if (made) {
        made.ctx.scale(dpr, dpr);
        made.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        made.ctx.shadowBlur = blur * dpr;
        made.ctx.shadowOffsetX = 10000 * dpr;
        made.ctx.fillStyle = '#000';
        made.ctx.fillRect(pad - 10000, pad, size.w, size.h);
      }
      sprite = made?.canvas ?? null;
      this.shadows.set(key, sprite);
    }
    const sx = r.w / size.w;
    if (sprite) ctx.drawImage(sprite, r.x - pad * sx, r.y - pad, r.w + pad * 2 * sx, r.h + pad * 2);
  }
}
