import { hash2, hashString, mulberry32 } from './rng';

describe('mulberry32', () => {
  it('produz a mesma sequência de 1.000 valores para a mesma seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('seeds diferentes divergem e os valores ficam em [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let equal = 0;
    for (let i = 0; i < 1000; i++) {
      const x = a.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === b.next()) equal++;
    }
    expect(equal).toBeLessThan(5);
  });

  it('normal() tem média ≈ 0 e desvio ≈ 1 em 10.000 amostras', () => {
    const rng = mulberry32(777);
    const n = 10000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const z = rng.normal();
      sum += z;
      sumSq += z * z;
    }
    const mean = sum / n;
    const std = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(std - 1)).toBeLessThan(0.05);
  });

  it('fork() é determinístico e independente do consumo do pai', () => {
    const fresh = mulberry32(42);
    const consumed = mulberry32(42);
    for (let i = 0; i < 137; i++) consumed.next();
    const f1 = fresh.fork('x');
    const f2 = consumed.fork('x');
    for (let i = 0; i < 100; i++) expect(f1.next()).toBe(f2.next());
  });

  it('fork() com rótulos ou seeds diferentes gera sequências diferentes', () => {
    const base = mulberry32(42);
    expect(base.fork('x').next()).not.toBe(base.fork('y').next());
    expect(base.fork('x').next()).not.toBe(mulberry32(43).fork('x').next());
    expect(base.fork('x').next()).not.toBe(mulberry32(42).next());
  });

  it('int() cobre o intervalo fechado e range() o semiaberto', () => {
    const rng = mulberry32(9);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const k = rng.int(3, 6);
      expect(Number.isInteger(k)).toBe(true);
      seen.add(k);
      const r = rng.range(-2, 5);
      expect(r).toBeGreaterThanOrEqual(-2);
      expect(r).toBeLessThan(5);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
    expect(rng.int(7, 7)).toBe(7);
    expect(rng.int(6, 3)).toBeGreaterThanOrEqual(3);
  });

  it('pick() escolhe elementos do array e rejeita array vazio', () => {
    const rng = mulberry32(5);
    const items = ['a', 'b', 'c'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(rng.pick(items));
    expect(seen.size).toBe(3);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('shuffle() devolve uma permutação determinística sem alterar a entrada', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = input.slice();
    const a = mulberry32(11).shuffle(input);
    const b = mulberry32(11).shuffle(input);
    expect(input).toEqual(copy);
    expect(a).toEqual(b);
    expect(a.slice().sort((x, y) => x - y)).toEqual(input);
    expect(a).not.toEqual(input);
  });
});

describe('hashString', () => {
  it('implementa FNV-1a de 32 bits (vetores conhecidos)', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
  });

  it('distingue ids de contrato', () => {
    expect(hashString('C00')).not.toBe(hashString('C01'));
  });
});

describe('hash2', () => {
  it('é determinístico, fica em [0, 1) e varia com a célula e a seed', () => {
    expect(hash2(3, -7, 99)).toBe(hash2(3, -7, 99));
    expect(hash2(3, -7, 99)).not.toBe(hash2(4, -7, 99));
    expect(hash2(3, -7, 99)).not.toBe(hash2(3, -6, 99));
    expect(hash2(3, -7, 99)).not.toBe(hash2(3, -7, 100));
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const h = hash2(i, i * 31 - 500, 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      sum += h;
    }
    expect(Math.abs(sum / 2000 - 0.5)).toBeLessThan(0.05);
  });
});
