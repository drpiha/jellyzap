import type { AudioManager } from '@jellyzap/game-sdk';

export function registerSnakeSfx(audio: AudioManager): void {
  audio.registerSfx('eat', { type: 'square', freq: 520, freqEnd: 900, duration: 0.12, gain: 0.25 });
  audio.registerSfx('die', { type: 'sawtooth', freq: 320, freqEnd: 60, duration: 0.5, gain: 0.3 });
  audio.registerSfx('turn', { type: 'sine', freq: 420, duration: 0.04, gain: 0.08 });
}
