import { create } from "zustand";
import type { ConfirmState, Theme, Toast, UpdateDialogPhase } from "@/shared/types";

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  toasts: Toast[];
  confirm: ConfirmState;
  loading: boolean;
  hasUnsavedChanges: boolean;
  showUpdateDialog: boolean;
  updatePhase: UpdateDialogPhase;
  updateMessage: string;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  addToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  hideConfirm: () => void;
  setLoading: (loading: boolean) => void;
  setHasUnsavedChanges: (dirty: boolean) => void;
  openUpdateDialog: () => void;
  closeUpdateDialog: () => void;
  setUpdateDialog: (update: { phase: UpdateDialogPhase; message: string }) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: "system",
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  toasts: [],
  confirm: { open: false, title: "", message: "" },
  loading: false,
  hasUnsavedChanges: false,
  showUpdateDialog: false,
  updatePhase: "idle",
  updateMessage: "",
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.classList.toggle("dark", theme === "dark");
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  addToast: (type, message) =>
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID(), type, message }],
    })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  showConfirm: (title, message, onConfirm) =>
    set({ confirm: { open: true, title, message, onConfirm } }),
  hideConfirm: () => set({ confirm: { open: false, title: "", message: "" } }),
  setLoading: (loading) => set({ loading }),
  setHasUnsavedChanges: (hasUnsavedChanges) => set({ hasUnsavedChanges }),
  openUpdateDialog: () =>
    set({
      showUpdateDialog: true,
      updatePhase: "checking",
      updateMessage: "Checking for updates…",
    }),
  closeUpdateDialog: () =>
    set({
      showUpdateDialog: false,
      updatePhase: "idle",
      updateMessage: "",
    }),
  setUpdateDialog: ({ phase, message }) => set({ updatePhase: phase, updateMessage: message }),
}));

interface SecurityState {
  hasMasterPassword: boolean;
  isLocked: boolean;
  privacyMode: boolean;
  lastActivity: number;
  setHasMasterPassword: (v: boolean) => void;
  setLocked: (v: boolean) => void;
  setPrivacyMode: (v: boolean) => void;
  touchActivity: () => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  hasMasterPassword: false,
  isLocked: false,
  privacyMode: false,
  lastActivity: Date.now(),
  setHasMasterPassword: (v) => set({ hasMasterPassword: v }),
  setLocked: (v) => set({ isLocked: v }),
  setPrivacyMode: (v) => set({ privacyMode: v }),
  touchActivity: () => set({ lastActivity: Date.now() }),
}));

interface DataState {
  initialized: boolean;
  hasAccounts: boolean;
  settings: Record<string, string>;
  setInitialized: (v: boolean, hasAccounts: boolean) => void;
  setSettings: (settings: Record<string, string>) => void;
  updateSetting: (key: string, value: string) => void;
}

export const useDataStore = create<DataState>((set) => ({
  initialized: false,
  hasAccounts: false,
  settings: {},
  setInitialized: (initialized, hasAccounts) => set({ initialized, hasAccounts }),
  setSettings: (settings) => set({ settings }),
  updateSetting: (key, value) =>
    set((s) => ({ settings: { ...s.settings, [key]: value } })),
}));
