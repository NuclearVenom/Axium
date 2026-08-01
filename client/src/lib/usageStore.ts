import { useSyncExternalStore } from "react";

export interface UsageState {
  session: { graphRequests: number; aiRequests: number };
  lifetime: { graphRequests: number; aiRequests: number; totalCalls: number } | null;
}

let state: UsageState = {
  session: { graphRequests: 0, aiRequests: 0 },
  lifetime: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useUsageStats() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export async function refreshLifetimeUsage() {
  try {
    const res = await fetch("/api/usage");
    if (!res.ok) return;
    const data = await res.json();
    state = { ...state, lifetime: data };
    emit();
  } catch {
    // Usage stats are decorative — never let a failure here affect the app.
  }
}

export function recordSessionGraphRequest() {
  state = { ...state, session: { ...state.session, graphRequests: state.session.graphRequests + 1 } };
  emit();
  refreshLifetimeUsage();
}

export function recordSessionAIRequest() {
  state = { ...state, session: { ...state.session, aiRequests: state.session.aiRequests + 1 } };
  emit();
  refreshLifetimeUsage();
}
