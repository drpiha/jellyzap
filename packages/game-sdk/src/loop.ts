export interface FixedLoop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export interface FixedLoopOptions {
  /** logic updates per second (default 60) */
  tps?: number;
  update: (dt: number) => void;
  render: () => void;
  /** injectable time source in seconds (tests) */
  now?: () => number;
  /** injectable frame scheduler (tests) */
  raf?: (cb: () => void) => number;
  caf?: (id: number) => void;
  /** clamp a single frame's delta to avoid the spiral of death (default 0.25s) */
  maxFrameTime?: number;
}

/**
 * Fixed-timestep loop with an accumulator: logic runs in constant `dt` steps so
 * gameplay is frame-rate independent and deterministic; rendering happens once
 * per animation frame.
 */
export function createFixedLoop(opts: FixedLoopOptions): FixedLoop {
  const step = 1 / (opts.tps ?? 60);
  const now = opts.now ?? (() => performance.now() / 1000);
  const raf = opts.raf ?? ((cb) => requestAnimationFrame(() => cb()));
  const caf = opts.caf ?? ((id) => cancelAnimationFrame(id));
  const maxFrame = opts.maxFrameTime ?? 0.25;

  let running = false;
  let accumulator = 0;
  let last = 0;
  let handle = 0;

  function frame() {
    if (!running) return;
    const t = now();
    let delta = t - last;
    last = t;
    if (delta > maxFrame) delta = maxFrame;
    if (delta < 0) delta = 0;
    accumulator += delta;
    // small epsilon so an exact N*step elapsed time isn't robbed of a tick by
    // floating-point accumulation error
    while (accumulator + 1e-9 >= step) {
      opts.update(step);
      accumulator -= step;
    }
    opts.render();
    handle = raf(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = now();
      accumulator = 0;
      handle = raf(frame);
    },
    stop() {
      running = false;
      if (handle) caf(handle);
      handle = 0;
    },
    get running() {
      return running;
    },
  };
}
