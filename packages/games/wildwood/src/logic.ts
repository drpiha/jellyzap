/**
 * Pure, deterministic "Wildwood Nights" survival logic — no DOM, no Math.random
 * (rng is injected), no requestAnimationFrame. The SDK host owns the loop and
 * passes a fixed `dt`; everything here is replayable from a seed.
 *
 * The loop: by DAY you roam a forest clearing and gather wood (walk next to a
 * tree) and berries (walk next to a bush). Standing in your campfire's glow
 * feeds carried wood into the fire and keeps its light — your safe zone — alive.
 * By NIGHT shadow-wolves emerge from the treeline and hunt you; the fire's light
 * slows and burns them, and you swing to fight back. Manage health, hunger and
 * fuel, and survive as many nights as you can. Reach dawn after night 99 to win.
 *
 * Coordinates are a fixed logical world (WORLD_W × WORLD_H); the renderer scales
 * it to fit the canvas. Movers carry a velocity so the renderer can face/animate
 * them. All tuning lives in {@link WildwoodOptions} so the index can scale it by
 * difficulty while the defaults keep this module independently testable.
 */

export const WORLD_W = 140;
export const WORLD_H = 160;
export const FIRE_X = WORLD_W / 2;
export const FIRE_Y = WORLD_H / 2;

export const PLAYER_R = 4.5;
export const WOLF_R = 4;
export const TREE_R = 5;
export const BUSH_R = 4;

/** distance within which the player auto-gathers a tree / bush */
export const GATHER_RANGE = 9;
/** radius around the fire within which carried wood is auto-fed into it */
export const FIRE_CORE = 12;
/** how long a single attack swing animates (seconds) */
export const SWING_TIME = 0.26;

export type Phase = 'play' | 'over' | 'won';
export type GatherKind = 'none' | 'tree' | 'bush';

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** last meaningful heading in radians (for facing / swing direction) */
  facing: number;
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  /** carried wood (spent by feeding the fire) */
  wood: number;
  /** carried berries (auto-eaten when hungry) */
  food: number;
  /** swing animation timer; > 0 means mid-swing */
  swing: number;
  /** seconds until the next attack is allowed */
  attackCd: number;
  /** seconds until the next auto-eat is allowed */
  eatCd: number;
  /** progress toward the next harvest from the nearest tree (seconds) */
  chopProgress: number;
  /** progress toward the next berry from the nearest bush (seconds) */
  pickProgress: number;
  /** what the player is currently gathering (for renderer feedback) */
  gathering: GatherKind;
  /** brief red flash after taking damage (cosmetic timer) */
  hurt: number;
}

export interface Tree {
  x: number;
  y: number;
  /** remaining harvests; 0 = stump (regrowing) */
  wood: number;
  maxWood: number;
  /** seconds until a depleted tree regrows */
  regrow: number;
  /** cosmetic shake timer when chopped */
  shake: number;
}

export interface Bush {
  x: number;
  y: number;
  berries: number;
  maxBerries: number;
  regrow: number;
  shake: number;
}

export interface Wolf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  health: number;
  maxHealth: number;
  /** seconds until this wolf can bite again */
  biteCd: number;
  /** cosmetic hit flash */
  hurt: number;
  /** true once dawn breaks: the wolf flees to the treeline, then despawns */
  fleeing: boolean;
}

export interface Fire {
  fuel: number;
  maxFuel: number;
}

/** Notable things that happened during a {@link step}, for SFX / juice. */
export type WildwoodEvent =
  | 'chop'
  | 'pick'
  | 'feed'
  | 'eat'
  | 'swing'
  | 'hit'
  | 'wolfdie'
  | 'bite'
  | 'nightfall'
  | 'dawn'
  | 'firelow'
  | 'fireout'
  | 'gameover'
  | 'won';

export interface WildwoodState {
  phase: Phase;
  player: Player;
  fire: Fire;
  trees: Tree[];
  bushes: Bush[];
  wolves: Wolf[];
  /** current night number (the night you are working toward / fighting through) */
  night: number;
  /** nights fully survived so far — this is the score */
  survived: number;
  isNight: boolean;
  /** seconds elapsed in the current day or night phase */
  cycleTime: number;
  /** wolves still to spawn this night */
  toSpawn: number;
  /** seconds until the next wolf spawns */
  spawnTimer: number;
  /** internal accumulator for fractional wood→fuel feeding */
  feedAccum: number;
  /** true once a "fire is low" warning has fired for the current burn-down */
  warnedLow: boolean;
  events: WildwoodEvent[];
  opts: Required<WildwoodOptions>;
}

export interface WildwoodOptions {
  maxHealth?: number;
  maxHunger?: number;
  maxFuel?: number;
  startFuel?: number;
  startWood?: number;
  startFood?: number;
  playerSpeed?: number;
  hungerDrain?: number;
  starveDamage?: number;
  chillDamage?: number;
  fireBurnDay?: number;
  fireBurnNight?: number;
  /** fuel gained per wood fed into the fire */
  woodToFuel?: number;
  /** wood fed into the fire per second while standing in its core */
  feedRate?: number;
  /** seconds of contact to harvest one wood from a tree */
  chopInterval?: number;
  /** seconds of contact to harvest one berry from a bush */
  pickInterval?: number;
  treeRegrow?: number;
  bushRegrow?: number;
  attackRange?: number;
  attackDamage?: number;
  attackCd?: number;
  eatThreshold?: number;
  eatRestore?: number;
  eatCooldown?: number;
  dayLength?: number;
  nightLength?: number;
  /** wolves spawned on night 1 */
  baseWolves?: number;
  /** extra wolves per subsequent night */
  wolvesPerNight?: number;
  maxWolves?: number;
  wolfSpeed?: number;
  wolfHealth?: number;
  wolfDamage?: number;
  wolfBiteCd?: number;
  /** burn damage per second to wolves inside the fire light */
  fireRepel?: number;
  treeCount?: number;
  bushCount?: number;
  /** the night which, once survived, wins the game */
  winNight?: number;
}

const DEFAULTS: Required<WildwoodOptions> = {
  maxHealth: 100,
  maxHunger: 100,
  maxFuel: 100,
  startFuel: 55,
  startWood: 3,
  startFood: 2,
  playerSpeed: 50,
  hungerDrain: 1.5,
  starveDamage: 4,
  chillDamage: 3,
  fireBurnDay: 1.1,
  fireBurnNight: 2.1,
  woodToFuel: 9,
  feedRate: 3,
  chopInterval: 0.7,
  pickInterval: 0.6,
  treeRegrow: 26,
  bushRegrow: 20,
  attackRange: 15,
  attackDamage: 12,
  attackCd: 0.36,
  eatThreshold: 35,
  eatRestore: 45,
  eatCooldown: 0.5,
  dayLength: 22,
  nightLength: 18,
  baseWolves: 2,
  wolvesPerNight: 1,
  maxWolves: 14,
  wolfSpeed: 22,
  wolfHealth: 20,
  wolfDamage: 8,
  wolfBiteCd: 1,
  fireRepel: 16,
  treeCount: 10,
  bushCount: 6,
  winNight: 99,
};

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * The fire's light radius — the safe zone. Scales with fuel; zero when the fire
 * is out. The renderer and the chill/repel logic both read this.
 */
export function fireLightRadius(state: WildwoodState): number {
  if (state.fire.fuel <= 0) return 0;
  return 16 + (state.fire.fuel / state.fire.maxFuel) * 40;
}

/** Place trees/bushes in a ring around the fire, away from the central clearing. */
function scatter(
  rng: () => number,
  count: number,
  minR: number,
  maxR: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const margin = 8;
  for (let i = 0; i < count; i++) {
    // golden-angle-ish spread by index, jittered by rng, so items never clump
    const baseAngle = (i / Math.max(1, count)) * Math.PI * 2;
    const angle = baseAngle + (rng() - 0.5) * 1.4;
    const r = minR + rng() * (maxR - minR);
    const x = clamp(FIRE_X + Math.cos(angle) * r, margin, WORLD_W - margin);
    const y = clamp(FIRE_Y + Math.sin(angle) * r, margin, WORLD_H - margin);
    out.push({ x, y });
  }
  return out;
}

export function createWildwoodState(
  opts: WildwoodOptions = {},
  rng: () => number = () => 0.5,
): WildwoodState {
  const o: Required<WildwoodOptions> = { ...DEFAULTS, ...opts };

  const treePts = scatter(rng, o.treeCount, 24, Math.min(WORLD_W, WORLD_H) / 2 - 6);
  const bushPts = scatter(rng, o.bushCount, 20, Math.min(WORLD_W, WORLD_H) / 2 - 10);

  const trees: Tree[] = treePts.map((p) => ({
    x: p.x,
    y: p.y,
    wood: 4,
    maxWood: 4,
    regrow: 0,
    shake: 0,
  }));
  const bushes: Bush[] = bushPts.map((p) => ({
    x: p.x,
    y: p.y,
    berries: 3,
    maxBerries: 3,
    regrow: 0,
    shake: 0,
  }));

  return {
    phase: 'play',
    player: {
      x: FIRE_X,
      y: FIRE_Y + 16,
      vx: 0,
      vy: 0,
      facing: -Math.PI / 2,
      health: o.maxHealth,
      maxHealth: o.maxHealth,
      hunger: o.maxHunger,
      maxHunger: o.maxHunger,
      wood: o.startWood,
      food: o.startFood,
      swing: 0,
      attackCd: 0,
      eatCd: 0,
      chopProgress: 0,
      pickProgress: 0,
      gathering: 'none',
      hurt: 0,
    },
    fire: { fuel: o.startFuel, maxFuel: o.maxFuel },
    trees,
    bushes,
    wolves: [],
    night: 1,
    survived: 0,
    isNight: false,
    cycleTime: 0,
    toSpawn: 0,
    spawnTimer: 0,
    feedAccum: 0,
    warnedLow: false,
    events: [],
    opts: o,
  };
}

export interface StepInput {
  /** desired movement direction (need not be normalized) */
  moveX: number;
  moveY: number;
  /** true while an attack is requested (rate-limited by attackCd) */
  attack: boolean;
}

/** Spawn one wolf at a random point on the world perimeter, walking inward. */
function spawnWolf(state: WildwoodState, rng: () => number): void {
  const o = state.opts;
  const side = Math.floor(rng() * 4);
  let x: number;
  let y: number;
  if (side === 0) {
    x = rng() * WORLD_W;
    y = 2;
  } else if (side === 1) {
    x = WORLD_W - 2;
    y = rng() * WORLD_H;
  } else if (side === 2) {
    x = rng() * WORLD_W;
    y = WORLD_H - 2;
  } else {
    x = 2;
    y = rng() * WORLD_H;
  }
  // scale a touch with the night so late nights bite harder
  const tier = 1 + (state.night - 1) * 0.04;
  state.wolves.push({
    x,
    y,
    vx: 0,
    vy: 0,
    facing: Math.atan2(FIRE_Y - y, FIRE_X - x),
    health: o.wolfHealth * tier,
    maxHealth: o.wolfHealth * tier,
    biteCd: 0,
    hurt: 0,
    fleeing: false,
  });
}

function startNight(state: WildwoodState): void {
  const o = state.opts;
  state.isNight = true;
  state.cycleTime = 0;
  state.warnedLow = false;
  const count = Math.min(o.maxWolves, o.baseWolves + (state.night - 1) * o.wolvesPerNight);
  state.toSpawn = count;
  // stagger spawns across roughly the first 70% of the night
  state.spawnTimer = 0.5;
  state.events.push('nightfall');
}

function startDay(state: WildwoodState): void {
  state.isNight = false;
  state.cycleTime = 0;
  state.survived = state.night; // you lived through `night`
  // any remaining wolves flee at first light
  for (const w of state.wolves) w.fleeing = true;
  state.toSpawn = 0;
  if (state.survived >= state.opts.winNight) {
    state.phase = 'won';
    state.events.push('won');
    return;
  }
  state.night += 1;
  state.events.push('dawn');
}

function updateCycle(state: WildwoodState, dt: number): void {
  const o = state.opts;
  state.cycleTime += dt;
  if (!state.isNight) {
    if (state.cycleTime >= o.dayLength) startNight(state);
  } else {
    if (state.cycleTime >= o.nightLength) startDay(state);
  }
}

function updateGather(state: WildwoodState, dt: number): void {
  const o = state.opts;
  const p = state.player;
  p.gathering = 'none';

  // nearest harvestable tree in range
  let tree: Tree | null = null;
  let td = Infinity;
  for (const t of state.trees) {
    if (t.wood <= 0) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d < GATHER_RANGE + TREE_R && d < td) {
      td = d;
      tree = t;
    }
  }
  if (tree) {
    p.gathering = 'tree';
    p.chopProgress += dt;
    if (p.chopProgress >= o.chopInterval) {
      p.chopProgress = 0;
      tree.wood -= 1;
      tree.shake = 0.25;
      p.wood += 1;
      if (tree.wood <= 0) tree.regrow = o.treeRegrow;
      state.events.push('chop');
    }
  } else {
    p.chopProgress = 0;
  }

  // nearest pickable bush in range (independent progress)
  let bush: Bush | null = null;
  let bd = Infinity;
  for (const b of state.bushes) {
    if (b.berries <= 0) continue;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < GATHER_RANGE + BUSH_R && d < bd) {
      bd = d;
      bush = b;
    }
  }
  if (bush) {
    if (p.gathering === 'none') p.gathering = 'bush';
    p.pickProgress += dt;
    if (p.pickProgress >= o.pickInterval) {
      p.pickProgress = 0;
      bush.berries -= 1;
      bush.shake = 0.25;
      p.food += 1;
      if (bush.berries <= 0) bush.regrow = o.bushRegrow;
      state.events.push('pick');
    }
  } else {
    p.pickProgress = 0;
  }

  // regrow depleted resources
  for (const t of state.trees) {
    if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);
    if (t.wood <= 0) {
      t.regrow -= dt;
      if (t.regrow <= 0) t.wood = t.maxWood;
    }
  }
  for (const b of state.bushes) {
    if (b.shake > 0) b.shake = Math.max(0, b.shake - dt);
    if (b.berries <= 0) {
      b.regrow -= dt;
      if (b.regrow <= 0) b.berries = b.maxBerries;
    }
  }
}

function updateFire(state: WildwoodState, dt: number): void {
  const o = state.opts;
  const p = state.player;
  const f = state.fire;

  // feed carried wood into the fire while standing in its core
  if (p.wood > 0 && f.fuel < f.maxFuel && dist(p.x, p.y, FIRE_X, FIRE_Y) <= FIRE_CORE) {
    state.feedAccum += o.feedRate * dt;
    while (state.feedAccum >= 1 && p.wood > 0 && f.fuel < f.maxFuel) {
      state.feedAccum -= 1;
      p.wood -= 1;
      f.fuel = Math.min(f.maxFuel, f.fuel + o.woodToFuel);
      state.events.push('feed');
    }
  } else {
    state.feedAccum = 0;
  }

  const burn = state.isNight ? o.fireBurnNight : o.fireBurnDay;
  const before = f.fuel;
  f.fuel = Math.max(0, f.fuel - burn * dt);
  // one-shot warnings as the fire crosses thresholds downward
  if (before > 20 && f.fuel <= 20 && f.fuel > 0 && !state.warnedLow) {
    state.warnedLow = true;
    state.events.push('firelow');
  }
  if (before > 0 && f.fuel <= 0) state.events.push('fireout');
}

function updateNeeds(state: WildwoodState, dt: number): void {
  const o = state.opts;
  const p = state.player;

  // hunger always ticks down; auto-eat a berry when low
  p.hunger = Math.max(0, p.hunger - o.hungerDrain * dt);
  if (p.eatCd > 0) p.eatCd = Math.max(0, p.eatCd - dt);
  if (p.hunger <= o.eatThreshold && p.food > 0 && p.eatCd <= 0) {
    p.food -= 1;
    p.hunger = Math.min(p.maxHunger, p.hunger + o.eatRestore);
    p.eatCd = o.eatCooldown;
    state.events.push('eat');
  }

  // damage sources
  let dmg = 0;
  if (p.hunger <= 0) dmg += o.starveDamage; // starving
  if (state.isNight && dist(p.x, p.y, FIRE_X, FIRE_Y) > fireLightRadius(state)) {
    dmg += o.chillDamage; // out in the cold dark
  }
  if (dmg > 0) p.health = Math.max(0, p.health - dmg * dt);

  if (p.hurt > 0) p.hurt = Math.max(0, p.hurt - dt);
  if (p.swing > 0) p.swing = Math.max(0, p.swing - dt);
  if (p.attackCd > 0) p.attackCd = Math.max(0, p.attackCd - dt);
}

function updateWolves(state: WildwoodState, dt: number, rng: () => number): void {
  const o = state.opts;
  const p = state.player;
  const light = fireLightRadius(state);

  // spawn over the course of the night
  if (state.isNight && state.toSpawn > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnWolf(state, rng);
      state.toSpawn -= 1;
      // remaining spawns spread across most of the night
      const spread = (o.nightLength * 0.7) / Math.max(1, o.baseWolves + state.night);
      state.spawnTimer = clamp(spread, 0.6, 3);
    }
  }

  const survivors: Wolf[] = [];
  for (const w of state.wolves) {
    if (w.hurt > 0) w.hurt = Math.max(0, w.hurt - dt);
    if (w.biteCd > 0) w.biteCd = Math.max(0, w.biteCd - dt);

    let tx: number;
    let ty: number;
    if (w.fleeing) {
      // run to the nearest edge, then despawn once there
      const left = w.x;
      const right = WORLD_W - w.x;
      const top = w.y;
      const bottom = WORLD_H - w.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) {
        tx = -10;
        ty = w.y;
      } else if (m === right) {
        tx = WORLD_W + 10;
        ty = w.y;
      } else if (m === top) {
        tx = w.x;
        ty = -10;
      } else {
        tx = w.x;
        ty = WORLD_H + 10;
      }
    } else {
      tx = p.x;
      ty = p.y;
    }

    let dx = tx - w.x;
    let dy = ty - w.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;

    // the fire slows and burns wolves caught in its light
    const inLight = dist(w.x, w.y, FIRE_X, FIRE_Y) <= light;
    let speed = o.wolfSpeed * (1 + (state.night - 1) * 0.02);
    if (w.fleeing) speed *= 1.8;
    else if (inLight) speed *= 0.55;

    w.vx = dx * speed;
    w.vy = dy * speed;
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    w.facing = Math.atan2(w.vy, w.vx);

    if (inLight && !w.fleeing) {
      w.health -= o.fireRepel * dt;
      w.hurt = Math.max(w.hurt, 0.08);
    }

    // bite the player on contact
    if (!w.fleeing && w.biteCd <= 0) {
      if (dist(w.x, w.y, p.x, p.y) <= WOLF_R + PLAYER_R + 1) {
        p.health = Math.max(0, p.health - o.wolfDamage);
        p.hurt = 0.3;
        w.biteCd = o.wolfBiteCd;
        state.events.push('bite');
      }
    }

    const goneOffEdge =
      w.fleeing && (w.x < -6 || w.x > WORLD_W + 6 || w.y < -6 || w.y > WORLD_H + 6);
    if (w.health > 0 && !goneOffEdge) survivors.push(w);
    else if (w.health <= 0) state.events.push('wolfdie');
  }
  state.wolves = survivors;
}

function doAttack(state: WildwoodState): void {
  const o = state.opts;
  const p = state.player;
  if (p.attackCd > 0) return;
  p.attackCd = o.attackCd;
  p.swing = SWING_TIME;
  state.events.push('swing');
  for (const w of state.wolves) {
    if (w.fleeing) continue;
    if (dist(p.x, p.y, w.x, w.y) <= o.attackRange + WOLF_R) {
      w.health -= o.attackDamage;
      w.hurt = 0.18;
      // knock the wolf back a little so the hit reads
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      w.x = clamp(w.x + (dx / d) * 3, 2, WORLD_W - 2);
      w.y = clamp(w.y + (dy / d) * 3, 2, WORLD_H - 2);
      state.events.push('hit');
    }
  }
}

/**
 * Advance the world by `dt` seconds. `input` carries the player's intended
 * movement and whether they're attacking; `rng` drives wolf spawns. Returns
 * nothing — read {@link WildwoodState.events} (cleared at the top of each call)
 * for SFX / juice triggers.
 */
export function step(
  state: WildwoodState,
  input: StepInput,
  dt: number,
  rng: () => number,
): void {
  state.events.length = 0;
  if (state.phase !== 'play') return;

  const p = state.player;
  const o = state.opts;

  // movement
  const len = Math.hypot(input.moveX, input.moveY);
  if (len > 0.01) {
    const nx = input.moveX / len;
    const ny = input.moveY / len;
    p.vx = nx * o.playerSpeed;
    p.vy = ny * o.playerSpeed;
    p.facing = Math.atan2(ny, nx);
  } else {
    p.vx = 0;
    p.vy = 0;
  }
  p.x = clamp(p.x + p.vx * dt, PLAYER_R, WORLD_W - PLAYER_R);
  p.y = clamp(p.y + p.vy * dt, PLAYER_R, WORLD_H - PLAYER_R);

  if (input.attack) doAttack(state);

  updateGather(state, dt);
  updateFire(state, dt);
  updateNeeds(state, dt);
  updateWolves(state, dt, rng);
  updateCycle(state, dt);

  if (p.health <= 0 && state.phase === 'play') {
    p.health = 0;
    state.phase = 'over';
    state.events.push('gameover');
  }
}
