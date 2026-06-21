import type { AudioManager, SfxSpec, Storage } from './types';

/**
 * Web Audio based audio manager. SFX are synthesized procedurally (oscillators +
 * noise) so the bundle ships **no audio assets**. Mute/volume persist globally.
 * The AudioContext only starts after `resume()` is called from a user gesture.
 */
export function createAudio(storage: Storage): AudioManager {
  let actx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = storage.get<boolean>('audio.muted', false);
  let volume = storage.get<number>('audio.volume', 0.7);
  const specs = new Map<string, SfxSpec>();

  let musicBuffer: AudioBuffer | null = null;
  let musicSource: AudioBufferSourceNode | null = null;
  let musicGain: GainNode | null = null;
  let musicTimer: ReturnType<typeof setInterval> | null = null;
  let musicStep = 0;

  function ensure(): AudioContext | null {
    if (actx) return actx;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    actx = new Ctor();
    master = actx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(actx.destination);
    return actx;
  }

  return {
    registerSfx(name, spec) {
      specs.set(name, spec);
    },
    play(name) {
      if (muted) return;
      const spec = specs.get(name);
      const ac = ensure();
      if (!spec || !ac || !master || ac.state !== 'running') return;
      const t0 = ac.currentTime;
      const dur = spec.duration;
      const peak = spec.gain ?? 0.3;
      const attack = spec.attack ?? 0.005;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      gain.connect(master);

      if (spec.type === 'noise') {
        const len = Math.max(1, Math.ceil(ac.sampleRate * dur));
        const buffer = ac.createBuffer(1, len, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource();
        src.buffer = buffer;
        src.connect(gain);
        // release the per-play nodes once playback ends so they don't pile up on
        // the master bus over a long session
        src.onended = () => {
          src.disconnect();
          gain.disconnect();
        };
        src.start(t0);
        src.stop(t0 + dur);
      } else {
        const osc = ac.createOscillator();
        osc.type = spec.type;
        const f0 = spec.freq ?? 440;
        osc.frequency.setValueAtTime(f0, t0);
        if (spec.freqEnd && spec.freqEnd !== f0) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.freqEnd), t0 + dur);
        }
        osc.connect(gain);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t0);
        osc.stop(t0 + dur);
      }
    },
    async loadMusic(url) {
      const ac = ensure();
      if (!ac) return;
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      musicBuffer = await ac.decodeAudioData(arr);
    },
    playMusic(loop = true) {
      const ac = ensure();
      if (!ac || !master || !musicBuffer || ac.state !== 'running') return;
      this.stopMusic();
      musicGain = ac.createGain();
      musicGain.gain.value = 0.4;
      musicGain.connect(master);
      musicSource = ac.createBufferSource();
      musicSource.buffer = musicBuffer;
      musicSource.loop = loop;
      musicSource.connect(musicGain);
      musicSource.start();
    },
    startMusic() {
      const ac = ensure();
      // needs a user gesture first (ac running); no-op if already playing or muted
      if (!ac || !master || ac.state !== 'running' || musicTimer) return;
      // cozy minor-pentatonic arpeggio, gentle and asset-free
      const root = 220; // A3
      const scale = [0, 3, 5, 7, 10, 12, 10, 7]; // up-and-down for a soft melody
      const masterNode = master;
      const playNote = () => {
        if (muted || ac.state !== 'running') return;
        const t0 = ac.currentTime;
        const semis = scale[musicStep % scale.length];
        musicStep++;
        const freq = root * Math.pow(2, semis / 12);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
        g.connect(masterNode);
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0);
        osc.connect(g);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
        };
        osc.start(t0);
        osc.stop(t0 + 0.6);
      };
      playNote();
      musicTimer = setInterval(playNote, 430);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
      try {
        musicSource?.stop();
      } catch {
        /* already stopped */
      }
      musicSource?.disconnect();
      musicGain?.disconnect();
      musicSource = null;
      musicGain = null;
    },
    setMuted(value) {
      muted = value;
      storage.set('audio.muted', muted);
      if (master) master.gain.value = muted ? 0 : volume;
    },
    isMuted() {
      return muted;
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      storage.set('audio.volume', volume);
      if (master && !muted) master.gain.value = volume;
    },
    getVolume() {
      return volume;
    },
    async resume() {
      const ac = ensure();
      if (ac && ac.state === 'suspended') await ac.resume();
    },
  };
}
