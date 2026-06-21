/** Pure, deterministic Kart Battle logic — no DOM, no Math.random (rng is injected). */

/** Abstract arena size in logical units (square). */
export const ARENA = 100;

/** Tunables (in arena units / seconds). */
export const KART_RADIUS = 3.2;
export const PROJECTILE_RADIUS = 1.2;
export const ACCEL = 70; // forward acceleration when throttling
export const MAX_SPEED = 42; // velocity cap
export const FRICTION = 1.8; // velocity damping per second (fraction)
export const TURN_RATE = 3.4; // radians per second
export const FIRE_COOLDOWN = 0.7; // seconds between shots
export const PROJECTILE_SPEED = 60;
export const PROJECTILE_LIFE = 1.6; // seconds before a shot fizzles
export const PROJECTILE_DAMAGE = 25;
export const MAX_HEALTH = 100;
export const RESPAWN_DELAY = 2; // seconds before a destroyed bot returns
export const KILL_SCORE = 100;
export const START_LIVES = 3;
export const BOT_COUNT = 3;
/** A bot fires when the target is within this many radians of its nose. */
export const AIM_TOLERANCE = 0.32;

export interface Kart {
  x: number;
  y: number;
  /** facing angle in radians (0 = +x, increasing clockwise in screen space) */
  angle: number;
  vx: number;
  vy: number;
  health: number;
  /** seconds remaining until the kart may fire again */
  cooldown: number;
  alive: boolean;
  /** seconds remaining until a destroyed bot respawns (0 when alive) */
  respawn: number;
  /** team / identity index: 0 = player, 1..n = bots */
  team: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** team index of the kart that fired it */
  owner: number;
  alive: boolean;
}

export interface KartInput {
  /** throttle forward */
  accel: boolean;
  /** turn: -1 = left (counter-clockwise), +1 = right (clockwise), 0 = straight */
  turn: number;
  /** request to fire this frame */
  fire: boolean;
}

export interface KartsState {
  arena: number;
  karts: Kart[];
  projectiles: Projectile[];
  score: number;
  lives: number;
  gameOver: boolean;
}

export const NO_INPUT: KartInput = { accel: false, turn: 0, fire: false };

/** Normalize an angle to (-PI, PI]. */
export function normAngle(a: number): number {
  let x = a;
  while (x <= -Math.PI) x += Math.PI * 2;
  while (x > Math.PI) x -= Math.PI * 2;
  return x;
}

function makeKart(team: number, x: number, y: number, angle: number): Kart {
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
    team,
  };
}

/** Spawn positions spread around the arena (player + bots in the corners/edges). */
function spawnPoint(team: number, arena: number): { x: number; y: number; angle: number } {
  const m = arena * 0.18;
  const layout = [
    { x: m, y: m, angle: Math.PI / 4 }, // player: top-left, facing center
    { x: arena - m, y: m, angle: (Math.PI * 3) / 4 }, // bot: top-right
    { x: m, y: arena - m, angle: -Math.PI / 4 }, // bot: bottom-left
    { x: arena - m, y: arena - m, angle: (-Math.PI * 3) / 4 }, // bot: bottom-right
  ];
  return layout[team % layout.length];
}

export function createKartsState(arena: number = ARENA): KartsState {
  const karts: Kart[] = [];
  for (let i = 0; i < BOT_COUNT + 1; i++) {
    const s = spawnPoint(i, arena);
    karts.push(makeKart(i, s.x, s.y, s.angle));
  }
  return {
    arena,
    karts,
    projectiles: [],
    score: 0,
    lives: START_LIVES,
    gameOver: false,
  };
}

/** Reset a kart back to its spawn pose with full health. */
export function respawnKart(state: KartsState, kart: Kart): void {
  const s = spawnPoint(kart.team, state.arena);
  kart.x = s.x;
  kart.y = s.y;
  kart.angle = s.angle;
  kart.vx = 0;
  kart.vy = 0;
  kart.health = MAX_HEALTH;
  kart.cooldown = 0;
  kart.alive = true;
  kart.respawn = 0;
}

/** Advance a single kart by `dt` seconds given its input. Mutates the kart. */
export function stepKart(kart: Kart, input: KartInput, dt: number, arena: number = ARENA): void {
  if (!kart.alive) return;

  // steering
  if (input.turn !== 0) {
    kart.angle = normAngle(kart.angle + Math.sign(input.turn) * TURN_RATE * dt);
  }

  // throttle along the facing direction
  if (input.accel) {
    kart.vx += Math.cos(kart.angle) * ACCEL * dt;
    kart.vy += Math.sin(kart.angle) * ACCEL * dt;
  }

  // friction (frame-rate independent exponential damping)
  const damp = Math.max(0, 1 - FRICTION * dt);
  kart.vx *= damp;
  kart.vy *= damp;

  // clamp speed
  const speed = Math.hypot(kart.vx, kart.vy);
  if (speed > MAX_SPEED) {
    const k = MAX_SPEED / speed;
    kart.vx *= k;
    kart.vy *= k;
  }

  // integrate position
  kart.x += kart.vx * dt;
  kart.y += kart.vy * dt;

  // bounce off arena walls
  if (kart.x < KART_RADIUS) {
    kart.x = KART_RADIUS;
    kart.vx = Math.abs(kart.vx) * 0.5;
  } else if (kart.x > arena - KART_RADIUS) {
    kart.x = arena - KART_RADIUS;
    kart.vx = -Math.abs(kart.vx) * 0.5;
  }
  if (kart.y < KART_RADIUS) {
    kart.y = KART_RADIUS;
    kart.vy = Math.abs(kart.vy) * 0.5;
  } else if (kart.y > arena - KART_RADIUS) {
    kart.y = arena - KART_RADIUS;
    kart.vy = -Math.abs(kart.vy) * 0.5;
  }

  // tick cooldown down
  if (kart.cooldown > 0) kart.cooldown = Math.max(0, kart.cooldown - dt);
}

/**
 * AI steering for a bot: aim toward the player.
 * Returns a turn direction whose sign reduces the angle to the target, plus
 * `fire` when roughly aimed and the cooldown is ready.
 */
export function aiInput(bot: Kart, player: Kart, _dt: number): KartInput {
  if (!bot.alive || !player.alive) return { ...NO_INPUT };

  const dx = player.x - bot.x;
  const dy = player.y - bot.y;
  const desired = Math.atan2(dy, dx);
  const diff = normAngle(desired - bot.angle);

  // Turn toward the target: sign of `diff` is the direction that reduces it.
  // (deadzone avoids jitter when essentially aligned)
  let turn = 0;
  if (diff > 0.04) turn = 1;
  else if (diff < -0.04) turn = -1;

  const aligned = Math.abs(diff) < AIM_TOLERANCE;
  // Drive forward unless already practically on top of the player.
  const dist = Math.hypot(dx, dy);
  const accel = dist > KART_RADIUS * 2;
  const fire = aligned && bot.cooldown <= 0;

  return { accel, turn, fire };
}

/** Fire a projectile from a kart, respecting its cooldown. Returns true if fired. */
export function fire(state: KartsState, kart: Kart): boolean {
  if (!kart.alive || kart.cooldown > 0) return false;
  kart.cooldown = FIRE_COOLDOWN;
  const nx = Math.cos(kart.angle);
  const ny = Math.sin(kart.angle);
  state.projectiles.push({
    // spawn just ahead of the nose so a kart never shoots itself
    x: kart.x + nx * (KART_RADIUS + PROJECTILE_RADIUS + 0.2),
    y: kart.y + ny * (KART_RADIUS + PROJECTILE_RADIUS + 0.2),
    vx: kart.vx + nx * PROJECTILE_SPEED,
    vy: kart.vy + ny * PROJECTILE_SPEED,
    owner: kart.team,
    alive: true,
  });
  return true;
}

/** Circle-vs-circle overlap test. */
export function circleHit(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

export interface ProjectileStepResult {
  /** a player projectile destroyed a bot (award score / play sound) */
  kills: number;
  /** any kart took damage this step */
  hits: number;
  /** the player kart was destroyed this step */
  playerDied: boolean;
}

/**
 * Advance projectiles, age them out, and resolve projectile→kart hits.
 * Reduces health; at 0 the kart is destroyed. Player kills add KILL_SCORE.
 * Bots are flagged to respawn after RESPAWN_DELAY; player death decrements lives
 * (and sets `gameOver` when lives reach 0). Mutates `state`. Frame-rate independent.
 */
export function stepProjectiles(state: KartsState, dt: number): ProjectileStepResult {
  const result: ProjectileStepResult = { kills: 0, hits: 0, playerDied: false };

  for (const p of state.projectiles) {
    if (!p.alive) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // expire outside the arena
    if (p.x < 0 || p.y < 0 || p.x > state.arena || p.y > state.arena) {
      p.alive = false;
      continue;
    }

    for (const k of state.karts) {
      if (!k.alive || k.team === p.owner) continue;
      if (circleHit(p.x, p.y, PROJECTILE_RADIUS, k.x, k.y, KART_RADIUS)) {
        p.alive = false;
        k.health -= PROJECTILE_DAMAGE;
        result.hits++;
        if (k.health <= 0) {
          k.health = 0;
          destroyKart(state, k, p.owner, result);
        }
        break;
      }
    }
  }

  // tick respawn timers for downed bots
  for (const k of state.karts) {
    if (!k.alive && k.respawn > 0) {
      k.respawn = Math.max(0, k.respawn - dt);
      if (k.respawn === 0) respawnKart(state, k);
    }
  }

  // compact dead projectiles so the array does not grow without bound
  if (state.projectiles.some((p) => !p.alive)) {
    state.projectiles = state.projectiles.filter((p) => p.alive);
  }

  return result;
}

/** Destroy a kart, applying scoring / lives bookkeeping. Exposed for tests. */
export function destroyKart(
  state: KartsState,
  kart: Kart,
  killerTeam: number,
  result?: ProjectileStepResult,
): void {
  kart.alive = false;
  kart.health = 0;
  kart.vx = 0;
  kart.vy = 0;
  if (kart.team === 0) {
    // player died
    state.lives -= 1;
    if (result) result.playerDied = true;
    if (state.lives <= 0) {
      state.lives = 0;
      state.gameOver = true;
    } else {
      // player returns immediately after losing a life
      respawnKart(state, kart);
    }
  } else {
    // bot died → respawn after a delay; player gets points for the kill
    kart.respawn = RESPAWN_DELAY;
    if (killerTeam === 0) {
      state.score += KILL_SCORE;
      if (result) result.kills++;
    }
  }
}

/** Grant an extra life and resume play (used by the rewarded-continue flow). */
export function grantContinue(state: KartsState): void {
  state.lives += 1;
  state.gameOver = false;
  const player = state.karts[0];
  if (player && !player.alive) respawnKart(state, player);
}
