import type { AudioManager } from '@jellyzap/game-sdk';

/** Register Wildwood Nights' procedurally-synthesized sound effects (no assets). */
export function registerWildwoodSfx(audio: AudioManager): void {
  audio.registerSfx('chop', { type: 'square', freq: 150, freqEnd: 70, duration: 0.09, gain: 0.26 });
  audio.registerSfx('pick', { type: 'sine', freq: 520, freqEnd: 720, duration: 0.07, gain: 0.16 });
  audio.registerSfx('feed', { type: 'sawtooth', freq: 120, freqEnd: 180, duration: 0.12, gain: 0.18 });
  audio.registerSfx('eat', { type: 'triangle', freq: 320, freqEnd: 180, duration: 0.1, gain: 0.2 });
  audio.registerSfx('swing', { type: 'noise', duration: 0.08, gain: 0.14 });
  audio.registerSfx('hit', { type: 'square', freq: 240, freqEnd: 90, duration: 0.1, gain: 0.28 });
  audio.registerSfx('wolfdie', { type: 'sawtooth', freq: 300, freqEnd: 60, duration: 0.22, gain: 0.26 });
  audio.registerSfx('bite', { type: 'sawtooth', freq: 160, freqEnd: 70, duration: 0.16, gain: 0.3 });
  audio.registerSfx('nightfall', { type: 'sine', freq: 420, freqEnd: 200, duration: 0.5, gain: 0.22 });
  audio.registerSfx('dawn', { type: 'sine', freq: 300, freqEnd: 600, duration: 0.5, gain: 0.22 });
  audio.registerSfx('firelow', { type: 'triangle', freq: 700, freqEnd: 500, duration: 0.18, gain: 0.2 });
  audio.registerSfx('fireout', { type: 'sawtooth', freq: 200, freqEnd: 50, duration: 0.4, gain: 0.24 });
  audio.registerSfx('gameover', { type: 'sawtooth', freq: 300, freqEnd: 60, duration: 0.6, gain: 0.3 });
  audio.registerSfx('won', { type: 'square', freq: 440, freqEnd: 880, duration: 0.5, gain: 0.28 });
}
