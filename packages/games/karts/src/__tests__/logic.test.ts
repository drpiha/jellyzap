import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  aiInput,
  circleHit,
  createKartsState,
  destroyKart,
  fire,
  normAngle,
  stepProjectiles,
  ARENA,
  FIRE_COOLDOWN,
  KART_RADIUS,
  MAX_HEALTH,
  PROJECTILE_DAMAGE,
  PROJECTILE_RADIUS,
  START_LIVES,
  type Kart,
} from '../logic';

// the logic is pure & deterministic; a seeded rng is available if ever needed.
const seeded = () => mulberry32(123);

function lonePlayer(x: number, y: number, angle: number): Kart {
  return {
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    health: MAX_HEALTH,
    cooldown: 0,
    alive: true,
    respawn: 0,
    team: 0,
  };
}

describe('karts logic', () => {
  it('keeps a seeded rng deterministic (sanity)', () => {
    expect(seeded()()).toBe(mulberry32(123)());
  });

  it('circleHit is true when two circles overlap', () => {
    // centers 4 apart, radii 3 + 3 = 6 → overlap
    expect(circleHit(0, 0, 3, 4, 0, 3)).toBe(true);
    // touching exactly counts as a hit
    expect(circleHit(0, 0, 2, 4, 0, 2)).toBe(true);
  });

  it('circleHit is false when two circles are apart', () => {
    // centers 10 apart, radii 2 + 2 = 4 → no overlap
    expect(circleHit(0, 0, 2, 10, 0, 2)).toBe(false);
    expect(circleHit(0, 0, 1, 0, 5, 1)).toBe(false);
  });

  it('a projectile hitting a kart reduces its health', () => {
    const state = createKartsState(ARENA);
    const bot = state.karts[1];
    bot.x = 50;
    bot.y = 50;
    const before = bot.health;
    // projectile sitting on the bot, owned by the player
    state.projectiles = [
      { x: 50, y: 50, vx: 0, vy: 0, owner: 0, alive: true },
    ];
    stepProjectiles(state, 1 / 60);
    expect(bot.health).toBe(before - PROJECTILE_DAMAGE);
    expect(bot.health).toBeLessThan(before);
    // the projectile is consumed by the hit
    expect(state.projectiles.length).toBe(0);
  });

  it('a projectile dropping a kart to 0 health destroys it', () => {
    const state = createKartsState(ARENA);
    const bot = state.karts[1];
    bot.x = 50;
    bot.y = 50;
    bot.health = PROJECTILE_DAMAGE; // one hit will finish it
    state.projectiles = [{ x: 50, y: 50, vx: 0, vy: 0, owner: 0, alive: true }];
    const res = stepProjectiles(state, 1 / 60);
    expect(bot.health).toBe(0);
    expect(bot.alive).toBe(false);
    expect(res.kills).toBe(1);
    // a player kill awards points
    expect(state.score).toBe(100);
  });

  it('aiInput returns a turn whose sign moves the bot toward the player', () => {
    // bot at center facing +x (angle 0); player is down-right (atan2 = +pi/4).
    // The angle must INCREASE to reach +pi/4, so the turn sign is positive.
    const bot = lonePlayer(50, 50, 0);
    bot.team = 1;
    const playerDownRight = lonePlayer(60, 60, 0);
    const inRight = aiInput(bot, playerDownRight, 1 / 60);
    expect(Math.sign(inRight.turn)).toBe(1);
    // applying that turn reduces the absolute angle-to-target
    const target = Math.atan2(60 - 50, 60 - 50);
    const before = Math.abs(normAngle(target - bot.angle));
    const after = Math.abs(normAngle(target - normAngle(bot.angle + Math.sign(inRight.turn) * 0.1)));
    expect(after).toBeLessThan(before);

    // mirror case: player up-right (atan2 = -pi/4) → angle must DECREASE → negative.
    const playerUpRight = lonePlayer(60, 40, 0);
    const inLeft = aiInput(bot, playerUpRight, 1 / 60);
    expect(Math.sign(inLeft.turn)).toBe(-1);
  });

  it('aiInput fires only when roughly aimed and cooldown is ready', () => {
    const bot = lonePlayer(50, 50, 0);
    bot.team = 1;
    // player straight ahead along +x → perfectly aimed
    const player = lonePlayer(80, 50, 0);
    expect(aiInput(bot, player, 1 / 60).fire).toBe(true);
    // not aimed → no fire
    const playerBehind = lonePlayer(20, 50, 0);
    expect(aiInput(bot, playerBehind, 1 / 60).fire).toBe(false);
    // aimed but cooling down → no fire
    bot.cooldown = FIRE_COOLDOWN;
    expect(aiInput(bot, player, 1 / 60).fire).toBe(false);
  });

  it('fire respects the cooldown (a second immediate fire is rejected)', () => {
    const state = createKartsState(ARENA);
    const player = state.karts[0];
    expect(fire(state, player)).toBe(true);
    expect(state.projectiles.length).toBe(1);
    expect(player.cooldown).toBeGreaterThan(0);
    // immediate second shot is rejected by the cooldown
    expect(fire(state, player)).toBe(false);
    expect(state.projectiles.length).toBe(1);
  });

  it('player losing all health decrements lives; lives 0 → gameOver', () => {
    const state = createKartsState(ARENA);
    expect(state.lives).toBe(START_LIVES);
    const player = state.karts[0];

    // first death: a life is lost and the player respawns (no game over yet)
    destroyKart(state, player, 1);
    expect(state.lives).toBe(START_LIVES - 1);
    expect(state.gameOver).toBe(false);
    expect(player.alive).toBe(true); // respawned

    // burn through remaining lives
    for (let i = state.lives; i > 1; i--) destroyKart(state, state.karts[0], 1);
    expect(state.lives).toBe(1);
    expect(state.gameOver).toBe(false);

    // final death → game over
    destroyKart(state, state.karts[0], 1);
    expect(state.lives).toBe(0);
    expect(state.gameOver).toBe(true);
  });

  it('a projectile destroying the player flags playerDied and decrements lives', () => {
    const state = createKartsState(ARENA);
    const player = state.karts[0];
    player.x = 50;
    player.y = 50;
    player.health = PROJECTILE_DAMAGE;
    // a bot-owned projectile on the player
    state.projectiles = [{ x: 50, y: 50, vx: 0, vy: 0, owner: 1, alive: true }];
    const res = stepProjectiles(state, 1 / 60);
    expect(res.playerDied).toBe(true);
    expect(state.lives).toBe(START_LIVES - 1);
  });

  it('a kart never gets hit by its own projectile (owner is skipped)', () => {
    const state = createKartsState(ARENA);
    const player = state.karts[0];
    player.x = 50;
    player.y = 50;
    const before = player.health;
    state.projectiles = [{ x: 50, y: 50, vx: 0, vy: 0, owner: 0, alive: true }];
    stepProjectiles(state, 1 / 60);
    expect(player.health).toBe(before);
  });

  it('projectiles expire when they leave the arena', () => {
    const state = createKartsState(ARENA);
    state.projectiles = [{ x: ARENA - 0.1, y: 50, vx: 1000, vy: 0, owner: 0, alive: true }];
    stepProjectiles(state, 1 / 60);
    expect(state.projectiles.length).toBe(0);
  });

  it('uses the expected radii constants for collisions', () => {
    // guards the render/logic shared geometry
    expect(KART_RADIUS).toBeGreaterThan(0);
    expect(PROJECTILE_RADIUS).toBeGreaterThan(0);
  });
});
