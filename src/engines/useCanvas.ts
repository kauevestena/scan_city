import { useEffect, useRef, useState, type RefObject } from 'react';
import { useGameStore } from '@/state/store';
import { currentDpr, setupCanvas, type CanvasSurface } from './canvas';
import { RenderScaleGovernor, renderScaleCap } from './renderScale';

/**
 * Resolução adaptativa (ADR-033): a escala do buffer segue o tempo de quadro, entre `floor` e o
 * teto da qualidade (`renderScaleCap`). `kind` identifica o canvas para lembrar, na sessão, a
 * escala que se segurou: a próxima visita já começa nela.
 */
export interface AdaptiveResolution {
  kind: 'flight' | 'holo';
  /** Menor escala aceita (px de buffer por px de CSS). */
  floor: number;
  /** O desenho cobre o canvas inteiro: contexto sem canal alfa (mais barato de compor). */
  opaque?: boolean;
}

/** A última escala de cada canvas adaptativo nesta sessão. */
const remembered = new Map<AdaptiveResolution['kind'], number>();

/** Só para testes: esquece as escalas lembradas. */
export function resetRememberedScales(): void {
  remembered.clear();
}

/** A escala em uso (ou a última) de um canvas adaptativo, para o painel F9; `null` se nunca abriu. */
export function renderScaleOf(kind: string): number | null {
  return remembered.get(kind as AdaptiveResolution['kind']) ?? null;
}

/**
 * Liga um `<canvas>` à área de conteúdo do seu elemento pai, respeitando o `devicePixelRatio`
 * (ou a escala adaptativa, com `adaptive`). O canvas deve preencher o pai por CSS
 * (`h-full w-full`); o retorno é `null` até a primeira medição. Com `adaptive`, o canvas leva
 * a escala em uso em `data-render-scale`.
 */
export function useCanvas(
  ref: RefObject<HTMLCanvasElement | null>,
  adaptive?: AdaptiveResolution,
): CanvasSurface | null {
  const [surface, setSurface] = useState<CanvasSurface | null>(null);
  const quality = useGameStore((s) => s.settings.quality);
  const [scale, setScale] = useState<number | null>(null);
  const governor = useRef<RenderScaleGovernor | null>(null);
  const kind = adaptive?.kind;
  const floor = adaptive?.floor;
  const opaque = adaptive?.opaque === true;

  // O governador: mede o intervalo entre quadros e troca a escala quando ele pede.
  useEffect(() => {
    if (kind === undefined || floor === undefined) return;
    const limits = () => renderScaleCap(quality, currentDpr());
    if (governor.current) governor.current.setLimits(limits(), floor);
    else governor.current = new RenderScaleGovernor(limits(), floor, remembered.get(kind));
    const g = governor.current;
    remembered.set(kind, g.scale);
    setScale(g.scale);
    let last: number | null = null;
    let handle = requestAnimationFrame(function tick(t) {
      if (last !== null) {
        const next = g.sample(t - last);
        if (next !== null) {
          remembered.set(kind, next);
          setScale(next);
        }
      }
      last = t;
      handle = requestAnimationFrame(tick);
    });
    // Zoom e troca de monitor mudam o DPR, e com ele o teto.
    const onResize = () => {
      const next = g.setLimits(limits(), floor);
      remembered.set(kind, next);
      setScale(next);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(handle);
      window.removeEventListener('resize', onResize);
    };
  }, [kind, floor, quality]);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    if (kind !== undefined && scale === null) return;

    const measure = () => {
      const dpr = scale ?? currentDpr();
      // Área de conteúdo do pai (sem borda): é o espaço que o canvas ocupa.
      const next = setupCanvas(canvas, host.clientWidth, host.clientHeight, dpr, opaque);
      if (kind !== undefined) canvas.dataset.renderScale = dpr.toFixed(2);
      setSurface((prev) =>
        prev &&
        next &&
        prev.ctx === next.ctx &&
        prev.width === next.width &&
        prev.height === next.height &&
        prev.dpr === next.dpr
          ? prev
          : next,
      );
    };

    measure();
    // Zoom do navegador e troca de monitor mudam o DPR sem redimensionar o elemento.
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(host);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [ref, scale, kind, opaque]);

  return surface;
}
