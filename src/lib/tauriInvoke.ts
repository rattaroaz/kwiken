import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Serialize all Tauri IPC through one chain. Concurrent invoke() calls have
 * stalled the WebView2 bridge on Windows during startup.
 */
let ipcChain: Promise<void> = Promise.resolve();

type TauriInternals = {
  invoke: typeof tauriInvoke;
};

function getInternals(): TauriInternals | undefined {
  return (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
}

/** True when running inside a Tauri webview (not a plain browser tab). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && !!getInternals()?.invoke;
}

function isTestOrE2E(): boolean {
  return import.meta.env.MODE === "test" || import.meta.env.VITE_E2E === "true";
}

/**
 * Wait briefly for the Tauri IPC bridge. Needed if the page evaluates before
 * injection finishes, and to fail clearly when opened in a normal browser.
 * Skipped in Vitest / E2E mocks (they stub `@tauri-apps/api/core` instead).
 */
export async function waitForTauri(timeoutMs = 3000): Promise<void> {
  if (isTestOrE2E() || isTauriRuntime()) return;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
    if (isTauriRuntime()) return;
  }
  throw new Error(
    "Tauri bridge missing (window.__TAURI_INTERNALS__). Open the Kwiken desktop window from `npm run tauri dev` — not a browser tab at http://localhost:1420.",
  );
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTestOrE2E()) {
    await waitForTauri();
  }
  const run = ipcChain.then(
    () => tauriInvoke<T>(cmd, args),
    () => tauriInvoke<T>(cmd, args),
  );
  ipcChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
