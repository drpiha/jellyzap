import type { AudioManager } from '@jellyzap/game-sdk';

/** Register the Word game's procedurally synthesized sound effects. */
export function registerWordSfx(audio: AudioManager): void {
  audio.registerSfx('type', { type: 'square', freq: 420, duration: 0.03, gain: 0.07 });
  audio.registerSfx('submit', { type: 'sine', freq: 360, freqEnd: 520, duration: 0.1, gain: 0.16 });
  audio.registerSfx('correct', {
    type: 'triangle',
    freq: 520,
    freqEnd: 880,
    duration: 0.16,
    gain: 0.22,
  });
  audio.registerSfx('present', { type: 'sine', freq: 440, freqEnd: 600, duration: 0.1, gain: 0.16 });
  audio.registerSfx('win', { type: 'square', freq: 660, freqEnd: 1320, duration: 0.4, gain: 0.26 });
  audio.registerSfx('lose', {
    type: 'sawtooth',
    freq: 300,
    freqEnd: 70,
    duration: 0.5,
    gain: 0.28,
  });
}
