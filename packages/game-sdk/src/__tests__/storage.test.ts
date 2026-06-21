import { beforeEach, describe, expect, it } from 'vitest';
import { createStorage } from '../storage';
import { createScoreTracker } from '../score';
import { memoryStorage } from '../test-utils';

describe('createStorage', () => {
  beforeEach(() => localStorage.clear());

  it('namespaces keys and round-trips JSON', () => {
    const a = createStorage('snake');
    const b = createStorage('tetris');
    a.set('best', 10);
    b.set('best', 99);
    expect(a.get('best', 0)).toBe(10);
    expect(b.get('best', 0)).toBe(99);
    expect(localStorage.getItem('jz:snake:best')).toBe('10');
  });

  it('returns the fallback for missing or corrupt values', () => {
    const s = createStorage('x');
    expect(s.get('missing', 'fallback')).toBe('fallback');
    localStorage.setItem('jz:x:bad', '{not json');
    expect(s.get('bad', 42)).toBe(42);
  });

  it('removes values', () => {
    const s = createStorage('y');
    s.set('k', { a: 1 });
    s.remove('k');
    expect(s.get('k', null)).toBeNull();
  });
});

describe('createScoreTracker', () => {
  it('tracks score and commits a new high score once beaten', () => {
    const s = createScoreTracker(memoryStorage());
    expect(s.score).toBe(0);
    expect(s.highScore).toBe(0);
    s.add(30);
    s.add(20);
    expect(s.score).toBe(50);
    expect(s.commitHighScore()).toBe(true);
    expect(s.highScore).toBe(50);
    s.reset();
    s.add(10);
    expect(s.commitHighScore()).toBe(false);
    expect(s.highScore).toBe(50);
  });

  it('persists the high score across instances sharing storage', () => {
    const store = memoryStorage();
    const first = createScoreTracker(store);
    first.add(123);
    first.commitHighScore();
    const second = createScoreTracker(store);
    expect(second.highScore).toBe(123);
  });
});
