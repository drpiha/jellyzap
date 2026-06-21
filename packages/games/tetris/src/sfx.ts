import type { AudioManager } from '@jellyzap/game-sdk';

export function registerTetrisSfx(audio: AudioManager): void {
  audio.registerSfx('move', { type: 'square', freq: 220, duration: 0.03, gain: 0.06 });
  audio.registerSfx('rotate', { type: 'sine', freq: 480, freqEnd: 640, duration: 0.06, gain: 0.1 });
  audio.registerSfx('lock', { type: 'triangle', freq: 200, freqEnd: 120, duration: 0.08, gain: 0.14 });
  audio.registerSfx('lineclear', {
    type: 'square',
    freq: 520,
    freqEnd: 980,
    duration: 0.22,
    gain: 0.26,
  });
  audio.registerSfx('drop', { type: 'sawtooth', freq: 300, freqEnd: 90, duration: 0.12, gain: 0.2 });
  audio.registerSfx('gameover', {
    type: 'sawtooth',
    freq: 320,
    freqEnd: 50,
    duration: 0.6,
    gain: 0.3,
  });
}
