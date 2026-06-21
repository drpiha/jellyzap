import type { AudioManager } from '@jellyzap/game-sdk';

export function registerMemorySfx(audio: AudioManager): void {
  // soft tick when a card turns over
  audio.registerSfx('flip', { type: 'sine', freq: 480, freqEnd: 660, duration: 0.08, gain: 0.12 });
  // bright two-step chime on a successful pair
  audio.registerSfx('match', {
    type: 'triangle',
    freq: 660,
    freqEnd: 990,
    duration: 0.18,
    gain: 0.25,
  });
  // dull downward blip on a mismatch
  audio.registerSfx('mismatch', {
    type: 'square',
    freq: 300,
    freqEnd: 140,
    duration: 0.18,
    gain: 0.18,
  });
  // rising fanfare on win
  audio.registerSfx('win', {
    type: 'square',
    freq: 520,
    freqEnd: 1040,
    duration: 0.5,
    gain: 0.3,
  });
}
