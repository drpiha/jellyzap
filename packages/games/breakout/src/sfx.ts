import type { AudioManager } from '@jellyzap/game-sdk';

/** Register the procedurally-synthesized Breakout sound effects. */
export function registerBreakoutSfx(audio: AudioManager): void {
  // ball glancing off a wall or the ceiling
  audio.registerSfx('bounce', { type: 'sine', freq: 320, duration: 0.05, gain: 0.12 });
  // brick shattering
  audio.registerSfx('brick', {
    type: 'square',
    freq: 660,
    freqEnd: 990,
    duration: 0.09,
    gain: 0.2,
  });
  // ball struck by the paddle
  audio.registerSfx('paddle', {
    type: 'triangle',
    freq: 240,
    freqEnd: 420,
    duration: 0.07,
    gain: 0.18,
  });
  // a life lost (ball fell off the bottom)
  audio.registerSfx('loseLife', {
    type: 'sawtooth',
    freq: 300,
    freqEnd: 90,
    duration: 0.35,
    gain: 0.28,
  });
  // level cleared
  audio.registerSfx('win', {
    type: 'square',
    freq: 520,
    freqEnd: 1040,
    duration: 0.4,
    gain: 0.26,
  });
  // out of lives
  audio.registerSfx('gameover', {
    type: 'sawtooth',
    freq: 320,
    freqEnd: 50,
    duration: 0.6,
    gain: 0.3,
  });
}
