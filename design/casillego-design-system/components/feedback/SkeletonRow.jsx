import React from 'react';

/** Shimmering skeleton row — mirrors real list-row structure, never a full-screen spinner. */
export function SkeletonRow() {
  const sk = { background: 'linear-gradient(90deg,#EEF2F7 25%,#E2E9F0 37%,#EEF2F7 63%)', backgroundSize: '720px 100%', animation: 'clg-shimmer 1.3s linear infinite', borderRadius: 7 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 24px', borderBottom: '1px solid var(--border-hairline-2)' }}>
      <style>{'@keyframes clg-shimmer{0%{background-position:-360px 0}100%{background-position:360px 0}}'}</style>
      <span style={{ ...sk, width: 42, height: 42, borderRadius: '50%', flexShrink: 0 }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <span style={{ ...sk, height: 13, width: '58%' }} />
        <span style={{ ...sk, height: 11, width: '40%' }} />
      </span>
      <span style={{ ...sk, height: 26, width: 84, borderRadius: 999, flexShrink: 0 }} />
    </div>
  );
}
