/**
 * `UI_HOVER` nos botões e no foco (audio §4): o som toca ao passar o mouse e quando o foco chega
 * por teclado ou gamepad, no máximo uma vez a cada 70 ms, para varrer vários botões não virar ruído.
 * O mudo e os volumes são do `AudioEngine` (o master zerado silencia); sem o primeiro gesto do
 * jogador, o `play()` não faz nada.
 */
import { AudioEngine } from '@/audio/AudioEngine';

export const HOVER_MIN_GAP_MS = 70;

let lastPlayedMs = Number.NEGATIVE_INFINITY;

/** Toca o `UI_HOVER`; devolve `false` quando ainda está no intervalo mínimo. */
export function playHover(nowMs: number = performance.now()): boolean {
  if (nowMs - lastPlayedMs < HOVER_MIN_GAP_MS) return false;
  lastPlayedMs = nowMs;
  AudioEngine.get().play('UI_HOVER');
  return true;
}

/** Reinicia o intervalo (testes). */
export function resetHoverSound(): void {
  lastPlayedMs = Number.NEGATIVE_INFINITY;
}

/**
 * O foco veio de uma navegação? Com o gamepad ativo o foco é programático (sempre vale); com o
 * teclado, só se for `:focus-visible` (o foco programático depois de um clique não soa); o
 * mouse já tocou ao entrar.
 */
export function focusFromNavigation(el: Element): boolean {
  if (document.documentElement.dataset.inputDevice === 'GAMEPAD') return true;
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}

/** Só o mouse (e a caneta) "passa por cima"; o toque não tem hover. */
export function isHoverPointer(pointerType: string | undefined): boolean {
  return pointerType === undefined || pointerType === '' || pointerType === 'mouse';
}
