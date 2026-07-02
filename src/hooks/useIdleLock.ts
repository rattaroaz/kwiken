import { useEffect } from "react";
import { useDataStore, useSecurityStore } from "@/stores/index";
import { db } from "@/services/db";
import { logger } from "@/lib/logger";

export function useIdleLock() {
  const settings = useDataStore((s) => s.settings);
  const hasMasterPassword = useSecurityStore((s) => s.hasMasterPassword);
  const isLocked = useSecurityStore((s) => s.isLocked);
  const lastActivity = useSecurityStore((s) => s.lastActivity);
  const setLocked = useSecurityStore((s) => s.setLocked);
  const touchActivity = useSecurityStore((s) => s.touchActivity);

  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    const handler = () => touchActivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [touchActivity]);

  useEffect(() => {
    if (!hasMasterPassword || isLocked) return;

    const minutes = parseInt(settings.auto_lock_minutes ?? "15", 10);
    if (!minutes || minutes <= 0) return;

    const timeoutMs = minutes * 60 * 1000;
    const timer = setInterval(() => {
      if (Date.now() - lastActivity >= timeoutMs) {
        db.lockApp()
          .then(() => {
            logger.security.info("App auto-locked after idle timeout", { minutes });
            setLocked(true);
          })
          .catch(() => setLocked(true));
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [hasMasterPassword, isLocked, lastActivity, settings.auto_lock_minutes, setLocked]);
}
