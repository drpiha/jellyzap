import { describe, expect, it } from 'vitest';
import {
  computeKeeperZones,
  createPenaltyState,
  moveAim,
  nextShot,
  setAim,
  shoot,
} from '../logic';

/** Deterministic rng that replays a fixed queue of values. */
function rngOf(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('penalty logic', () => {
  it('creates a 3×2 grid aiming at the middle, with the given lives', () => {
    const s = createPenaltyState({ lives: 4 });
    expect(s.zones).toBe(6);
    expect(s.lives).toBe(4);
    expect(s.phase).toBe('aim');
    expect(s.aim).toBe(3);
  });

  it('moveAim clamps inside the grid', () => {
    const s = createPenaltyState();
    s.aim = 0; // top-left
    moveAim(s, -1, -1); // can't go past edges
    expect(s.aim).toBe(0);
    moveAim(s, 1, 1); // → col 1, row 1
    expect(s.aim).toBe(s.cols + 1);
  });

  it('setAim only works while aiming', () => {
    const s = createPenaltyState();
    setAim(s, 5);
    expect(s.aim).toBe(5);
    s.phase = 'result';
    setAim(s, 0);
    expect(s.aim).toBe(5); // ignored
  });

  it('a read keeper saves and costs a life', () => {
    const s = createPenaltyState({ lives: 3 });
    s.aim = 2;
    const r = shoot(s, rngOf([0]), { readChance: 1, coverage: 1 }); // always reads
    expect(r).toBe('save');
    expect(s.keeperZones).toEqual([2]);
    expect(s.lives).toBe(2);
    expect(s.score).toBe(0);
    expect(s.phase).toBe('result');
  });

  it('a wrong-diving keeper concedes a goal', () => {
    const s = createPenaltyState({ lives: 3 });
    s.aim = 0;
    // readChance 0 → primary = floor(0.5*6)=3 ≠ aim → goal
    const r = shoot(s, rngOf([0.9, 0.5]), { readChance: 0, coverage: 1 });
    expect(r).toBe('goal');
    expect(s.score).toBe(1);
    expect(s.lives).toBe(3);
  });

  it('coverage 2 covers an extra adjacent zone', () => {
    const s = createPenaltyState();
    s.aim = 0;
    const zones = computeKeeperZones(s, 0, rngOf([0, 0]), { readChance: 1, coverage: 2 });
    expect(zones[0]).toBe(0);
    expect(zones.length).toBe(2);
    expect(zones[1]).not.toBe(0);
  });

  it('running out of lives ends the game', () => {
    const s = createPenaltyState({ lives: 1 });
    s.aim = 1;
    const r = shoot(s, rngOf([0]), { readChance: 1, coverage: 1 });
    expect(r).toBe('save');
    expect(s.lives).toBe(0);
    expect(s.phase).toBe('over');
    nextShot(s); // no-op while over
    expect(s.phase).toBe('over');
  });

  it('nextShot returns to aiming and clears the last result', () => {
    const s = createPenaltyState();
    s.aim = 0;
    shoot(s, rngOf([0.9, 0.5]), { readChance: 0, coverage: 1 }); // goal → result
    expect(s.phase).toBe('result');
    nextShot(s);
    expect(s.phase).toBe('aim');
    expect(s.keeperZones).toEqual([]);
    expect(s.lastResult).toBeNull();
  });
});
