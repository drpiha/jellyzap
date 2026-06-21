import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import { createSnakeState, setDirection, step } from '../logic';

const seeded = () => mulberry32(123);

describe('snake logic', () => {
  it('moves the head in the current direction', () => {
    const s = createSnakeState(10, 10, seeded());
    const head = { ...s.snake[0] };
    step(s, seeded());
    expect(s.snake[0]).toEqual({ x: head.x + 1, y: head.y }); // starts moving right
  });

  it('grows and scores when eating, then relocates food off-snake', () => {
    const rng = seeded();
    const s = createSnakeState(10, 10, rng);
    const head = s.snake[0];
    s.food = { x: head.x + 1, y: head.y }; // food directly ahead
    const lenBefore = s.snake.length;
    const result = step(s, rng);
    expect(result).toBe('eat');
    expect(s.score).toBe(1);
    expect(s.snake.length).toBe(lenBefore + 1);
    expect(s.snake.some((seg) => seg.x === s.food.x && seg.y === s.food.y)).toBe(false);
  });

  it('dies on wall collision', () => {
    const s = createSnakeState(6, 6, seeded());
    s.snake = [{ x: 3, y: 0 }];
    s.dir = 'up';
    s.pendingDir = 'up';
    s.grow = 0;
    expect(step(s, seeded())).toBe('dead');
    expect(s.alive).toBe(false);
  });

  it('dies when turning into its own body', () => {
    const s = createSnakeState(12, 12, seeded());
    s.snake = [
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 4, y: 2 },
    ];
    s.dir = 'right';
    s.pendingDir = 'right';
    s.grow = 0;
    s.food = { x: 11, y: 11 };
    setDirection(s, 'down'); // turns into segment (3,3)
    expect(step(s, seeded())).toBe('dead');
    expect(s.alive).toBe(false);
  });

  it('can move into the cell the tail just vacated', () => {
    const s = createSnakeState(12, 12, seeded());
    s.snake = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
    ];
    s.dir = 'up';
    s.pendingDir = 'up';
    s.grow = 0;
    s.food = { x: 11, y: 11 };
    // head (2,2) → (2,1): empty, legal
    expect(step(s, seeded())).toBe('move');
    expect(s.alive).toBe(true);
  });

  it('ignores reversing directly onto the neck', () => {
    const s = createSnakeState(10, 10, seeded());
    s.dir = 'right';
    s.pendingDir = 'right';
    setDirection(s, 'left');
    expect(s.pendingDir).toBe('right');
  });
});
