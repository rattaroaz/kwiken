import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/stores/index";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  path: string;
  keywords: string;
}

const COMMANDS: CommandItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", keywords: "home overview" },
  { id: "accounts", label: "Accounts", path: "/accounts", keywords: "bank checking savings" },
  { id: "categories", label: "Categories", path: "/categories", keywords: "tags organize" },
  { id: "budgets", label: "Budgets", path: "/budgets", keywords: "spending limits" },
  { id: "reports", label: "Reports", path: "/reports", keywords: "charts analytics" },
  { id: "import", label: "Import / Export", path: "/import-export", keywords: "csv qif ofx backup" },
  { id: "advanced", label: "Advanced", path: "/advanced", keywords: "recurring templates loans" },
  { id: "settings", label: "Settings", path: "/settings", keywords: "preferences config" },
];

export default function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const closeCommandPalette = useUiStore((s) => s.closeCommandPalette);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const select = (item: CommandItem) => {
    navigate(item.path);
    closeCommandPalette();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && filtered[selected]) {
      e.preventDefault();
      select(filtered[selected]);
    } else if (e.key === "Escape") {
      closeCommandPalette();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeCommandPalette} />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages…"
            autoFocus
            className="flex-1 bg-transparent py-3 text-sm outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Esc</kbd>
        </div>
        <ul className="max-h-64 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">No results</li>
          ) : (
            filtered.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => select(item)}
                  className={cn(
                    "flex w-full items-center px-4 py-2.5 text-left text-sm",
                    i === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
