import type { AudioManager } from '@jellyzap/game-sdk';

/** Procedurally synthesized sound effects for the Wheel of Fortune game. */
export function registerWheelSfx(audio: AudioManager): void {
  // a rising whoosh as the wheel kicks off
  audio.registerSfx('spin', { type: 'sawtooth', freq: 180, freqEnd: 520, duration: 0.35, gain: 0.18 });
  // a short tick each time the pointer passes a peg
  audio.registerSfx('tick', { type: 'square', freq: 880, duration: 0.03, gain: 0.08 });
  // bright two-tone chirp when a letter is revealed
  audio.registerSfx('reveal', { type: 'square', freq: 600, freqEnd: 1000, duration: 0.14, gain: 0.24 });
  // a low buzz for a wrong guess
  audio.registerSfx('wrong', { type: 'sawtooth', freq: 220, freqEnd: 90, duration: 0.3, gain: 0.26 });
  // harsh descending sweep for BANKRUPT
  audio.registerSfx('bankrupt', { type: 'sawtooth', freq: 320, freqEnd: 50, duration: 0.55, gain: 0.3 });
  // cheerful rising tone for a win
  audio.registerSfx('win', { type: 'triangle', freq: 520, freqEnd: 1180, duration: 0.5, gain: 0.3 });
  // somber descending tone for a loss
  audio.registerSfx('lose', { type: 'sine', freq: 420, freqEnd: 120, duration: 0.6, gain: 0.28 });
}
