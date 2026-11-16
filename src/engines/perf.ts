/**
 * Contador de tempo por etapa do quadro (survey-flight §5.18, holo-table §5.7), exibido no painel
 * F9. Cada instante pertence a **uma** etapa: `enter(i)` fecha a que estava aberta e abre a `i`, e
 * `leave()` fecha sem abrir outra, então as etapas somam o tempo coberto, sem contar duas vezes.
 * Um quadro é uma sequência de `enter`; `endFrame()` o fecha e o leva à média móvel.
 *
 * Desligado (o padrão), `enter`, `leave` e `endFrame` custam um `if`: o jogo só mede com o painel
 * de depuração aberto.
 */

/** Peso do quadro novo na média móvel exponencial (≈ 20 quadros de memória). */
export const SMOOTHING = 0.1;

export interface StageReading {
  stage: string;
  /** Média móvel do tempo da etapa por quadro, em ms. */
  ms: number;
}

export class StageTimer {
  private on = false;
  /** Etapa aberta agora (-1: nenhuma) e o instante em que abriu. */
  private open = -1;
  private openedAt = 0;
  private frames = 0;
  private readonly sum: Float64Array;
  private readonly avg: Float64Array;

  constructor(
    /** Nome da seção no painel (ex.: "Voo"). */
    readonly name: string,
    /** Rótulos das etapas, na ordem em que o quadro as percorre. */
    readonly stages: readonly string[],
    private readonly now: () => number = () => performance.now(),
  ) {
    this.sum = new Float64Array(stages.length);
    this.avg = new Float64Array(stages.length);
  }

  get enabled(): boolean {
    return this.on;
  }

  /** Liga ou desliga a medição; ligar recomeça do zero. */
  setEnabled(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.open = -1;
    this.frames = 0;
    this.sum.fill(0);
    this.avg.fill(0);
  }

  /** Fecha a etapa aberta (somando o tempo dela) e abre a `stage`. */
  enter(stage: number): void {
    if (!this.on) return;
    const t = this.now();
    if (this.open >= 0) this.sum[this.open] = (this.sum[this.open] as number) + (t - this.openedAt);
    this.open = stage;
    this.openedAt = t;
  }

  /** Fecha a etapa aberta, sem abrir outra (por exemplo, ao fim de um passo de `update`). */
  leave(): void {
    if (!this.on || this.open < 0) return;
    this.sum[this.open] = (this.sum[this.open] as number) + (this.now() - this.openedAt);
    this.open = -1;
  }

  /** Fecha o quadro: soma o que sobrou aberto e leva os tempos à média móvel. */
  endFrame(): void {
    if (!this.on) return;
    this.leave();
    const first = this.frames === 0;
    for (let i = 0; i < this.sum.length; i++) {
      const ms = this.sum[i] as number;
      this.avg[i] = first
        ? ms
        : (this.avg[i] as number) + (ms - (this.avg[i] as number)) * SMOOTHING;
      this.sum[i] = 0;
    }
    this.frames++;
  }

  /** Quadros fechados desde que a medição ligou. */
  get frameCount(): number {
    return this.frames;
  }

  /** Média por etapa, na ordem das etapas. */
  readings(): StageReading[] {
    return this.stages.map((stage, i) => ({ stage, ms: this.avg[i] as number }));
  }

  /** Soma das médias: o custo médio do quadro nas etapas medidas, em ms. */
  get totalMs(): number {
    let total = 0;
    for (let i = 0; i < this.avg.length; i++) total += this.avg[i] as number;
    return total;
  }
}

/** Etapas do voo, na ordem do quadro (survey-flight §5.18: terreno, objetos, HUD). */
export const FLIGHT_STAGE = {
  UPDATE: 0,
  HUD: 1,
  SCENE: 2,
  GRID: 3,
  TERRAIN: 4,
  OBJECTS: 5,
  OVERLAYS: 6,
  SPRITE: 7,
} as const;

/** Etapas da mesa holográfica (holo-table §5.7). */
export const HOLO_STAGE = { UPDATE: 0, SCENE: 1, RASTER: 2, SPRITES: 3 } as const;

/** Etapas do mapa-múndi. */
export const WORLD_STAGE = { UPDATE: 0, CHUNKS: 1, ANIMATED: 2, ATMOSPHERE: 3 } as const;

export const PERF = {
  flight: new StageTimer('Voo', [
    'simulação (update)',
    'HUD (publicação)',
    'cena (céu e lista de objetos)',
    'grade do terreno (amostragem)',
    'terreno (quads e curvas)',
    'objetos, sombras e alvos',
    'sobreposições (LiDAR, clima…)',
    'aeronave',
  ]),
  holo: new StageTimer('Mesa holográfica', [
    'simulação (update)',
    'cena (listas do quadro)',
    'renderer 3D (projeção, ordem e desenho)',
    'rótulos e miniaturas',
  ]),
  world: new StageTimer('Mapa-múndi', [
    'simulação (update)',
    'chunks (cache)',
    'camada animada',
    'atmosfera',
  ]),
} as const;

/** Orçamento de cada tela, em ms por quadro (survey-flight §5.18, holo-table §5.7, REQ-NFR-001). */
export const PERF_BUDGET_MS = { flight: 12, holo: 10, world: 1000 / 58 } as const;

/** Liga ou desliga todos os contadores. */
export function setPerfEnabled(on: boolean): void {
  for (const timer of Object.values(PERF)) timer.setEnabled(on);
}

let perfUsers = 0;

/**
 * Quem quer ver os tempos (o painel F9) liga os contadores aqui e devolve a função que larga o
 * pedido: eles só ficam ligados enquanto houver alguém olhando.
 */
export function acquirePerf(): () => void {
  perfUsers++;
  if (perfUsers === 1) setPerfEnabled(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    perfUsers--;
    if (perfUsers === 0) setPerfEnabled(false);
  };
}
