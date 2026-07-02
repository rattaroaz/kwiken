import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { isVersionNewer } from "@/lib/semver";
import { logger } from "@/lib/logger";
import { useUiStore } from "@/stores/index";

const UPDATE_FEED_UNAVAILABLE_MESSAGE = `No update feed is published yet.

To enable updates for ${APP_NAME}:
1. Push a GitHub Release with tag vX.Y.Z
2. Ensure the release workflow uploads latest.json and signed installers
3. Set GitHub secrets TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD
4. Update plugins.updater.endpoints in tauri.conf.json if your repo differs from kimri/kwiken`;

function upToDateMessage(): string {
  return `${APP_NAME} ${APP_VERSION} is up to date.`;
}

function isFeedUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not fetch a valid release json") ||
    lower.includes("failed to fetch") ||
    lower.includes("404") ||
    lower.includes("not found")
  );
}

async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  const { hasUnsavedChanges } = useUiStore.getState();
  if (!hasUnsavedChanges) return true;

  const confirmed = await ask(
    "You have unsaved changes. Discard them and install the update?",
    { title: "Unsaved changes", kind: "warning", okLabel: "Discard and update", cancelLabel: "Cancel" },
  );
  if (!confirmed) {
    logger.update.info("Update cancelled — unsaved changes", { userAction: "check_for_updates" });
  }
  return confirmed;
}

export async function checkForUpdatesAndApply(): Promise<void> {
  const { openUpdateDialog, closeUpdateDialog, setUpdateDialog } = useUiStore.getState();

  if (import.meta.env.VITE_E2E === "true") {
    openUpdateDialog();
    setUpdateDialog({ phase: "up_to_date", message: upToDateMessage() });
    logger.update.info("E2E bypass — up to date", { installedVersion: APP_VERSION });
    return;
  }

  openUpdateDialog();
  logger.update.info("Check for updates started", {
    userAction: "check_for_updates",
    installedVersion: APP_VERSION,
  });

  try {
    const update = await check({ allowDowngrades: false });

    if (!update || !isVersionNewer(update.version, APP_VERSION)) {
      const remoteVersion = update?.version ?? APP_VERSION;
      setUpdateDialog({ phase: "up_to_date", message: upToDateMessage() });
      logger.update.info("Up to date", { installedVersion: APP_VERSION, remoteVersion });
      return;
    }

    logger.update.info("Update available", {
      installedVersion: APP_VERSION,
      remoteVersion: update.version,
    });

    const proceed = await confirmDiscardUnsavedChanges();
    if (!proceed) {
      closeUpdateDialog();
      return;
    }

    setUpdateDialog({
      phase: "downloading",
      message: `Downloading ${APP_NAME} ${update.version}…`,
    });
    logger.update.info("Download started", { userAction: "download_update", version: update.version });

    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        logger.update.info("Download event: started", { contentLength: event.data.contentLength });
      } else if (event.event === "Finished") {
        logger.update.info("Download event: finished");
      }
    });

    setUpdateDialog({ phase: "installing", message: "Installing update and restarting…" });
    logger.update.info("Install and relaunch", { userAction: "install_update", version: update.version });
    await relaunch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isFeedUnavailableError(message)) {
      setUpdateDialog({ phase: "error", message: UPDATE_FEED_UNAVAILABLE_MESSAGE });
      logger.update.info("Update feed not published", { errorId: "feed_unavailable" });
    } else {
      setUpdateDialog({ phase: "error", message });
      logger.update.error("Update check failed", { errorId: "update_error", error: message });
    }
  }
}
