import { useState } from "react";
import { APP_VERSION } from "@/lib/constants";
import { checkForUpdatesAndApply } from "@/services/updateService";
import { cn } from "@/lib/utils";

interface HelpMenuProps {
  collapsed?: boolean;
}

export default function HelpMenu({ collapsed = false }: HelpMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative border-t border-border p-2">
      <button
        type="button"
        data-testid="menu-help"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-muted",
          collapsed && "justify-center px-2",
        )}
      >
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {!collapsed && <span>Help</span>}
      </button>

      {open && (
        <div
          className={cn(
            "absolute bottom-full left-2 right-2 mb-1 rounded-md border border-border bg-card shadow-lg",
            collapsed && "left-auto right-0 w-56",
          )}
        >
          <button
            type="button"
            data-testid="menu-check-updates"
            onClick={() => {
              setOpen(false);
              void checkForUpdatesAndApply();
            }}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
          >
            Check for updates
          </button>
          <div
            data-testid="menu-help-version"
            className="border-t border-border px-4 py-2 text-xs text-muted-foreground"
          >
            Version {APP_VERSION}
          </div>
        </div>
      )}
    </div>
  );
}
