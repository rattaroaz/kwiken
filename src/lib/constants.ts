import pkg from "../../package.json";

export const APP_NAME = "Kwiken";
export const APP_VERSION = pkg.version;

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit_card", label: "Credit Card" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
  { value: "cash", label: "Cash" },
] as const;

export const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

export const DEFAULT_SETTINGS = {
  currency: "USD",
  date_format: "MM/dd/yyyy",
  fiscal_year_start: "01",
  theme: "system",
  default_account_id: "",
  backup_path: "",
  auto_backup_frequency: "never",
  auto_lock_minutes: "15",
  privacy_mode: "false",
  books_closed_year: "",
  save_logs_to_disk: "true",
} as const;
