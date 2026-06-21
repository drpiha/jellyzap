import type { AudioManager } from '@jellyzap/game-sdk';

export function register2048Sfx(audio: AudioManager): void {
  audio.registerSfx('move', { type: 'sine', freq: 240, duration: 0.05, gain: 0.07 });
  audio.registerSfx('merge', {
    type: 'square',
    freq: 440,
    freqEnd: 660,
    duration: 0.12,
    gain: 0.22,
  });
  audio.registerSfx('spawn', { type: 'triangle', freq: 320, freqEnd: 480, duration: 0.08, gain: 0.1 });
  audio.registerSfx('gameover', {
    type: 'sawtooth',
    freq: 300,
    freqEnd: 60,
    duration: 0.5,
    gain: 0.3,
  });
}
