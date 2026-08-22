import pinMark from '../../assets/pin-mark-inverse.svg';

const BULLETS = [
  'El tutor avisa que va en camino',
  'ETA en vivo para la institución',
  'Tablero de llegadas claro y a distancia',
];

const CHECK = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--brand)"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/**
 * Responsive rules for `BrandPanel` and the 1180px access-screen shell that
 * hosts it (`Login`/`VerifyEmail`/`AcceptInvitation` in `apps/parent` and
 * `apps/portal`, ADR-081). Injected once from `BrandPanel` itself — a `style`
 * tag applies to the whole document regardless of where it's mounted in the
 * tree, so the 6 screens only need to add `cll-auth-shell`/`cll-auth-content`
 * classNames to their own container divs, no separate style tag per screen
 * (ADR-086). Same `@media (max-width: 767px)` breakpoint as `TutorShell`.
 *
 * Below the breakpoint, `.cll-auth-shell` stacks to a column and
 * `.cll-auth-content` drops its `flex: 1` (set inline in every screen) for
 * `width: 100%` — `!important` is required there since a class alone can't
 * outrank an inline style, same trick `TutorShell` already uses for its own
 * breakpoint. `BrandPanel`'s own size-affecting properties (width, padding,
 * font sizes, gaps) live only in this stylesheet, never inline, so the
 * override needs no `!important`.
 */
const RESPONSIVE_STYLE = `
.cll-brand-panel {
  width: 470px;
  flex-shrink: 0;
  padding: 38px 40px;
}
.cll-brand-panel-logo-mark { width: 29px; height: 34px; }
.cll-brand-panel-logo-text { font-size: 22px; }
.cll-brand-panel-headline { font-size: 38px; line-height: 1.08; }
.cll-brand-panel-tagline { font-size: 16px; margin-top: 16px; }
.cll-brand-panel-bullets { gap: 13px; }
.cll-brand-panel-bullet { font-size: 14px; gap: 11px; }
.cll-brand-panel-bullet-icon { width: 22px; height: 22px; }

@media (max-width: 767px) {
  .cll-auth-shell { flex-direction: column; min-height: 0 !important; }
  .cll-auth-content {
    flex: none !important;
    width: 100%;
    padding: 32px 24px !important;
    box-sizing: border-box;
  }

  .cll-brand-panel {
    width: 100%;
    height: 176px;
    padding: 16px 20px;
    box-sizing: border-box;
  }
  .cll-brand-panel-logo-mark { width: 20px; height: 23px; }
  .cll-brand-panel-logo-text { font-size: 15px; }
  .cll-brand-panel-headline { font-size: 17px; line-height: 1.15; }
  .cll-brand-panel-tagline {
    font-size: 11px;
    margin-top: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cll-brand-panel-bullets { gap: 3px; }
  .cll-brand-panel-bullet { font-size: 10px; gap: 6px; }
  .cll-brand-panel-bullet-icon { width: 14px; height: 14px; }
}
`;

/** Left half of the access screen. Ported from `ui_kits/acceso` in the design project. */
export function BrandPanel() {
  return (
    <div
      className="cll-brand-panel"
      style={{
        background: 'var(--ink-900)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <style>{RESPONSIVE_STYLE}</style>

      <svg
        viewBox="0 0 470 740"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g stroke="rgba(255,255,255,.06)" strokeWidth="1.5" fill="none">
          <path d="M-20 180 H 520" />
          <path d="M-20 380 H 520" />
          <path d="M-20 560 H 520" />
          <path d="M120 -20 V 780" />
          <path d="M320 -20 V 780" />
        </g>
        <path
          d="M70 640 V 380 H 320 V 150 H 470"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".55"
          strokeDasharray="3 10"
        />
        <circle cx="70" cy="640" r="6" fill="var(--brand)" opacity=".7" />
        <circle cx="320" cy="380" r="7" fill="var(--brand)" opacity=".8" />
        <circle cx="320" cy="150" r="6" fill="#34D399" opacity=".7" />
      </svg>

      <div
        style={{
          position: 'absolute',
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(251,106,69,.22),transparent 70%)',
          top: -120,
          right: -120,
        }}
      />

      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <img src={pinMark} alt="" className="cll-brand-panel-logo-mark" />
        <span
          className="cll-brand-panel-logo-text"
          style={{ fontWeight: 800, letterSpacing: '-.02em' }}
        >
          Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
        </span>
      </span>

      <div style={{ position: 'relative' }}>
        <div
          className="cll-brand-panel-headline"
          style={{ fontWeight: 800, letterSpacing: '-.03em' }}
        >
          Menos fila.
          <br />
          Más{' '}
          <span
            style={{
              background: 'linear-gradient(120deg,#FFB088,var(--brand))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            calma
          </span>{' '}
          a la salida.
        </div>
        <div
          className="cll-brand-panel-tagline"
          style={{
            color: 'rgba(255,255,255,.6)',
            fontWeight: 500,
            lineHeight: 1.5,
            maxWidth: 340,
          }}
        >
          La plataforma que coordina la recogida entre familias e instituciones, sin congestionar la
          puerta.
        </div>
      </div>

      <div
        className="cll-brand-panel-bullets"
        style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
        aria-hidden="true"
      >
        {BULLETS.map((bullet) => (
          <span
            key={bullet}
            className="cll-brand-panel-bullet"
            style={{
              display: 'flex',
              alignItems: 'center',
              color: 'rgba(255,255,255,.78)',
              fontWeight: 500,
            }}
          >
            <span
              className="cll-brand-panel-bullet-icon"
              style={{
                borderRadius: '50%',
                background: 'rgba(251,106,69,.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {CHECK}
            </span>
            {bullet}
          </span>
        ))}
      </div>
    </div>
  );
}
