import { afterEach, vi } from 'vitest';
import { observeResizeAfterFrame } from './resize-observer';

describe('Resize-driven layout updates', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function setup() {
    let notify!: () => void;
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notify = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback); return nextFrame;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
    const flush = () => {
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(0));
    };
    return { notify: () => notify(), frames, disconnect, flush };
  }

  it('measures initially but batches resize notifications outside observer delivery', () => {
    const { notify, frames, flush } = setup();
    const element = document.createElement('div');
    let width = 390;
    const widths: number[] = [];
    const stop = observeResizeAfterFrame([element], () => widths.push(width));
    expect(widths).toEqual([390]);
    width = 1280;
    notify(); notify(); notify();
    expect(widths).toEqual([390]);
    expect(frames.size).toBe(1);
    flush();
    expect(widths).toEqual([390, 1280]);
    width = 640; notify(); flush();
    expect(widths).toEqual([390, 1280, 640]);
    stop();
  });

  it('cancels pending layout work on destruction and ignores stale notifications', () => {
    const { notify, frames, disconnect, flush } = setup();
    const measure = vi.fn();
    const stop = observeResizeAfterFrame([document.createElement('div')], measure);
    notify();
    stop(); notify(); flush();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
    expect(measure).toHaveBeenCalledOnce();
  });
});
