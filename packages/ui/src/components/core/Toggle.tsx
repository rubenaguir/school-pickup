export interface ToggleProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
}

/** iOS/Android-style toggle switch, coral when on. */
export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <span
      onClick={() => onChange?.(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 'var(--radius-pill)',
        flexShrink: 0,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background var(--motion-base)',
        background: checked ? 'var(--brand)' : 'var(--border-strong)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--motion-base)',
        }}
      />
    </span>
  );
}
