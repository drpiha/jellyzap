import { describe, expect, it } from 'vitest';
import {
  CELEBRATE_TIME,
  createFootballState,
  mouthLeft,
  shoot,
  step,
  FW,
} from '../logic';

describe('football logic', () => {
  it('starts in play with the ball held, a defender, and a full clock', () => {
    const s = createFootballState({ time: 60, defenderCount: 1 });
    expect(s.phase).toBe('play');
    expect(s.ball.held).toBe(true);
    expect(s.defenders).toHaveLength(1);
    expect(s.timeLeft).toBe(60);
    expect(s.score).toBe(0);
  });

  it('scales the defender count from options', () => {
    expect(createFootballState({ defenderCount: 3 }).defenders).toHaveLength(3);
  });

  it('shoot launches the held ball up the pitch toward the aim point', () => {
    const s = createFootballState();
    expect(shoot(s, FW / 2, 0)).toBe(true);
    expect(s.ball.held).toBe(false);
    expect(s.ball.vy).toBeLessThan(0);
    expect(shoot(s, FW / 2, 0)).toBe(false); // can't shoot again until reset
  });

  it('an unguarded aimed shot scores and triggers a celebration', () => {
    const s = createFootballState({ keeperSpeed: 0, defenderCount: 0 });
    const corner = mouthLeft(s) + 2;
    s.player.x = corner;
    s.player.y = 26;
    s.keeper.x = FW / 2; // far from the corner
    shoot(s, corner, 0);
    let ev = 'none';
    for (let i = 0; i < 3000 && ev === 'none'; i++) ev = step(s, 0, 0, 1 / 60);
    expect(ev).toBe('goal');
    expect(s.score).toBe(1);
    expect(s.phase).toBe('celebrate');
    // play resumes after the celebration
    let t = 0;
    while (t < CELEBRATE_TIME + 0.1) {
      step(s, 0, 0, 1 / 60);
      t += 1 / 60;
    }
    expect(s.phase).toBe('play');
    expect(s.ball.held).toBe(true);
  });

  it('the keeper blocks a shot aimed straight at it', () => {
    const s = createFootballState({ keeperSpeed: 0, defenderCount: 0 });
    const corner = mouthLeft(s) + 2;
    s.player.x = corner;
    s.player.y = 26;
    s.keeper.x = corner; // sitting on the shot line
    shoot(s, corner, 0);
    let ev = 'none';
    for (let i = 0; i < 3000 && ev === 'none'; i++) ev = step(s, 0, 0, 1 / 60);
    expect(ev).toBe('miss');
    expect(s.score).toBe(0);
  });

  it('a defender on the player causes a tackle and resets the ball', () => {
    const s = createFootballState({ defenderCount: 1 });
    s.cooldown = 0;
    s.defenders[0].x = s.player.x;
    s.defenders[0].y = s.player.y;
    const ev = step(s, 0, 0, 1 / 60);
    expect(ev).toBe('tackle');
    expect(s.ball.held).toBe(true);
    expect(s.player.y).toBeGreaterThan(100); // back at the start
  });

  it('ends when the clock runs out', () => {
    const s = createFootballState({ time: 0.01 });
    step(s, 0, 0, 0.5);
    expect(s.phase).toBe('over');
  });
});
