import { describe, expect, it } from 'vitest';
import { createFixedLoop } from '../loop';
import { createManualClock } from '../test-utils';

describe('createFixedLoop', () => {
  it('runs the expected number of fixed updates for elapsed time', () => {
    const clock = createManualClock();
    let updates = 0;
    let renders = 0;
    const loop = createFixedLoop({
      tps: 60,
      maxFrameTime: 100,
      now: clock.now,
      raf: clock.raf,
      caf: clock.caf,
      update: () => {
        updates++;
      },
      render: () => {
        renders++;
      },
    });
    loop.start();
    clock.tick(1); // 1 second → 60 updates, 1 render
    expect(updates).toBe(60);
    expect(renders).toBe(1);
    clock.tick(0.5); // +30 updates
    expect(updates).toBe(90);
    expect(renders).toBe(2);
  });

  it('clamps huge frames to avoid the spiral of death', () => {
    const clock = createManualClock();
    let updates = 0;
    const loop = createFixedLoop({
      tps: 60,
      maxFrameTime: 0.25,
      now: clock.now,
      raf: clock.raf,
      caf: clock.caf,
      update: () => {
        updates++;
      },
      render: () => {},
    });
    loop.start();
    clock.tick(10); // clamped to 0.25s → 15 updates
    expect(updates).toBe(15);
  });

  it('stops cleanly', () => {
    const clock = createManualClock();
    let updates = 0;
    const loop = createFixedLoop({
      now: clock.now,
      raf: clock.raf,
      caf: clock.caf,
      maxFrameTime: 100,
      update: () => {
        updates++;
      },
      render: () => {},
    });
    loop.start();
    clock.tick(0.1);
    loop.stop();
    const before = updates;
    clock.tick(1);
    expect(updates).toBe(before);
    expect(loop.running).toBe(false);
  });
});
