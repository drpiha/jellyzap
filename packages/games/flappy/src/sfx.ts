import type { AudioManager } from '@jellyzap/game-sdk';

/** Procedurally synthesized sound effects for Flappy — no audio assets. */
export function registerFlappySfx(audio: AudioManager): void {
  // A soft upward "blip" for each flap.
  audio.registerSfx('flap', { type: 'sine', freq: 480, freqEnd: 760, duration: 0.09, gain: 0.18 });
  // Bright chime when passing a pipe.
  audio.registerSfx('score', { type: 'square', freq: 660, freqEnd: 990, duration: 0.12, gain: 0.22 });
  // Sharp thud on collision.
  audio.registerSfx('hit', { type: 'square', freq: 200, freqEnd: 70, duration: 0.16, gain: 0.3 });
  // Descending tone for game over.
  audio.registerSfx('gameover', {
    type: 'sawtooth',
    freq: 340,
    freqEnd: 50,
    duration: 0.55,
    gain: 0.28,
  });
}
