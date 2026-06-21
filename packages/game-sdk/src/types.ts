/**
 * The Jellyzap Game SDK contract.
 *
 * Every game implements {@link Game}. The host ({@link createGameHost}) injects a
 * {@link GameContext} that provides the loop, canvas, input, audio, scoring, a
 * seedable RNG and the ad/analytics lifecycle hooks. Keep game *logic* pure (no
 * DOM, no `Math.random`, no `requestAnimationFrame`) so it can be unit-tested and
 * replayed deterministically.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GameMeta {
  /** unique kebab-case id, matches the package + route + content entry */
  slug: string;
  defaultControls: 'keyboard' | 'touch' | 'both';
  orientation: 'portrait' | 'landscape' | 'any';
  /** game has a finite number of lives → enables "continue" via a rewarded ad */
  hasLives: boolean;
  supportsPause: boolean;
  /** preferred logical aspect ratio (width / height); the host reserves the box */
  aspectRatio?: number;
}

export interface PointerInfo {
  x: number;
  y: number;
  id: number;
}

export interface InputState {
  /** currently held keys, by `KeyboardEvent.code` */
  readonly keys: ReadonlySet<string>;
  /** active pointers (mouse/touch) in canvas-logical coordinates */
  readonly pointers: ReadonlyMap<number, PointerInfo>;
  /** true only on the frame the key transitioned from up → down */
  justPressed(code: string): boolean;
}

export interface InputEvents {
  /**
   * @param code physical `KeyboardEvent.code` (layout-independent, e.g. `KeyA`)
   * @param key  the produced `KeyboardEvent.key` (layout/locale aware, e.g. `ç`),
   *             so games can accept diacritics that have no `Key*` code
   */
  onKeyDown?(code: string, key?: string): void;
  onKeyUp?(code: string): void;
  onSwipe?(dir: Direction): void;
  onTap?(p: PointerInfo): void;
  onPointerDown?(p: PointerInfo): void;
  onPointerMove?(p: PointerInfo): void;
  onPointerUp?(p: PointerInfo): void;
  /** virtual on-screen control activated (host-provided buttons) */
  onAction?(action: string): void;
}

export type SfxType = 'square' | 'sine' | 'triangle' | 'sawtooth' | 'noise';

/** A procedurally synthesized sound effect — no audio asset required. */
export interface SfxSpec {
  type: SfxType;
  /** start frequency in Hz (ignored for noise) */
  freq?: number;
  /** optional end frequency for a pitch sweep */
  freqEnd?: number;
  /** total duration in seconds */
  duration: number;
  /** peak gain 0..1 */
  gain?: number;
  /** attack time in seconds (default 0.005) */
  attack?: number;
}

export interface AudioManager {
  registerSfx(name: string, spec: SfxSpec): void;
  play(name: string): void;
  loadMusic(url: string): Promise<void>;
  playMusic(loop?: boolean): void;
  /** start gentle, asset-free procedural background music (no-op if already on) */
  startMusic(): void;
  stopMusic(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  getVolume(): number;
  /** resume the AudioContext after a user gesture (autoplay policy) */
  resume(): Promise<void>;
}

export interface Storage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export interface ScoreTracker {
  readonly score: number;
  readonly highScore: number;
  add(points: number): void;
  set(points: number): void;
  reset(): void;
  /** persist the score if it beats the stored high score; returns true on a new record */
  commitHighScore(): boolean;
}

/** Options for a particle burst (all optional). */
export interface BurstOptions {
  /** number of particles (default 12) */
  count?: number;
  /** a single CSS color or a palette to pick from */
  color?: string | string[];
  /** initial speed in logical px/s (default 90) */
  speed?: number;
  /** particle size in logical px (default 4) */
  size?: number;
  /** angular spread in radians; >= 2π means a full circle (default full circle) */
  spread?: number;
  /** downward acceleration in px/s² (default 220) */
  gravity?: number;
  /** base lifetime in seconds (default 0.6) */
  life?: number;
}

/**
 * Render-layer "juice": screen shake + particle bursts. Cosmetic only — it never
 * touches game logic, so games stay deterministic. All calls are no-ops when
 * {@link Juice.reducedMotion} is true (accessibility / user setting).
 */
export interface Juice {
  /** add screen-shake trauma in [0,1] (shake intensity ∝ trauma²) */
  shake(trauma: number): void;
  /** emit a particle burst at logical (x, y) */
  burst(x: number, y: number, opts?: BurstOptions): void;
  /** true when motion effects are suppressed */
  readonly reducedMotion: boolean;
}

export type RewardReason = 'extra_life' | 'continue';

export interface LifecycleHooks {
  onGameStart?(): void;
  onGameOver?(score: number, isHighScore: boolean): void | Promise<void>;
  onLevelUp?(level: number): void;
  onScore?(score: number): void;
  /** request a rewarded ad; resolves true if the reward was granted */
  onRewardRequested?(reason: RewardReason): Promise<boolean>;
  onAnalytics?(event: string, params?: Record<string, unknown>): void;
}

export interface GameContext {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** logical (CSS px) width — draw using these, not device pixels */
  width: number;
  height: number;
  dpr: number;
  readonly input: InputState;
  readonly audio: AudioManager;
  readonly storage: Storage;
  readonly score: ScoreTracker;
  /** seedable PRNG in [0,1); deterministic when a seed is supplied to the host */
  rng(): number;
  readonly hooks: LifecycleHooks;
  /** cosmetic screen-shake + particles (never affects game logic) */
  readonly juice: Juice;
  locale: string;
  t(key: string): string;
}

export interface Game {
  readonly meta: GameMeta;
  init(ctx: GameContext): void | Promise<void>;
  /** (re)start a round */
  start(): void;
  /** advance logic by a fixed `dt` (seconds) */
  update(dt: number): void;
  render(): void;
  resize(width: number, height: number, dpr: number): void;
  pause(): void;
  resume(): void;
  inputEvents?: InputEvents;
  destroy(): void;
}

export interface GameHostOptions {
  game: Game;
  mount: HTMLElement;
  hooks?: LifecycleHooks;
  t?: (key: string) => string;
  locale?: string;
  /** fixed seed for deterministic play (used by E2E tests) */
  seed?: number;
  showVirtualControls?: boolean | 'auto';
  /** fixed logic ticks per second (default 60) */
  tps?: number;
  /** suppress screen shake / particles (defaults to the OS prefers-reduced-motion) */
  reducedMotion?: boolean;
  /** play gentle procedural background music (default true) */
  music?: boolean;
}

export interface GameHostHandle {
  readonly game: Game;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
  setMuted(muted: boolean): void;
  /** turn the procedural background music on/off */
  setMusicEnabled(enabled: boolean): void;
  /** toggle screen shake / particles at runtime (accessibility) */
  setReducedMotion(reduced: boolean): void;
  isPaused(): boolean;
}

export type GameFactory = () => Game;
