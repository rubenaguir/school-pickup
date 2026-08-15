import { useEffect, useState } from 'react';

export interface ClockValue {
  now: number;
  /** `HH:mm:ss`, 24h, `es-MX` (.claude/rules/design-system.md). */
  clock: string;
  /** e.g. "Viernes 14 de agosto", capitalized. */
  dateText: string;
}

/**
 * Ambient clock for the gate console's top bar (ADR-073 point 5). A second
 * copy of `apps/board/src/board/useClock.ts` rather than a promotion to
 * `packages/shared`: that package carries no React dependency (it is also
 * consumed by the NestJS `api`/`worker` processes), and a `useState`/
 * `useEffect` hook would be the first thing to force one in. Two five-line
 * copies are cheaper than that coupling.
 */
export function useClock(): ClockValue {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const clock = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(now));

  let dateText = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(now));
  dateText = dateText.charAt(0).toUpperCase() + dateText.slice(1);

  return { now, clock, dateText };
}
