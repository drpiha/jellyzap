import { describe, expect, it } from 'vitest';
import { createFootballState, shoot, step, FW, MOUTH_LEFT } from '../logic';

describe('football logic', () => {
  it('starts in play with the ball held and a full clock', () => {
    const s = createFootballState({ time: 60 });
    expect(s.phase).toBe('play');
    expect(s.ball.held).toBe(true);
    expect(s.timeLeft).toBe(60);
    expect(s.score).toBe(0);
  });

  it('shoot launches the held ball up the pitch', () => {
    const s = createFootballState();
    expect(shoot(s)).toBe(true);
    expect(s.ball.held).toBe(false);
    expect(s.ball.vy).toBeLessThan(0);
    expect(shoot(s)).toBe(false); // can't shoot again until the ball resets
  });

  it('an unguarded shot into the goal scores', () => {
    const s = createFootballState({ keeperSpeed: 0 });
    // shoot from a corner the static centre-keeper can't reach
    s.player.x = MOUTH_LEFT + 1;
    s.player.y = 24;
    s.keeper.x = FW / 2;
    shoot(s);
    let ev = 'none';
    for (let i = 0; i < 2000 && ev === 'none'; i++) ev = step(s, 0, 0, 1 / 60);
    expect(ev).toBe('goal');
    expect(s.score).toBe(1);
    expect(s.ball.held).toBe(true); // reset onto the foot
  });

  it('the keeper blocks a shot aimed straight at it', () => {
    const s = createFootballState({ keeperSpeed: 0 });
    s.player.x = FW / 2;
    s.player.y = 24;
    s.keeper.x = FW / 2; // directly in line
    shoot(s);
    let ev = 'none';
    for (let i = 0; i < 2000 && ev === 'none'; i++) ev = step(s, 0, 0, 1 / 60);
    expect(ev).toBe('miss');
    expect(s.score).toBe(0);
  });

  it('a defender on the player causes a tackle and resets the ball', () => {
    const s = createFootballState();
    s.cooldown = 0;
    s.defender.x = s.player.x;
    s.defender.y = s.player.y;
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
