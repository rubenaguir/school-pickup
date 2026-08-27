import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';

/** Name of the deploy-id sidecar, at the web root of every app. */
const VERSION_FILE = 'version.json';

/**
 * Short, opaque identifier for the current build: the git commit when the
 * build runs inside a checkout, a timestamp otherwise (CI tarball, exported
 * source). Only ever compared for equality — never parsed.
 */
export function resolveBuildId(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (sha) return sha;
  } catch {
    // Not a git checkout (or git unavailable) — fall through to the timestamp.
  }
  return `ts-${Date.now()}`;
}

/**
 * ADR-094: one plugin for `parent`, `portal` and `board` so the three cannot
 * drift. It does two things with a single build id:
 *
 * 1. Injects it as the compile-time constant `__APP_BUILD_ID__` (the value the
 *    running tab compares against).
 * 2. Serves / emits `/version.json` (`{ "buildId": "..." }`) — the value a
 *    freshly deployed server reports. Dev serves it from memory with
 *    `no-store`; `vite build` writes it into the output root. nginx must send
 *    `Cache-Control: no-store` for this one file in production (outside this
 *    repo, noted in the ADR) — every other asset is content-hashed and may be
 *    cached hard.
 */
export function buildIdPlugin(): Plugin {
  const buildId = resolveBuildId();
  const body = `${JSON.stringify({ buildId })}\n`;

  return {
    name: 'casillego:build-id',
    config() {
      return { define: { __APP_BUILD_ID__: JSON.stringify(buildId) } };
    },
    configureServer(server) {
      server.middlewares.use(`/${VERSION_FILE}`, (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: VERSION_FILE, source: body });
    },
  };
}
