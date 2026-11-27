import { mulberry32 } from '@/lib/rng';
import { canvasContext } from '@/test/fakeFonts';
import {
  charMeasure,
  drawLine,
  fontFor,
  HAND_FONTS,
  handFont,
  INKS,
  isFontInstalled,
  parseMarkup,
  plainText,
  resetHandFont,
  wrapSpans,
} from './hand';

/** Uma unidade por letra. */
const unit = (text: string) => [...text].length;
const lineText = (line: { words: Array<{ pieces: Array<{ text: string }> }> }) =>
  line.words.map((w) => w.pieces.map((p) => p.text).join('')).join(' ');

afterEach(() => resetHandFont());

describe('marcação do texto (catalog §11.1)', () => {
  it('~~riscado~~ e __sublinhado__ viram trechos; o resto é texto comum', () => {
    expect(parseMarkup('a ~~b c~~ d __e__')).toEqual([
      { text: 'a ', strike: false, underline: false },
      { text: 'b c', strike: true, underline: false },
      { text: ' d ', strike: false, underline: false },
      { text: 'e', strike: false, underline: true },
    ]);
    expect(parseMarkup('sem marcas')).toEqual([
      { text: 'sem marcas', strike: false, underline: false },
    ]);
  });

  it('para o leitor de tela, o riscado é anunciado e o sublinhado some', () => {
    expect(plainText('Ou do chão. ~~Nunca minha.~~ Às vezes minha.')).toBe(
      'Ou do chão. [riscado: Nunca minha.] Às vezes minha.',
    );
    expect(plainText('__Fechou na mosca.__')).toBe('Fechou na mosca.');
  });
});

describe('quebra de linha', () => {
  it('nenhuma linha passa da largura e nenhuma palavra se perde', () => {
    const text = 'Meça duas vezes. Confira três. Reclame quatro.';
    const lines = wrapSpans(parseMarkup(text), 16, unit);
    for (const line of lines) expect(line.width).toBeLessThanOrEqual(16);
    expect(lines.map(lineText).join(' ')).toBe(text);
  });

  it('o espaço não separável segura o número e a unidade na mesma linha', () => {
    const lines = wrapSpans(parseMarkup('GSD = 5 cm. Nada mal.'), 8, unit);
    expect(lines.flatMap((l) => l.words.map((w) => w.pieces[0]?.text))).toContain('5 cm.');
  });

  it('palavra maior que a linha é cortada; estilos diferentes ficam na mesma palavra', () => {
    const long = wrapSpans(parseMarkup('abcdefghij'), 4, unit);
    expect(long.map(lineText)).toEqual(['abcd', 'efgh', 'ij']);
    const mixed = wrapSpans(parseMarkup('ab__cd__ ef'), 10, unit);
    expect(mixed[0]?.words[0]?.pieces.map((p) => [p.text, p.underline])).toEqual([
      ['ab', false],
      ['cd', true],
    ]);
  });
});

describe('a letra à mão (ADR-036 §4)', () => {
  it('sem fonte manuscrita instalada, vale a serifada itálica', () => {
    const ctx = canvasContext();
    expect(handFont(ctx).family).toBeNull();
    expect(fontFor(ctx, 'HAND', 20)).toMatch(/^italic 20\.00px Georgia/);
    expect(fontFor(ctx, 'PRINT', 12)).toMatch(/^12\.00px Georgia/);
    expect(fontFor(ctx, 'ENGRAVED', 12)).toMatch(/^600 12\.00px/);
  });

  it('acha a primeira fonte instalada pela largura medida, com o ajuste de tamanho dela', () => {
    const ctx = canvasContext();
    // Só "Ink Free" existe: com ela a largura muda; as outras caem na genérica de reserva.
    vi.spyOn(ctx, 'measureText').mockImplementation((text: string) => {
      const factor = ctx.font.includes('Ink Free') ? 1.3 : ctx.font.includes('monospace') ? 1 : 0.9;
      return { width: text.length * factor } as TextMetrics;
    });
    expect(isFontInstalled(ctx, 'Segoe Print')).toBe(false);
    expect(isFontInstalled(ctx, 'Ink Free')).toBe(true);
    expect(handFont(ctx)).toBe(HAND_FONTS[1]);
    expect(fontFor(ctx, 'HAND', 20)).toBe('20.80px "Ink Free", cursive');
    // Detectada uma vez: a mesma resposta sem medir de novo.
    const measures = vi.mocked(ctx.measureText).mock.calls.length;
    handFont(ctx);
    expect(vi.mocked(ctx.measureText).mock.calls.length).toBe(measures);
  });

  it('desenha letra por letra (os espaços só avançam), risca o riscado e repete com a mesma seed', () => {
    // A detecção da fonte acontece uma vez só: fora das duas medições comparadas.
    handFont(canvasContext());
    const draw = () => {
      const ctx = canvasContext();
      const font = fontFor(ctx, 'HAND', 19);
      const measure = charMeasure(ctx, font);
      const line = wrapSpans(parseMarkup('ab ~~cd~~'), 100, measure)[0];
      if (!line) throw new Error('sem linha');
      const fill = vi.spyOn(ctx, 'fillText');
      const stroke = vi.spyOn(ctx, 'stroke');
      drawLine(ctx, line, 10, 50, { ink: INKS.INK, font, px: 19, measure, rng: mulberry32(7) });
      return { ctx, fill, stroke };
    };
    const a = draw();
    // Quatro letras, cada uma com o traço da pressão da caneta.
    expect(a.fill.mock.calls.map((c) => c[0])).toEqual(['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd']);
    // O riscado: duas passadas de caneta.
    expect(a.stroke).toHaveBeenCalledTimes(2);
    const b = draw();
    const events = (ctx: CanvasRenderingContext2D) =>
      JSON.stringify((ctx as unknown as { __getEvents(): unknown[] }).__getEvents());
    expect(events(b.ctx)).toBe(events(a.ctx));
  });

  it('impresso e gravado não tremem; o gravado tem o brilho embaixo', () => {
    const ctx = canvasContext();
    const font = fontFor(ctx, 'ENGRAVED', 20);
    const measure = charMeasure(ctx, font, 1.6);
    const line = wrapSpans(parseMarkup('AB'), 100, measure)[0];
    if (!line) throw new Error('sem linha');
    const fill = vi.spyOn(ctx, 'fillText');
    const rotate = vi.spyOn(ctx, 'rotate');
    drawLine(ctx, line, 0, 40, {
      ink: INKS.ENGRAVED,
      font,
      px: 20,
      measure,
      rng: mulberry32(1),
      tracking: 1.6,
    });
    expect(rotate).not.toHaveBeenCalled();
    // Cada letra: o brilho 1 px abaixo e o sulco na linha.
    expect(fill.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ['A', 41],
      ['A', 40],
      ['B', 41],
      ['B', 40],
    ]);
  });
});
