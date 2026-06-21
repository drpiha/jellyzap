import { setupCanvas } from './canvas';
import { createAudio } from './audio';
import { createInput } from './input';
import { createFixedLoop } from './loop';
import { mulberry32, randomSeed } from './rng';
import { createScoreTracker } from './score';
import { createStorage } from './storage';
import type { GameContext, GameHostHandle, GameHostOptions, LifecycleHooks } from './types';

/**
 * Mounts a {@link Game} into the DOM and wires it to the loop, canvas, input,
 * audio, scoring and the ad/analytics hooks. The game itself never touches ads,
 * analytics or the animation frame — it only talks to its {@link GameContext}.
 */
export async function createGameHost(opts: GameHostOptions): Promise<GameHostHandle> {
  const { game, mount } = opts;
  const slug = game.meta.slug;

  const storage = createStorage(slug);
  const score = createScoreTracker(storage);
  const audio = createAudio(storage);
  const input = createInput();
  const seed = opts.seed ?? randomSeed();
  const rng = mulberry32(seed);

  // Wrap the app-provided hooks so the host can centralize analytics while the
  // app keeps responsibility for actually showing ads.
  const app: LifecycleHooks = opts.hooks ?? {};
  const hooks: LifecycleHooks = {
    onGameStart() {
      app.onGameStart?.();
      app.onAnalytics?.('game_start', { slug });
    },
    onGameOver(s, hi) {
      app.onAnalytics?.('game_over', { slug, score: s, high: hi });
      return app.onGameOver?.(s, hi);
    },
    onLevelUp(level) {
      app.onAnalytics?.('level_up', { slug, level });
      app.onLevelUp?.(level);
    },
    onScore(s) {
      app.onScore?.(s);
    },
    onRewardRequested(reason) {
      app.onAnalytics?.('reward_requested', { slug, reason });
      return app.onRewardRequested ? app.onRewardRequested(reason) : Promise.resolve(false);
    },
    onAnalytics(event, params) {
      app.onAnalytics?.(event, params);
    },
  };

  const { canvas, ctx, resize } = setupCanvas(mount);
  let dim = resize();

  const context: GameContext = {
    canvas,
    ctx,
    width: dim.width,
    height: dim.height,
    dpr: dim.dpr,
    input: input.state,
    audio,
    storage,
    score,
    rng,
    hooks,
    locale: opts.locale ?? 'en',
    t: opts.t ?? ((k) => k),
  };

  input.setHandler(game.inputEvents);
  input.attach(canvas);

  await game.init(context);

  let paused = false;
  let destroyed = false;

  const loop = createFixedLoop({
    tps: opts.tps ?? 60,
    update: (dt) => {
      if (!paused) game.update(dt);
    },
    render: () => {
      game.render();
      input.endFrame();
    },
  });

  function doPause() {
    if (paused || destroyed) return;
    paused = true;
    game.pause();
  }
  function doResume() {
    if (!paused || destroyed) return;
    paused = false;
    game.resume();
  }

  function onResize() {
    dim = resize();
    context.width = dim.width;
    context.height = dim.height;
    context.dpr = dim.dpr;
    game.resize(dim.width, dim.height, dim.dpr);
  }
  function onVisibility() {
    if (document.hidden) doPause();
  }
  function firstGesture() {
    void audio.resume();
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
  }

  const ro = new ResizeObserver(onResize);
  ro.observe(mount);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  game.resize(dim.width, dim.height, dim.dpr);
  game.start();
  hooks.onGameStart?.();
  loop.start();

  return {
    game,
    pause: doPause,
    resume: doResume,
    restart() {
      if (destroyed) return;
      score.reset();
      paused = false;
      game.start();
      hooks.onGameStart?.();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      loop.stop();
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', firstGesture);
      window.removeEventListener('keydown', firstGesture);
      input.detach();
      audio.stopMusic();
      game.destroy();
      try {
        mount.removeChild(canvas);
      } catch {
        /* already removed */
      }
    },
    setMuted(m) {
      audio.setMuted(m);
    },
    isPaused() {
      return paused;
    },
  };
}
