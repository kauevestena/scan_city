/**
 * `AudioContext` mínimo para testes (audio §5): registra os nós criados e as chamadas.
 * As rampas aplicam o valor final na hora; rampas exponenciais rejeitam valores ≤ 0,
 * como a API real.
 */
export class FakeParam {
  value: number;
  readonly calls: Array<[string, number, number]> = [];
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(v: number, t: number) {
    this.calls.push(['set', v, t]);
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(['linear', v, t]);
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (!(v > 0)) throw new RangeError(`rampa exponencial até ${v}`);
    this.calls.push(['exp', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.calls.push(['target', v, t]);
    this.value = v;
    return this;
  }
  cancelScheduledValues(t: number) {
    this.calls.push(['cancel', 0, t]);
    return this;
  }
}

export class FakeNode {
  readonly kind: string;
  readonly connections: Array<FakeNode | FakeParam> = [];
  constructor(kind: string) {
    this.kind = kind;
  }
  connect(dest: FakeNode | FakeParam) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() {
    this.connections.length = 0;
  }
}

export class FakeSource extends FakeNode {
  started: number | null = null;
  stopped: number | null = null;
  start(t = 0) {
    if (this.started !== null) throw new Error('start() chamado duas vezes');
    this.started = t;
  }
  stop(t = 0) {
    if (!Number.isFinite(t)) throw new TypeError('stop() exige tempo finito');
    this.stopped = t;
  }
}

export class FakeOscillator extends FakeSource {
  type = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
  constructor() {
    super('oscillator');
  }
}

export class FakeBufferSource extends FakeSource {
  buffer: unknown = null;
  loop = false;
  constructor() {
    super('bufferSource');
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
  constructor() {
    super('gain');
  }
}

export class FakeBiquad extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
  constructor() {
    super('biquad');
  }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  readonly sampleRate = 8000;
  readonly destination = new FakeNode('destination');
  readonly nodes: FakeNode[] = [];
  resumed = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  private track<T extends FakeNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  createOscillator() {
    return this.track(new FakeOscillator());
  }
  createGain() {
    return this.track(new FakeGain());
  }
  createBiquadFilter() {
    return this.track(new FakeBiquad());
  }
  createBufferSource() {
    return this.track(new FakeBufferSource());
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { length, getChannelData: () => data };
  }
  createDynamicsCompressor() {
    return this.track(
      Object.assign(new FakeNode('compressor'), {
        threshold: new FakeParam(-24),
        ratio: new FakeParam(12),
      }),
    );
  }
  createDelay() {
    return this.track(Object.assign(new FakeNode('delay'), { delayTime: new FakeParam(0) }));
  }
  createStereoPanner() {
    return this.track(Object.assign(new FakeNode('panner'), { pan: new FakeParam(0) }));
  }
  resume() {
    this.resumed++;
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  /** Nós criados depois do índice `from`, por tipo. */
  created(kind: string, from = 0): FakeNode[] {
    return this.nodes.slice(from).filter((n) => n.kind === kind);
  }
}

export function fakeContextFactory(): () => AudioContext {
  return () => new FakeAudioContext() as unknown as AudioContext;
}
