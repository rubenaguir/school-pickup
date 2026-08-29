export interface AppVersionLabelProps {
  /**
   * The compile-time build id for this bundle — each app passes its own
   * `__APP_BUILD_ID__` (ADR-094); the component never reads that global itself,
   * since its value is specific to each app's bundle.
   */
  buildId: string;
  /**
   * `muted` (default, `--ink-300`) for an in-content footer like the profile
   * screens; `faint` (`--ink-100`) for the board's deliberately near-invisible
   * corner (ADR-096).
   */
  tone?: 'muted' | 'faint';
}

/**
 * Tiny `v{buildId}` label so the running version of any app can be read off the
 * screen instead of guessed from behaviour (ADR-096). Presentation only — no
 * logic, no data fetching.
 */
export function AppVersionLabel({ buildId, tone = 'muted' }: AppVersionLabelProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-2xs)',
        fontWeight: 500,
        letterSpacing: '.01em',
        color: tone === 'faint' ? 'var(--ink-100)' : 'var(--ink-300)',
      }}
    >
      v{buildId}
    </span>
  );
}
