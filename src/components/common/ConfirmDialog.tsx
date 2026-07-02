import { useUiStore } from "@/stores/index";
import Modal from "./Modal";

export default function ConfirmDialog() {
  const confirm = useUiStore((s) => s.confirm);
  const hideConfirm = useUiStore((s) => s.hideConfirm);

  const handleConfirm = () => {
    confirm.onConfirm?.();
    hideConfirm();
  };

  return (
    <Modal
      open={confirm.open}
      onClose={hideConfirm}
      title={confirm.title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={hideConfirm}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
          >
            Confirm
          </button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">{confirm.message}</p>
    </Modal>
  );
}
