/**
 * Announces a pickup transition through the browser's Web Speech API
 * (ADR-068 point 6). No queue of its own: the browser already serializes
 * `SpeechSynthesisUtterance`s (ADR-069 point 5). Only `arriving`/`arrived`
 * reach this function — `en_route` is too frequent to be useful, and
 * `delivered`/`cancelled` rows already left the board by the time they would
 * be announced (ADR-069 point 5).
 *
 * Guards against a missing `window`/`speechSynthesis` — a test environment,
 * or a kiosk browser without support — so a kiosk running unattended all day
 * never crashes over an unsupported API.
 */
export function announcePickup(row: {
  studentFullName: string;
  status: 'arriving' | 'arrived';
}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const text =
    row.status === 'arriving'
      ? `${row.studentFullName} llegando`
      : `${row.studentFullName} en puerta`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-MX';
  window.speechSynthesis.speak(utterance);
}
