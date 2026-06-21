import { setupCanvas } from './canvas';
import { createAudio } from './audio';
import { createInput } from './input';
import { createParticles, createShaker } from './juice';
import { createFixedLoop } from './loop';
import { mulberry32, randomSeed } from './rng';
import { createScoreTracker } from './score';
import { createStorage } from './storage';
import type { GameContext, GameHostHandle, GameHostOptions, Juice, LifecycleHooks } from './types';

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

  // cosmetic juice (screen shake + particles); suppressed for reduced-motion users
  let reducedMotion =
    opts.reducedMotion ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);
  const particles = createParticles();
  const shaker = createShaker();
  const juice: Juice = {
    get reducedMotion() {
      return reducedMotion;
    },
    shake(trauma) {
      if (!reducedMotion) shaker.add(trauma);
    },
    burst(x, y, o) {
      if (!reducedMotion) particles.burst(x, y, o);
    },
  };

  let musicEnabled = opts.music ?? true;

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
    juice,
    difficulty: opts.difficulty ?? 'easy',
    locale: opts.locale ?? 'en',
    t: opts.t ?? ((k) => k),
  };

  input.setHandler(game.inputEvents);
  input.attach(canvas);

  await game.init(context);

  let paused = false;
  let destroyed = false;
  // distinguishes an auto-pause (tab hidden) from a deliberate user pause, so we
  // only auto-resume the former when the tab becomes visible again
  let pausedByVisibility = false;

  const loop = createFixedLoop({
    tps: opts.tps ?? 60,
    update: (dt) => {
      if (paused) return;
      game.update(dt);
      if (!reducedMotion) {
        particles.update(dt);
        shaker.update(dt);
      }
    },
    render: () => {
      game.render();
      if (!reducedMotion) {
        // draw particles on top in logical (CSS px) coordinates; the game fully
        // redraws each frame so resetting the transform here is safe
        ctx.setTransform(context.dpr, 0, 0, context.dpr, 0, 0);
        particles.draw(ctx);
        // screen shake via the canvas element transform (independent of the 2D ctx)
        const o = shaker.offset();
        canvas.style.transform = o.x || o.y ? `translate(${o.x}px, ${o.y}px)` : '';
      }
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
    if (document.hidden) {
      // only auto-pause a running game; never touch an existing user pause
      if (!paused) {
        pausedByVisibility = true;
        doPause();
      }
    } else if (pausedByVisibility) {
      pausedByVisibility = false;
      doResume();
    }
  }
  function firstGesture() {
    void audio.resume().then(() => {
      if (musicEnabled) audio.startMusic();
    });
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
  // focus the canvas so keyboard input is captured right away (scoped: the input
  // manager only prevents page scrolling while the canvas holds focus)
  canvas.focus?.({ preventScroll: true });
  // if the audio context is already running (e.g. a previous game this session),
  // start music now; otherwise firstGesture() starts it after the user's tap
  if (musicEnabled) audio.startMusic();

  return {
    game,
    pause: doPause,
    resume: doResume,
    restart() {
      if (destroyed) return;
      score.reset();
      paused = false;
      particles.clear();
      canvas.style.transform = '';
      game.start();
      hooks.onGameStart?.();
      if (musicEnabled) audio.startMusic();
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
      particles.clear();
      canvas.style.transform = '';
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
    setMusicEnabled(enabled) {
      musicEnabled = enabled;
      if (enabled) audio.startMusic();
      else audio.stopMusic();
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      if (reduced) {
        particles.clear();
        canvas.style.transform = '';
      }
    },
    setDifficulty(difficulty) {
      context.difficulty = difficulty;
    },
    isPaused() {
      return paused;
    },
  };
}
