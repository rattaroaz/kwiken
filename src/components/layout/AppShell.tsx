import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import LogPanel from "@/components/logs/LogPanel";
import PrivacyToggle from "@/components/security/PrivacyToggle";
import { useUiStore } from "@/stores/index";
import { useSecurityStore } from "@/stores/index";

export default function AppShell() {
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const navigate = useNavigate();
  const touchActivity = useSecurityStore((s) => s.touchActivity);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openCommandPalette();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        navigate("/accounts");
      }
      touchActivity();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCommandPalette, navigate, touchActivity]);

  return (
    <div className="flex h-full">
      <Sidebar />
      <LogPanel />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-border px-4">
          <PrivacyToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
