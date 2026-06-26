import { describe, expect, it } from 'vitest';
import {
  FIRE_CORE,
  FIRE_X,
  FIRE_Y,
  WORLD_H,
  WORLD_W,
  createWildwoodState,
  fireLightRadius,
  step,
  type StepInput,
  type WildwoodState,
} from '../logic';

/** Small seedable PRNG so two runs from the same seed are bit-identical. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IDLE: StepInput = { moveX: 0, moveY: 0, attack: false };
function frames(s: WildwoodState, n: number, dt: number, input: StepInput, rng: () => number) {
  for (let i = 0; i < n; i++) step(s, input, dt, rng);
}

describe('wildwood: creation', () => {
  it('starts on day 1 with full needs and the configured world', () => {
    const s = createWildwoodState({ treeCount: 8, bushCount: 5, startFuel: 40 }, mulberry32(1));
    expect(s.phase).toBe('play');
    expect(s.night).toBe(1);
    expect(s.survived).toBe(0);
    expect(s.isNight).toBe(false);
    expect(s.trees).toHaveLength(8);
    expect(s.bushes).toHaveLength(5);
    expect(s.fire.fuel).toBe(40);
    expect(s.player.health).toBe(s.player.maxHealth);
    expect(s.player.hunger).toBe(s.player.maxHunger);
    expect(s.wolves).toHaveLength(0);
  });

  it('places every tree and bush inside the world bounds', () => {
    const s = createWildwoodState({ treeCount: 12, bushCount: 8 }, mulberry32(99));
    for (const t of [...s.trees, ...s.bushes]) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(WORLD_W);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThanOrEqual(WORLD_H);
    }
  });
});

describe('wildwood: determinism', () => {
  it('same seed + same inputs → identical state', () => {
    const a = createWildwoodState({}, mulberry32(1234));
    const b = createWildwoodState({}, mulberry32(1234));
    const ra = mulberry32(1234);
    const rb = mulberry32(1234);
    const input: StepInput = { moveX: 1, moveY: -0.3, attack: true };
    frames(a, 600, 1 / 60, input, ra);
    frames(b, 600, 1 / 60, input, rb);
    expect(a).toEqual(b);
  });
});

describe('wildwood: gathering', () => {
  it('chops wood from a nearby tree', () => {
    const s = createWildwoodState({}, mulberry32(2));
    s.player.x = FIRE_X;
    s.player.y = FIRE_Y - 30;
    s.trees = [{ x: s.player.x + 8, y: s.player.y, wood: 4, maxWood: 4, regrow: 0, shake: 0 }];
    s.bushes = [];
    const wood0 = s.player.wood;
    step(s, IDLE, 0.7, mulberry32(0));
    expect(s.player.wood).toBe(wood0 + 1);
    expect(s.trees[0].wood).toBe(3);
    expect(s.events).toContain('chop');
  });

  it('a depleted tree becomes a stump then regrows', () => {
    const s = createWildwoodState({ treeRegrow: 1 }, mulberry32(3));
    s.player.x = FIRE_X;
    s.player.y = FIRE_Y - 30;
    s.trees = [{ x: s.player.x + 8, y: s.player.y, wood: 1, maxWood: 4, regrow: 0, shake: 0 }];
    s.bushes = [];
    step(s, IDLE, 0.7, mulberry32(0));
    expect(s.trees[0].wood).toBe(0);
    expect(s.trees[0].regrow).toBeGreaterThan(0);
    // wait out the regrow (away from the tree so we don't immediately re-harvest)
    s.player.y = FIRE_Y + 40;
    frames(s, 30, 0.05, IDLE, mulberry32(0));
    expect(s.trees[0].wood).toBe(4);
  });

  it('picks berries from a nearby bush', () => {
    const s = createWildwoodState({}, mulberry32(4));
    s.player.x = FIRE_X - 30;
    s.player.y = FIRE_Y;
    s.trees = [];
    s.bushes = [{ x: s.player.x + 7, y: s.player.y, berries: 3, maxBerries: 3, regrow: 0, shake: 0 }];
    const food0 = s.player.food;
    step(s, IDLE, 0.6, mulberry32(0));
    expect(s.player.food).toBe(food0 + 1);
    expect(s.bushes[0].berries).toBe(2);
    expect(s.events).toContain('pick');
  });
});

describe('wildwood: fire', () => {
  it('feeds carried wood into the fire when standing in its core', () => {
    const s = createWildwoodState({ startWood: 3, startFuel: 10 }, mulberry32(5));
    s.player.x = FIRE_X;
    s.player.y = FIRE_Y;
    s.trees = [];
    s.bushes = [];
    expect(Math.hypot(s.player.x - FIRE_X, s.player.y - FIRE_Y)).toBeLessThanOrEqual(FIRE_CORE);
    step(s, IDLE, 0.4, mulberry32(0));
    expect(s.player.wood).toBe(2);
    expect(s.fire.fuel).toBeGreaterThan(10);
    expect(s.events).toContain('feed');
  });

  it('the fire burns faster at night than by day', () => {
    const day = createWildwoodState({ startWood: 0 }, mulberry32(6));
    day.player.x = 5;
    day.player.y = 5; // far from fire so no feeding
    const night = createWildwoodState({ startWood: 0 }, mulberry32(6));
    night.player.x = 5;
    night.player.y = 5;
    night.isNight = true;
    const f0 = day.fire.fuel;
    step(day, IDLE, 1, mulberry32(0));
    step(night, IDLE, 1, mulberry32(0));
    const dayBurn = f0 - day.fire.fuel;
    const nightBurn = f0 - night.fire.fuel;
    expect(nightBurn).toBeGreaterThan(dayBurn);
  });

  it('light radius scales with fuel and is zero when out', () => {
    const s = createWildwoodState({ startFuel: 100 }, mulberry32(7));
    const full = fireLightRadius(s);
    s.fire.fuel = 50;
    const half = fireLightRadius(s);
    s.fire.fuel = 0;
    expect(full).toBeGreaterThan(half);
    expect(fireLightRadius(s)).toBe(0);
  });
});

describe('wildwood: fire warnings', () => {
  it('warns when the fire is already low as night begins', () => {
    const s = createWildwoodState({}, mulberry32(41));
    s.trees = [];
    s.bushes = [];
    s.isNight = true;
    s.fire.fuel = 19; // already in the danger band before any crossing
    s.player.x = 6;
    s.player.y = 6; // away from the fire so it isn't fed
    step(s, IDLE, 0.1, mulberry32(0));
    expect(s.events).toContain('firelow');
  });

  it('re-arms after the fire recovers, so it warns again on a later dip', () => {
    const s = createWildwoodState({ fireBurnNight: 5 }, mulberry32(40));
    s.trees = [];
    s.bushes = [];
    s.isNight = true;
    s.player.x = 6;
    s.player.y = 6;
    let warnings = 0;
    s.fire.fuel = 22;
    step(s, IDLE, 1, mulberry32(0)); // 22 -> 17: first warning
    if (s.events.includes('firelow')) warnings++;
    s.fire.fuel = 40; // player ran wood back and fed the fire
    step(s, IDLE, 0.1, mulberry32(0)); // recovers above 25 -> re-arm
    s.fire.fuel = 22;
    step(s, IDLE, 1, mulberry32(0)); // 22 -> 17: second warning
    if (s.events.includes('firelow')) warnings++;
    expect(warnings).toBe(2);
  });

  it('does not warn about a low fire during the day', () => {
    const s = createWildwoodState({}, mulberry32(42));
    s.trees = [];
    s.bushes = [];
    s.isNight = false;
    s.fire.fuel = 15;
    s.player.x = 6;
    s.player.y = 6;
    step(s, IDLE, 0.5, mulberry32(0));
    expect(s.events).not.toContain('firelow');
  });
});

describe('wildwood: needs', () => {
  it('auto-eats a berry when hunger drops below the threshold', () => {
    const s = createWildwoodState({ startFood: 2, eatThreshold: 35, eatRestore: 40 }, mulberry32(8));
    s.player.hunger = 10;
    step(s, IDLE, 0.1, mulberry32(0));
    expect(s.player.food).toBe(1);
    expect(s.player.hunger).toBeGreaterThan(10);
    expect(s.events).toContain('eat');
  });

  it('starving (no hunger, no food) drains health', () => {
    const s = createWildwoodState({ startFood: 0 }, mulberry32(9));
    s.trees = []; // isolate: no berry to grab-and-eat back to safety
    s.bushes = [];
    s.player.hunger = 0;
    const h0 = s.player.health;
    step(s, IDLE, 1, mulberry32(0));
    expect(s.player.health).toBeLessThan(h0);
  });

  it('night chill hurts you outside the fire light, but not within it', () => {
    const cold = createWildwoodState({}, mulberry32(10));
    cold.isNight = true;
    cold.player.x = 8;
    cold.player.y = 8; // far corner, outside the light
    const h0 = cold.player.health;
    step(cold, IDLE, 1, mulberry32(0));
    expect(cold.player.health).toBeLessThan(h0);

    const warm = createWildwoodState({}, mulberry32(10));
    warm.isNight = true;
    warm.player.x = FIRE_X;
    warm.player.y = FIRE_Y; // in the glow
    const w0 = warm.player.health;
    step(warm, IDLE, 1, mulberry32(0));
    expect(warm.player.health).toBe(w0);
  });
});

describe('wildwood: wolves & combat', () => {
  it('a wolf bites the player on contact at night', () => {
    const s = createWildwoodState({ wolfDamage: 9 }, mulberry32(11));
    s.isNight = true;
    s.wolves = [
      {
        x: FIRE_X + 5,
        y: FIRE_Y,
        vx: 0,
        vy: 0,
        facing: 0,
        health: 20,
        maxHealth: 20,
        biteCd: 0,
        hurt: 0,
        fleeing: false,
      },
    ];
    s.player.x = FIRE_X;
    s.player.y = FIRE_Y;
    const h0 = s.player.health;
    step(s, IDLE, 0.1, mulberry32(0));
    expect(s.player.health).toBeLessThan(h0);
    expect(s.events).toContain('bite');
  });

  it('an attack swing kills a weak wolf', () => {
    const s = createWildwoodState({ attackDamage: 12 }, mulberry32(12));
    s.wolves = [
      {
        x: FIRE_X + 6,
        y: FIRE_Y,
        vx: 0,
        vy: 0,
        facing: 0,
        health: 10,
        maxHealth: 20,
        biteCd: 5,
        hurt: 0,
        fleeing: false,
      },
    ];
    s.player.x = FIRE_X;
    s.player.y = FIRE_Y;
    step(s, { moveX: 0, moveY: 0, attack: true }, 0.05, mulberry32(0));
    expect(s.wolves).toHaveLength(0);
    expect(s.events).toContain('hit');
    expect(s.events).toContain('wolfdie');
  });
});

describe('wildwood: day/night cycle', () => {
  it('day turns to night and schedules wolves', () => {
    const s = createWildwoodState({ dayLength: 1, baseWolves: 3 }, mulberry32(13));
    step(s, IDLE, 1, mulberry32(0));
    expect(s.isNight).toBe(true);
    expect(s.toSpawn).toBe(3);
    expect(s.events).toContain('nightfall');
  });

  it('surviving the night advances the count and breaks dawn', () => {
    const s = createWildwoodState({ dayLength: 0.5, nightLength: 0.5, baseWolves: 0 }, mulberry32(14));
    step(s, IDLE, 0.5, mulberry32(0)); // → night
    expect(s.isNight).toBe(true);
    step(s, IDLE, 0.5, mulberry32(0)); // → dawn
    expect(s.isNight).toBe(false);
    expect(s.survived).toBe(1);
    expect(s.night).toBe(2);
    expect(s.events).toContain('dawn');
  });

  it('wins once the target night is survived', () => {
    const s = createWildwoodState(
      { dayLength: 0.5, nightLength: 0.5, baseWolves: 0, winNight: 1 },
      mulberry32(15),
    );
    step(s, IDLE, 0.5, mulberry32(0)); // → night 1
    step(s, IDLE, 0.5, mulberry32(0)); // survive night 1 → win
    expect(s.phase).toBe('won');
    expect(s.survived).toBe(1);
    expect(s.events).toContain('won');
  });
});

describe('wildwood: end states', () => {
  it('zero health ends the game', () => {
    const s = createWildwoodState({ startFood: 0 }, mulberry32(16));
    s.player.health = 0.1;
    s.player.hunger = 0; // starving finishes the job
    step(s, IDLE, 1, mulberry32(0));
    expect(s.phase).toBe('over');
    expect(s.events).toContain('gameover');
  });

  it('step is a no-op once the game is over', () => {
    const s = createWildwoodState({}, mulberry32(17));
    s.phase = 'over';
    const before = JSON.stringify(s.player);
    step(s, { moveX: 1, moveY: 1, attack: true }, 1, mulberry32(0));
    expect(JSON.stringify(s.player)).toBe(before);
    expect(s.events).toHaveLength(0);
  });
});
