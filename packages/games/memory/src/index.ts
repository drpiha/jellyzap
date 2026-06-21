import type { Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import {
  DEFAULT_PAIRS,
  computeScore,
  createMemoryState,
  flip,
  resolvePair,
  unflip,
  type Card,
  type MemoryState,
} from './logic';
import { computeLayout, draw, hitTest } from './render';
import { registerMemorySfx } from './sfx';

/** How long a mismatched pair stays visible before flipping back (seconds). */
const MISMATCH_DELAY = 0.8;

export default function createMemory(): Game {
  let ctx!: GameContext;
  let state!: MemoryState;
  /** the cards currently flipped face-up awaiting resolution (0, 1 or 2) */
  let selection: Card[] = [];
  /** >0 while a mismatched pair is shown; counts down then flips them back */
  let mismatchTimer = 0;

  function reset(): void {
    state = createMemoryState(ctx.rng, DEFAULT_PAIRS);
    selection = [];
    mismatchTimer = 0;
    ctx.score.reset();
  }

  function selectCard(index: number): void {
    if (state.won) return;
    // ignore input while a mismatched pair is still being shown
    if (mismatchTimer > 0) return;
    if (index < 0 || index >= state.cards.length) return;

    const card = state.cards[index];
    if (card.matched || card.faceUp) return; // already shown or solved
    if (selection.length >= 2) return; // shouldn't happen, but guard

    flip(card);
    ctx.audio.play('flip');
    selection.push(card);

    if (selection.length === 2) {
      const [a, b] = selection;
      const matched = resolvePair(state, a, b);
      if (matched) {
        ctx.audio.play('match');
        selection = [];
        if (state.won) finishGame();
      } else {
        ctx.audio.play('mismatch');
        mismatchTimer = MISMATCH_DELAY; // leave both visible, then flip back
      }
    }
  }

  function finishGame(): void {
    const score = computeScore(state);
    ctx.score.set(score);
    ctx.hooks.onScore?.(score);
    ctx.audio.play('win');
    const isHigh = ctx.score.commitHighScore();
    void ctx.hooks.onGameOver?.(score, isHigh);
  }

  return {
    meta: {
      slug: 'memory',
      defaultControls: 'both',
      orientation: 'any',
      hasLives: false,
      supportsPause: true,
      aspectRatio: 1,
    },
    init(c) {
      ctx = c;
      registerMemorySfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (state.won) return;
      if (mismatchTimer > 0) {
        mismatchTimer -= dt;
        if (mismatchTimer <= 0) {
          mismatchTimer = 0;
          for (const card of selection) unflip(card);
          selection = [];
        }
      }
    },
    render() {
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        moves: state.moves,
        pairs: state.pairs,
        found: state.found,
        won: state.won,
        score: computeScore(state),
        movesLabel: ctx.t('game.moves'),
        pairsLabel: ctx.t('game.pairs'),
        scoreLabel: ctx.t('game.score'),
        winLabel: ctx.t('game.youWin'),
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
      onTap(p: PointerInfo) {
        const layout = computeLayout(state.cards.length, ctx.width, ctx.height);
        selectCard(hitTest(layout, state.cards.length, p.x, p.y));
      },
      onPointerDown(p: PointerInfo) {
        const layout = computeLayout(state.cards.length, ctx.width, ctx.height);
        selectCard(hitTest(layout, state.cards.length, p.x, p.y));
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
