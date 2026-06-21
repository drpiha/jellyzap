import { describe, expect, it } from 'vitest';
import { createParticles, createShaker, ease } from '../juice';

describe('particles', () => {
  it('burst adds particles and clear empties the pool', () => {
    const p = createParticles();
    expect(p.count).toBe(0);
    p.burst(10, 10, { count: 8 });
    expect(p.count).toBe(8);
    p.clear();
    expect(p.count).toBe(0);
  });

  it('caps the pool at max (oldest dropped)', () => {
    const p = createParticles(10);
    p.burst(0, 0, { count: 25 });
    expect(p.count).toBe(10);
  });

  it('update ages particles and removes dead ones', () => {
    const p = createParticles();
    p.burst(0, 0, { count: 6, life: 0.1 });
    expect(p.count).toBe(6);
    p.update(0.02);
    expect(p.count).toBe(6);
    p.update(1); // far past the longest possible lifetime
    expect(p.count).toBe(0);
  });

  it('draw does not throw with a minimal 2D context', () => {
    const p = createParticles();
    p.burst(5, 5, { count: 4 });
    const calls: string[] = [];
    const ctx = {
      globalAlpha: 1,
      fillStyle: '',
      fillRect: () => calls.push('rect'),
    } as unknown as CanvasRenderingContext2D;
    expect(() => p.draw(ctx)).not.toThrow();
    expect(calls.length).toBe(4);
  });
});

describe('shaker', () => {
  it('clamps trauma to [0,1] and decays to zero', () => {
    const s = createShaker();
    s.add(0.5);
    expect(s.trauma).toBeCloseTo(0.5);
    s.add(1);
    expect(s.trauma).toBe(1);
    s.update(10); // long enough to fully decay
    expect(s.trauma).toBe(0);
  });

  it('offset is zero with no trauma and non-zero while shaking', () => {
    const s = createShaker();
    expect(s.offset()).toEqual({ x: 0, y: 0 });
    s.add(1);
    s.update(0.05);
    const o = s.offset();
    expect(Math.abs(o.x) + Math.abs(o.y)).toBeGreaterThan(0);
  });
});

describe('ease', () => {
  it('all easings map 0→0 and 1→1', () => {
    for (const fn of [ease.outCubic, ease.inOutCubic, ease.outBack, ease.outElastic]) {
      expect(fn(0)).toBeCloseTo(0);
      expect(fn(1)).toBeCloseTo(1);
    }
  });

  it('outCubic is monotonic increasing on [0,1]', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = ease.outCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
