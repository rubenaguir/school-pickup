import { describe, expect, it, vi } from 'vitest';
import { createBoardAudioQueue } from './audio-queue';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Drains queued microtasks + a handful of `setTimeout(0)` macrotasks (the inter-item gaps). */
const flush = async () => {
  for (let i = 0; i < 12; i += 1) await tick();
};

/**
 * A recording double for the queue's play deps. `playVoice` blocks until the
 * test releases it, so a test can enqueue more work — including a priority
 * item — while an earlier item is still "playing".
 */
function recordingQueue() {
  const order: string[] = [];
  let releaseCurrent: (() => void) | null = null;

  const queue = createBoardAudioQueue({
    gapMs: 0,
    playActivationChime: () => {
      order.push('activation-chime');
      return Promise.resolve();
    },
    playVoice: (text: string) => {
      order.push(`voice:${text}`);
      return new Promise<void>((resolve) => {
        releaseCurrent = resolve;
      });
    },
  });

  const finishCurrentVoice = () => {
    releaseCurrent?.();
    releaseCurrent = null;
  };

  return { queue, order, finishCurrentVoice };
}

describe('createBoardAudioQueue', () => {
  it('plays items first-in-first-out', async () => {
    const order: string[] = [];
    const queue = createBoardAudioQueue({
      gapMs: 0,
      playActivationChime: () => {
        order.push('activation-chime');
        return Promise.resolve();
      },
      playVoice: (text) => {
        order.push(`voice:${text}`);
        return Promise.resolve();
      },
    });

    queue.enqueueVoice('Ana llegando');
    queue.enqueueActivationChime();
    queue.enqueueVoice('Beto en puerta');

    await flush();

    expect(order).toEqual(['voice:Ana llegando', 'activation-chime', 'voice:Beto en puerta']);
  });

  it('inserts a priority item at the FRONT of the waiting queue without interrupting what is playing', async () => {
    const { queue, order, finishCurrentVoice } = recordingQueue();

    // First item starts playing and blocks until we release it.
    queue.enqueueVoice('Ana llegando');
    await tick();
    expect(order).toEqual(['voice:Ana llegando']);

    // Queue is now non-empty behind the playing item: [Beto, chime].
    queue.enqueueVoice('Beto en puerta');
    queue.enqueueActivationChime();
    // A manual announcement arrives — it must be NEXT (ahead of the whole
    // waiting backlog), but must not cut off Ana. It jumps to the front only;
    // the rest of the backlog keeps its order behind it: [Carla, Beto, chime].
    queue.enqueueVoice('Carla en puerta', { priority: true });

    finishCurrentVoice(); // Ana finishes
    await flush();
    finishCurrentVoice(); // Carla (the priority item) finishes
    await flush();
    finishCurrentVoice(); // Beto finishes
    await flush();

    expect(order).toEqual([
      'voice:Ana llegando',
      'voice:Carla en puerta',
      'voice:Beto en puerta',
      'activation-chime',
    ]);
  });

  it('leaves a fixed gap between items', async () => {
    vi.useFakeTimers();
    try {
      const order: string[] = [];
      const queue = createBoardAudioQueue({
        gapMs: 500,
        playActivationChime: () => {
          order.push('a');
          return Promise.resolve();
        },
        playVoice: () => {
          order.push('v');
          return Promise.resolve();
        },
      });

      queue.enqueueActivationChime();
      queue.enqueueActivationChime();

      await vi.advanceTimersByTimeAsync(0);
      expect(order).toEqual(['a']); // second item waits out the gap

      await vi.advanceTimersByTimeAsync(500);
      expect(order).toEqual(['a', 'a']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never throws when a play dep rejects, and keeps draining the rest', async () => {
    const order: string[] = [];
    const queue = createBoardAudioQueue({
      gapMs: 0,
      playActivationChime: () => Promise.reject(new Error('audio device gone')),
      playVoice: (text) => {
        order.push(`voice:${text}`);
        return Promise.resolve();
      },
    });

    expect(() => {
      queue.enqueueActivationChime();
      queue.enqueueVoice('Ana en puerta');
    }).not.toThrow();

    await flush();

    expect(order).toEqual(['voice:Ana en puerta']);
  });

  it('is a no-op (never throws) with no Web Audio / speechSynthesis available', async () => {
    // Default deps, node test env: no `window`, no `AudioContext`, no
    // `speechSynthesis` — every method must still be safe to call.
    const queue = createBoardAudioQueue();
    expect(() => {
      queue.enqueueActivationChime();
      queue.enqueueVoice('Ana llegando');
      queue.enqueueVoice('Beto en puerta', { priority: true });
    }).not.toThrow();
    await tick();
  });
});
