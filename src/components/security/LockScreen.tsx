import { useState } from "react";
import { db } from "@/services/db";
import { APP_NAME } from "@/lib/constants";
import { useSecurityStore, useUiStore } from "@/stores/index";

export default function LockScreen() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setLocked = useSecurityStore((s) => s.setLocked);
  const addToast = useUiStore((s) => s.addToast);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const ok = await db.unlockApp(password);
      if (ok) {
        setLocked(false);
        setPassword("");
        addToast("success", "App unlocked");
      } else {
        addToast("error", "Incorrect password");
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-card-foreground">{APP_NAME} is locked</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your master password to continue</p>
        </div>
        <form onSubmit={handleUnlock} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master password"
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
