import pinMark from '../assets/pin-mark-inverse.svg';

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

/** Left half of the access screen. Ported from `ui_kits/acceso` in the design project. */
export function BrandPanel() {
  return (
    <div
      style={{
        width: 470,
        flexShrink: 0,
        background: 'var(--ink-900)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '38px 40px',
      }}
    >
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
        <img src={pinMark} width={29} height={34} alt="" />
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>
          Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
        </span>
      </span>

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.08 }}>
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
          style={{
            fontSize: 16,
            color: 'rgba(255,255,255,.6)',
            fontWeight: 500,
            lineHeight: 1.5,
            marginTop: 16,
            maxWidth: 340,
          }}
        >
          La plataforma que coordina la recogida entre familias e instituciones, sin congestionar la
          puerta.
        </div>
      </div>

      <div
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 13 }}
        aria-hidden="true"
      >
        {BULLETS.map((bullet) => (
          <span
            key={bullet}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              fontSize: 14,
              color: 'rgba(255,255,255,.78)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
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
