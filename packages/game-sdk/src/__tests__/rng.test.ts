import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randInt, shuffle, weightedIndex } from '../rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe('randInt', () => {
  it('stays within inclusive bounds', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 500; i++) {
      const v = randInt(r, 3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('shuffle', () => {
  it('is a permutation of the input', () => {
    const r = mulberry32(42);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(r, input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // input not mutated
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const r = mulberry32(5);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(pick(r, arr));
  });
});

describe('weightedIndex', () => {
  it('approximates the configured weights', () => {
    const r = mulberry32(2024);
    const weights = [1, 3, 6]; // 10%, 30%, 60%
    const counts = [0, 0, 0];
    const N = 20000;
    for (let i = 0; i < N; i++) counts[weightedIndex(r, weights)]++;
    expect(counts[0] / N).toBeCloseTo(0.1, 1);
    expect(counts[1] / N).toBeCloseTo(0.3, 1);
    expect(counts[2] / N).toBeCloseTo(0.6, 1);
  });
});
