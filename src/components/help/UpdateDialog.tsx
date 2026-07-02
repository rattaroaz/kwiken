import Modal from "@/components/common/Modal";
import { useUiStore } from "@/stores/index";
import type { UpdateDialogPhase } from "@/shared/types";

const phaseTitles: Record<UpdateDialogPhase, string> = {
  idle: "Updates",
  checking: "Checking for updates",
  up_to_date: "Up to date",
  downloading: "Downloading update",
  installing: "Installing update",
  error: "Update error",
};

export default function UpdateDialog() {
  const showUpdateDialog = useUiStore((s) => s.showUpdateDialog);
  const updatePhase = useUiStore((s) => s.updatePhase);
  const updateMessage = useUiStore((s) => s.updateMessage);
  const closeUpdateDialog = useUiStore((s) => s.closeUpdateDialog);

  const busy = updatePhase === "checking" || updatePhase === "downloading" || updatePhase === "installing";
  const title = phaseTitles[updatePhase] ?? "Updates";

  return (
    <Modal
      open={showUpdateDialog}
      onClose={busy ? () => {} : closeUpdateDialog}
      title={title}
      size="md"
      hideCloseButton={busy}
      footer={
        !busy ? (
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="update-dialog-close"
              onClick={closeUpdateDialog}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Close
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Please wait…</p>
        )
      }
    >
      <p className="whitespace-pre-wrap text-sm text-card-foreground">{updateMessage}</p>
    </Modal>
  );
}
