/**
 * Postgres `time` columns come back through node-postgres as `HH:MM:SS`, but
 * both `specs/api-contracts/dismissal-windows.md` and
 * `specs/api-contracts/dismissal-exceptions.md` document `HH:mm` in every
 * response, and the write DTOs enforce exactly that with `@IsMilitaryTime()`
 * (which rejects a seconds component). Without this, a client could not send
 * back what it just read. See ADR-053.
 *
 * Only the seconds are dropped — they are always `00` for these columns, which
 * have no sub-minute meaning in the domain.
 */
export function toMilitaryTime(value: string): string {
  return value.slice(0, 5);
}
