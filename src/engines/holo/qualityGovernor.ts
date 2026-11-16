/**
 * Queda automática de qualidade da mesa (holo-table §5.7): se o FPS médio ficar abaixo de 50
 * durante 3 s, a qualidade da mesa (não a global) cai um nível. Alimentado com o `dt` de cada
 * quadro; a cada janela de 3 s decide e recomeça, de modo que o nível novo ganha uma janela limpa.
 */
export const FPS_FLOOR = 50;
export const WINDOW_S = 3;
/** Quadros mais longos que isto (aba em segundo plano, travada) não entram na média. */
export const MAX_FRAME_S = 1;

export class QualityGovernor {
  private elapsedS = 0;
  private frames = 0;

  /** FPS médio da janela corrente (0 sem quadros). */
  get averageFps(): number {
    return this.elapsedS > 0 ? this.frames / this.elapsedS : 0;
  }

  /** Conta o quadro; `true` quando a janela de 3 s fecha com média abaixo do piso. */
  sample(dtS: number): boolean {
    if (!(dtS > 0) || dtS > MAX_FRAME_S) return false;
    this.elapsedS += dtS;
    this.frames += 1;
    if (this.elapsedS < WINDOW_S) return false;
    // A folga de 1e-6 absorve o erro de soma dos `dt` (50 FPS exatos não são "abaixo").
    const slow = this.averageFps < FPS_FLOOR - 1e-6;
    this.reset();
    return slow;
  }

  /** Recomeça a janela (troca de cena ou de nível). */
  reset(): void {
    this.elapsedS = 0;
    this.frames = 0;
  }
}
