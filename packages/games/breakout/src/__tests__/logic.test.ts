import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  BALL_R,
  createBreakoutState,
  HEIGHT,
  PADDLE_Y,
  setPaddle,
  step,
  WIDTH,
  type BreakoutState,
} from '../logic';

// The injected rng is unused by the current logic, but we honour the contract
// (no Math.random) and seed it for any future use.
const rng = mulberry32(123);
void rng;

/** Build a launched, single-brick-free state for targeted physics tests. */
function launched(): BreakoutState {
  const s = createBreakoutState(1);
  s.bricks = []; // clear the field so brick collisions don't interfere
  s.launched = true;
  return s;
}

describe('breakout logic', () => {
  it('flips vx when the ball hits the left wall', () => {
    const s = launched();
    s.ball = { x: BALL_R + 0.5, y: 50, vx: -50, vy: 0, r: BALL_R };
    step(s, 0.05);
    expect(s.ball.vx).toBeGreaterThan(0);
  });

  it('flips vx when the ball hits the right wall', () => {
    const s = launched();
    s.ball = { x: WIDTH - BALL_R - 0.5, y: 50, vx: 50, vy: 0, r: BALL_R };
    step(s, 0.05);
    expect(s.ball.vx).toBeLessThan(0);
  });

  it('flips vy when the ball hits the ceiling', () => {
    const s = launched();
    s.ball = { x: 50, y: BALL_R + 0.5, vx: 0, vy: -50, r: BALL_R };
    step(s, 0.05);
    expect(s.ball.vy).toBeGreaterThan(0);
  });

  it('sends the ball upward when it hits the paddle, angle depends on offset', () => {
    // hit on the left half of the paddle -> upward and to the left
    const s = launched();
    setPaddle(s, 50);
    s.ball = { x: 50 - s.paddle.w * 0.4, y: PADDLE_Y - BALL_R - 0.1, vx: 0, vy: 40, r: BALL_R };
    step(s, 0.05);
    expect(s.ball.vy).toBeLessThan(0); // upward
    expect(s.ball.vx).toBeLessThan(0); // toward the left

    // a centre hit goes (nearly) straight up
    const c = launched();
    setPaddle(c, 50);
    c.ball = { x: 50, y: PADDLE_Y - BALL_R - 0.1, vx: 0, vy: 40, r: BALL_R };
    step(c, 0.05);
    expect(c.ball.vy).toBeLessThan(0);
    expect(Math.abs(c.ball.vx)).toBeLessThan(1e-6);

    // a right-half hit goes upward and to the right
    const r = launched();
    setPaddle(r, 50);
    r.ball = { x: 50 + r.paddle.w * 0.4, y: PADDLE_Y - BALL_R - 0.1, vx: 0, vy: 40, r: BALL_R };
    step(r, 0.05);
    expect(r.ball.vy).toBeLessThan(0);
    expect(r.ball.vx).toBeGreaterThan(0);
  });

  it('removes the brick, adds score and reflects on a brick collision', () => {
    const s = createBreakoutState(1);
    s.launched = true;
    // isolate a single brick
    const brick = s.bricks[0];
    s.bricks = [brick];
    const points = brick.points;
    // place the ball just below the brick, moving up into it
    s.ball = {
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h + BALL_R - 0.2,
      vx: 0,
      vy: -50,
      r: BALL_R,
    };
    const events = step(s, 0.05);
    expect(brick.alive).toBe(false);
    expect(events.bricksHit).toBe(1);
    expect(s.score).toBe(points);
    expect(s.ball.vy).toBeGreaterThan(0); // reflected downward
  });

  it('decrements lives when the ball falls below the bottom and resets the ball', () => {
    const s = launched();
    s.lives = 3;
    s.ball = { x: 50, y: HEIGHT - 0.1, vx: 0, vy: 60, r: BALL_R };
    const events = step(s, 0.1);
    expect(events.lostLife).toBe(true);
    expect(s.lives).toBe(2);
    expect(s.status).toBe('playing');
    expect(s.launched).toBe(false); // ball reset onto the paddle
  });

  it("sets status 'lost' when the last life is lost", () => {
    const s = launched();
    s.lives = 1;
    s.ball = { x: 50, y: HEIGHT - 0.1, vx: 0, vy: 60, r: BALL_R };
    const events = step(s, 0.1);
    expect(events.lost).toBe(true);
    expect(s.lives).toBe(0);
    expect(s.status).toBe('lost');
  });

  it("sets status 'won' when every brick is cleared", () => {
    const s = createBreakoutState(1);
    s.launched = true;
    const brick = s.bricks[0];
    s.bricks = [brick]; // single brick left
    s.ball = {
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h + BALL_R - 0.2,
      vx: 0,
      vy: -50,
      r: BALL_R,
    };
    const events = step(s, 0.05);
    expect(events.won).toBe(true);
    expect(s.status).toBe('won');
    expect(s.bricks.every((b) => !b.alive)).toBe(true);
  });

  it('does not move the ball before launch', () => {
    const s = createBreakoutState(1);
    const before = { ...s.ball };
    step(s, 0.1);
    expect(s.ball.x).toBe(before.x);
    expect(s.ball.y).toBe(before.y);
  });

  it('is frame-rate independent (one big step ≈ many small steps)', () => {
    const big = launched();
    big.ball = { x: 30, y: 60, vx: 40, vy: -30, r: BALL_R };
    const small = launched();
    small.ball = { x: 30, y: 60, vx: 40, vy: -30, r: BALL_R };

    step(big, 0.2);
    for (let i = 0; i < 20; i++) step(small, 0.01);

    expect(big.ball.x).toBeCloseTo(small.ball.x, 1);
    expect(big.ball.y).toBeCloseTo(small.ball.y, 1);
  });
});
