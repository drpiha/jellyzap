import type { AudioManager } from '@jellyzap/game-sdk';

export function registerPenaltySfx(audio: AudioManager): void {
  audio.registerSfx('kick', { type: 'square', freq: 200, freqEnd: 90, duration: 0.1, gain: 0.3 });
  audio.registerSfx('goal', { type: 'square', freq: 440, freqEnd: 880, duration: 0.28, gain: 0.3 });
  audio.registerSfx('save', { type: 'sawtooth', freq: 220, freqEnd: 70, duration: 0.3, gain: 0.28 });
  audio.registerSfx('whistle', { type: 'sine', freq: 1900, freqEnd: 1500, duration: 0.18, gain: 0.18 });
  audio.registerSfx('select', { type: 'sine', freq: 600, duration: 0.04, gain: 0.12 });
}
