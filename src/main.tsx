import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  // StrictMode double-mounts effects and was overlapping Tauri invoke() chains
  // on Windows (stuck init / "invoke" failures). Re-enable once startup is hardened.
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
