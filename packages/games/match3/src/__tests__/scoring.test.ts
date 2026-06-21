import { describe, expect, it } from 'vitest';
import { groupMatches, scoreFor, scoreMatches, type Cell } from '../logic';

describe('match3 group scoring', () => {
  const twoRuns: Cell[] = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 0, c: 2 }, // run A (row 0)
    { r: 5, c: 5 },
    { r: 5, c: 6 },
    { r: 5, c: 7 }, // run B (row 5)
  ];

  it('groupMatches splits two disjoint runs into separate groups', () => {
    const groups = groupMatches(twoRuns);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.length === 3)).toBe(true);
  });

  it('two separate 3-runs score 3+3, not an inflated single group of 6', () => {
    // each group is scored on its own size, so it is 2 × scoreFor(3) ...
    expect(scoreMatches(twoRuns, 1)).toBe(2 * scoreFor(3, 1));
    // ... and strictly less than the old bug, which treated all six as one group
    expect(scoreMatches(twoRuns, 1)).toBeLessThan(scoreFor(6, 1));
  });

  it('an L/T-shaped contiguous match counts as one group', () => {
    const lShape: Cell[] = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 },
      { r: 1, c: 0 },
      { r: 2, c: 0 },
    ];
    expect(groupMatches(lShape)).toHaveLength(1);
    expect(scoreMatches(lShape, 2)).toBe(scoreFor(5, 2));
  });

  it('cascade chain multiplies the per-group score', () => {
    const oneRun: Cell[] = [
      { r: 3, c: 3 },
      { r: 3, c: 4 },
      { r: 3, c: 5 },
    ];
    expect(scoreMatches(oneRun, 3)).toBe(scoreFor(3, 3));
    expect(scoreMatches(oneRun, 3)).toBe(3 * scoreMatches(oneRun, 1));
  });
});
