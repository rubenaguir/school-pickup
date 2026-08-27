/**
 * Builds the spoken line for a pickup announcement (ADR-068 point 6). Only
 * `arriving`/`arrived` are ever voiced — `en_route`/`approaching` are not
 * (`approaching` gets a wordless chime instead, ADR-093), and
 * `delivered`/`cancelled` rows already left the board by the time they would be
 * announced (ADR-069 point 5).
 *
 * Pure: the actual speaking, its serialization, and the guards against a
 * missing `speechSynthesis` all live in `audio-queue.ts` now — every sound the
 * board makes goes through that one queue (ADR-093), never straight to
 * `speechSynthesis.speak`.
 */
export function pickupAnnouncementText(row: {
  studentFullName: string;
  status: 'arriving' | 'arrived';
}): string {
  return row.status === 'arriving'
    ? `${row.studentFullName} llegando`
    : `${row.studentFullName} en puerta`;
}
