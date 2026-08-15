import { useEffect, useState } from 'react';

export interface ClockValue {
  now: number;
  /** `HH:mm:ss`, 24h, `es-MX` (ADR-071, enmienda a ADR-069 punto 9). */
  clock: string;
  /** e.g. "Viernes 14 de agosto", capitalized. */
  dateText: string;
}

/**
 * Ambient clock for the board, `setInterval` of 1s, no server dependency —
 * same criterion as ADR-069 point 9, corrected to `HH:mm:ss` + full date per
 * the real kit (ADR-071).
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
