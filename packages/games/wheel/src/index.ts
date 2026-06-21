import type { Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import {
  applySpin,
  createWheelState,
  guessLetter,
  spin,
  type WheelState,
} from './logic';
import { ALPHABET, computeLayout, draw, pointInRect } from './render';
import { registerWheelSfx } from './sfx';

const SPIN_DURATION = 2.4; // seconds of wheel animation per spin
const FULL_TURNS = 4; // base whole rotations before settling

/** Map a keyboard code to an A–Z letter, or null. */
function letterFromKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  return null;
}

export default function createWheel(): Game {
  let ctx!: GameContext;
  let state!: WheelState;

  // spin animation state
  let spinning = false;
  let spinT = 0;
  let startAngle = 0;
  let targetAngle = 0;
  let pendingIndex = -1;
  let displayAngle = 0;
  let lastTickStep = -1; // for the peg "tick" sound
  let resolved = false; // guards a single onGameOver call

  function reset(): void {
    state = createWheelState(ctx.rng, ctx.locale);
    spinning = false;
    spinT = 0;
    displayAngle = 0;
    startAngle = 0;
    targetAngle = 0;
    pendingIndex = -1;
    lastTickStep = -1;
    resolved = false;
    ctx.score.reset();
  }

  /**
   * Compute the wheel rotation that brings segment `index`'s center under the
   * pointer (which sits at the top of the wheel). With no rotation, segment i
   * spans [i·slice, (i+1)·slice) measured clockwise from the +x axis; its center
   * is at (i+0.5)·slice. The pointer is at angle -π/2 (straight up). We want
   * angle so that (i+0.5)·slice + angle ≡ -π/2 (mod 2π), then add whole turns.
   */
  function angleForIndex(index: number): number {
    const n = state.segments.length;
    const slice = (Math.PI * 2) / n;
    const segCenter = (index + 0.5) * slice;
    let base = -Math.PI / 2 - segCenter;
    // normalize into [0, 2π) relative to the current resting position
    const twoPi = Math.PI * 2;
    base = ((base % twoPi) + twoPi) % twoPi;
    // ensure we always rotate forward by several full turns from displayAngle
    const current = ((displayAngle % twoPi) + twoPi) % twoPi;
    let delta = base - current;
    if (delta < 0) delta += twoPi;
    return displayAngle + FULL_TURNS * twoPi + delta;
  }

  function beginSpin(): void {
    if (spinning || state.awaitingGuess || state.won || state.lost) return;
    pendingIndex = spin(ctx.rng, state.weights);
    startAngle = displayAngle;
    targetAngle = angleForIndex(pendingIndex);
    spinT = 0;
    spinning = true;
    lastTickStep = -1;
    ctx.audio.play('spin');
  }

  function resolveSpin(): void {
    spinning = false;
    displayAngle = targetAngle;
    const result = applySpin(state, pendingIndex);
    pendingIndex = -1;
    if (result.kind === 'bankrupt') {
      ctx.audio.play('bankrupt');
    } else if (result.kind === 'lose_turn') {
      ctx.audio.play('wrong');
      checkEnd();
    }
    // 'value' → awaitingGuess is now true; wait for a letter.
  }

  function doGuess(letter: string): void {
    if (spinning || !state.awaitingGuess || state.won || state.lost) return;
    const res = guessLetter(state, letter);
    if (res.kind === 'hit') {
      ctx.audio.play('reveal');
      ctx.score.set(state.roundScore);
      ctx.hooks.onScore?.(state.roundScore);
    } else if (res.kind === 'miss') {
      ctx.audio.play('wrong');
    }
    checkEnd();
  }

  function checkEnd(): void {
    if (resolved) return;
    if (state.won || state.lost) {
      resolved = true;
      if (state.won) {
        ctx.score.set(state.roundScore);
        ctx.audio.play('win');
      } else {
        ctx.audio.play('lose');
      }
      const isHigh = ctx.score.commitHighScore();
      void ctx.hooks.onGameOver?.(state.roundScore, isHigh);
    }
  }

  function handlePointer(p: PointerInfo): void {
    if (state.won || state.lost) return;
    const L = computeLayout(ctx.width, ctx.height, ALPHABET);
    if (!spinning && !state.awaitingGuess && pointInRect(p.x, p.y, L.spinButton)) {
      beginSpin();
      return;
    }
    if (state.awaitingGuess && !spinning) {
      for (const k of L.keys) {
        if (pointInRect(p.x, p.y, k.rect)) {
          doGuess(k.letter);
          return;
        }
      }
    }
  }

  return {
    meta: {
      slug: 'wheel',
      defaultControls: 'both',
      orientation: 'any',
      hasLives: true,
      supportsPause: true,
      aspectRatio: 0.75,
    },
    init(c) {
      ctx = c;
      registerWheelSfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (!spinning) return;
      spinT += dt;
      const t = Math.min(1, spinT / SPIN_DURATION);
      // ease-out cubic for a natural decelerating spin
      const eased = 1 - Math.pow(1 - t, 3);
      displayAngle = startAngle + (targetAngle - startAngle) * eased;

      // play a tick as the pointer crosses each segment boundary
      const n = state.segments.length;
      const slice = (Math.PI * 2) / n;
      const stepNow = Math.floor(displayAngle / slice);
      if (stepNow !== lastTickStep) {
        if (lastTickStep !== -1) ctx.audio.play('tick');
        lastTickStep = stepNow;
      }

      if (t >= 1) resolveSpin();
    },
    render() {
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        high: ctx.score.highScore,
        angle: displayAngle,
        spinning,
        scoreLabel: ctx.t('game.score'),
        bestLabel: ctx.t('game.best'),
        livesLabel: ctx.t('game.lives'),
        spinLabel: ctx.t('game.spin'),
        spinValueLabel: ctx.t('game.value'),
        wordLabel: ctx.t('game.word'),
        winLabel: ctx.t('game.win'),
        loseLabel: ctx.t('game.gameOver'),
      });
    },
    resize() {
      /* rendering reads ctx.width/height each frame */
    },
    pause() {
      /* host stops calling update while paused */
    },
    resume() {
      /* nothing to restore */
    },
    inputEvents: {
      onPointerDown(p) {
        handlePointer(p);
      },
      onKeyDown(code) {
        if (state.won || state.lost) return;
        if (code === 'Space' || code === 'Enter') {
          if (!state.awaitingGuess) beginSpin();
          return;
        }
        const letter = letterFromKey(code);
        if (letter) doGuess(letter);
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
