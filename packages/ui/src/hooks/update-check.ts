/** Path of the deploy-id sidecar, served with `no-store` (ADR-094, `buildIdPlugin`). */
export const VERSION_ENDPOINT = '/version.json';

/**
 * Pulls `buildId` out of a parsed `/version.json` body, or `null` when the
 * body is not the `{ buildId: string }` shape — a proxy/error HTML page, a
 * truncated response, or a server old enough to have no such file. A `null`
 * result means "cannot tell", never "up to date".
 */
export function parseDeployedBuildId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const value = (body as Record<string, unknown>).buildId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
