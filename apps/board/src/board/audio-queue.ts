/**
 * Serialized audio for the institution board (ADR-093).
 *
 * Every sound the board makes goes through one FIFO queue, so two
 * announcements can never overlap or run together without a breath — a real
 * risk at a busy dismissal with dozens of simultaneous pickups, where the
 * browser's own back-to-back `speechSynthesis` serialization is unintelligible.
 *
 * Three item shapes share the queue:
 * - `activation-chime` — a pickup entered `approaching`: one short, soft tone,
 *   no voice, no student name.
 * - `voice` — a spoken announcement (`arriving`/`arrived`, or the manual
 *   "vocear" from the gate console). Always preceded, inside the same queue
 *   item, by a distinct **attention** chime so the two tones are told apart by
 *   ear: activation vs. "listen, an announcement is coming".
 *
 * After each item finishes, a fixed `GAP_MS` pause before the next one starts.
 *
 * The manual announcement (`enqueueVoice(text, { priority: true })`) jumps to
 * the front of the waiting queue — it is explicit and must never sit behind a
 * backlog of automatic announcements — but it does **not** interrupt whatever
 * is already playing (cutting audio mid-word sounds broken). The queue never
 * drops an item; the only ordering exception is this front-insert.
 *
 * Same defensive contract as `tts.ts`: with no `window`, no `AudioContext` and
 * no `speechSynthesis` (a test environment, or a kiosk browser without
 * support), every method is a no-op and nothing ever throws.
 */

/** Fixed pause after each queue item, in ms — the "breathing room" ADR-093 asks for. */
const GAP_MS = 650;

/** Activation tone: soft, mid, non-strident. */
const ACTIVATION_FREQ_HZ = 587.33; // ~D5
const ACTIVATION_DURATION_MS = 220;

/** Attention tone: brighter and clearly distinct from the activation tone by ear. */
const ATTENTION_FREQ_HZ = 987.77; // ~B5
const ATTENTION_DURATION_MS = 160;

const CHIME_PEAK_GAIN = 0.12;

type QueueItem = { kind: 'activation-chime' } | { kind: 'voice'; text: string };

export interface BoardAudioQueueDeps {
  /** Plays one activation chime and resolves when it (audibly) finished. */
  playActivationChime: () => Promise<void>;
  /** Plays the attention chime followed by the spoken text, resolving when done. */
  playVoice: (text: string) => Promise<void>;
  /** Pause inserted after every item. */
  gapMs: number;
}

export interface BoardAudioQueue {
  /** A pickup entered `approaching` — a short chime, no voice. */
  enqueueActivationChime(): void;
  /**
   * A spoken announcement, always preceded by its attention chime.
   * `priority: true` (the manual gate-console "vocear") inserts at the front of
   * the waiting queue without interrupting the item currently playing.
   */
  enqueueVoice(text: string, options?: { priority?: boolean }): void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

type WindowAudioContext = typeof AudioContext;

function resolveAudioContextCtor(): WindowAudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: WindowAudioContext;
    webkitAudioContext?: WindowAudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * A single lazily-created `AudioContext`, shared by every chime — a kiosk open
 * all day must not leak one context per tone. `null` forever when unsupported.
 */
let sharedContext: AudioContext | null = null;
let sharedContextUnavailable = false;

function getAudioContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  if (sharedContextUnavailable) return null;
  const Ctor = resolveAudioContextCtor();
  if (!Ctor) {
    sharedContextUnavailable = true;
    return null;
  }
  try {
    sharedContext = new Ctor();
    return sharedContext;
  } catch {
    sharedContextUnavailable = true;
    return null;
  }
}

function playTone(freqHz: number, durationMs: number): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    try {
      // Autoplay policy: a kiosk is normally interacted with once at setup, but
      // resume() is cheap and harmless if already running.
      if (ctx.state === 'suspended') void ctx.resume();

      const now = ctx.currentTime;
      const durationS = durationMs / 1000;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = freqHz;

      // Short attack/decay ramps so the tone doesn't click on/off.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(CHIME_PEAK_GAIN, now + 0.015);
      gain.gain.linearRampToValueAtTime(0, now + durationS);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.onended = finish;
      oscillator.start(now);
      oscillator.stop(now + durationS);
      // Safety net if `onended` never fires (some engines).
      setTimeout(finish, durationMs + 120);
    } catch {
      finish();
    }
  });
}

function speak(text: string): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  if (typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-MX';
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
      // Safety net: some engines drop `onend` for long queues.
      setTimeout(finish, 15_000);
    } catch {
      finish();
    }
  });
}

const defaultDeps: BoardAudioQueueDeps = {
  playActivationChime: () => playTone(ACTIVATION_FREQ_HZ, ACTIVATION_DURATION_MS),
  playVoice: async (text: string) => {
    await playTone(ATTENTION_FREQ_HZ, ATTENTION_DURATION_MS);
    await speak(text);
  },
  gapMs: GAP_MS,
};

export function createBoardAudioQueue(deps: Partial<BoardAudioQueueDeps> = {}): BoardAudioQueue {
  const { playActivationChime, playVoice, gapMs } = { ...defaultDeps, ...deps };

  const queue: QueueItem[] = [];
  let draining = false;

  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        const item = queue.shift() as QueueItem;
        try {
          if (item.kind === 'activation-chime') {
            await playActivationChime();
          } else {
            await playVoice(item.text);
          }
        } catch {
          // A failed tone/utterance must never stall the queue.
        }
        await delay(gapMs);
      }
    } finally {
      draining = false;
    }
  }

  return {
    enqueueActivationChime() {
      queue.push({ kind: 'activation-chime' });
      void drain();
    },
    enqueueVoice(text: string, options?: { priority?: boolean }) {
      const item: QueueItem = { kind: 'voice', text };
      if (options?.priority) {
        queue.unshift(item);
      } else {
        queue.push(item);
      }
      void drain();
    },
  };
}

/** The board is one kiosk — one queue for the whole screen. */
export const boardAudioQueue: BoardAudioQueue = createBoardAudioQueue();
