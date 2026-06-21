import type { AudioManager } from '@jellyzap/game-sdk';

export function registerFootballSfx(audio: AudioManager): void {
  audio.registerSfx('kick', { type: 'square', freq: 210, freqEnd: 90, duration: 0.1, gain: 0.28 });
  audio.registerSfx('goal', { type: 'square', freq: 440, freqEnd: 880, duration: 0.3, gain: 0.3 });
  audio.registerSfx('miss', { type: 'triangle', freq: 300, freqEnd: 160, duration: 0.16, gain: 0.2 });
  audio.registerSfx('tackle', { type: 'sawtooth', freq: 180, freqEnd: 70, duration: 0.22, gain: 0.26 });
  audio.registerSfx('whistle', { type: 'sine', freq: 1900, freqEnd: 1500, duration: 0.2, gain: 0.18 });
}
