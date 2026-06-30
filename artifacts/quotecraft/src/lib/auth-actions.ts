// A gated action the user triggered while signed out. Persisted across the Clerk
// auth round-trip so we can auto-resume it after verification (Iteration 3 §3.3).
export type PendingAction = "save" | "download" | "email";

const KEY = "quotecraft:pending-action";

export function setPendingAction(action: PendingAction): void {
  try {
    sessionStorage.setItem(KEY, action);
  } catch {
    /* storage unavailable */
  }
}

export function peekPendingAction(): PendingAction | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "save" || v === "download" || v === "email" ? v : null;
  } catch {
    return null;
  }
}

export function takePendingAction(): PendingAction | null {
  const v = peekPendingAction();
  clearPendingAction();
  return v;
}

export function clearPendingAction(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
