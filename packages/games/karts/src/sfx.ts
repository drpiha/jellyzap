import type { AudioManager } from '@jellyzap/game-sdk';

export function registerKartsSfx(audio: AudioManager): void {
  audio.registerSfx('shoot', {
    type: 'square',
    freq: 680,
    freqEnd: 320,
    duration: 0.1,
    gain: 0.18,
  });
  audio.registerSfx('hit', { type: 'triangle', freq: 240, freqEnd: 140, duration: 0.08, gain: 0.2 });
  audio.registerSfx('explode', {
    type: 'noise',
    freq: 200,
    duration: 0.35,
    gain: 0.32,
    attack: 0.002,
  });
  audio.registerSfx('engine', { type: 'sawtooth', freq: 90, freqEnd: 130, duration: 0.06, gain: 0.05 });
  audio.registerSfx('gameover', {
    type: 'sawtooth',
    freq: 300,
    freqEnd: 50,
    duration: 0.6,
    gain: 0.3,
  });
}
