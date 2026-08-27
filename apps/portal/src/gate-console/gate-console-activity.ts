import { useSyncExternalStore } from 'react';

/**
 * Whether `GateConsole` currently has a delivery confirmation in flight
 * (`queue.busyId !== null`). A module singleton rather than context: the
 * console is a single screen with one writer, and the reader — the app-level
 * update banner (ADR-094) — sits above the router, out of reach of a provider
 * mounted inside a route.
 */
let confirming = false;
const listeners = new Set<() => void>();

export function setGateConsoleConfirming(next: boolean): void {
  if (confirming === next) return;
  confirming = next;
  for (const listener of listeners) listener();
}

function getSnapshot(): boolean {
  return confirming;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reactive read of {@link setGateConsoleConfirming}'s current value. */
export function useGateConsoleConfirming(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
