import type { AudioManager } from '@jellyzap/game-sdk';

/** Procedurally synthesized Match-3 sound effects (no audio assets). */
export function registerMatch3Sfx(audio: AudioManager): void {
  audio.registerSfx('select', { type: 'sine', freq: 540, duration: 0.05, gain: 0.1 });
  audio.registerSfx('swap', { type: 'triangle', freq: 420, freqEnd: 640, duration: 0.1, gain: 0.16 });
  audio.registerSfx('match', { type: 'square', freq: 600, freqEnd: 980, duration: 0.14, gain: 0.22 });
  audio.registerSfx('cascade', { type: 'square', freq: 760, freqEnd: 1320, duration: 0.18, gain: 0.24 });
  audio.registerSfx('invalid', { type: 'sawtooth', freq: 300, freqEnd: 130, duration: 0.16, gain: 0.18 });
  audio.registerSfx('gameover', { type: 'sawtooth', freq: 360, freqEnd: 70, duration: 0.55, gain: 0.3 });
}
