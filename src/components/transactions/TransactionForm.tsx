import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import Modal from "@/components/common/Modal";
import { db } from "@/services/db";
import { todayIso } from "@/lib/utils";
import { useUiStore } from "@/stores/index";
import type { Attachment, Category, CreateSplit, CreateTransaction, Tag, Transaction } from "@/shared/types";

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  transaction?: Transaction | null;
  onSaved: () => void;
}

interface SplitRow {
  category_id: string;
  amount: string;
  memo: string;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function mimeTypeFor(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`;
  if (ext === "pdf") return "application/pdf";
  if (["csv", "txt"].includes(ext)) return "text/plain";
  return undefined;
}

export default function TransactionForm({
  open,
  onClose,
  accountId,
  transaction,
  onSaved,
}: TransactionFormProps) {
  const [date, setDate] = useState(todayIso());
  const [payeeName, setPayeeName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [cleared, setCleared] = useState(false);
  const [useSplits, setUseSplits] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([{ category_id: "", amount: "", memo: "" }]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setHasUnsavedChanges = useUiStore((s) => s.setHasUnsavedChanges);
  const addToast = useUiStore((s) => s.addToast);

  useEffect(() => {
    if (!open) {
      setHasUnsavedChanges(false);
      return;
    }
    const dirty =
      payeeName.trim() !== "" ||
      amount.trim() !== "" ||
      memo.trim() !== "" ||
      categoryId !== "" ||
      useSplits;
    setHasUnsavedChanges(dirty);
  }, [open, payeeName, amount, memo, categoryId, useSplits, setHasUnsavedChanges]);

  useEffect(() => {
    if (!open) return;
    db.listCategories().then(setCategories).catch(() => {});
    db.listTags().then(setTags).catch(() => {});
  }, [open]);

  const loadAttachments = async (transactionId: string) => {
    setAttachmentsLoading(true);
    try {
      setAttachments(await db.listAttachments(transactionId));
    } catch {
      setAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setDate(transaction.date);
      setPayeeName(transaction.payee_name ?? "");
      setCategoryId(transaction.category_id ?? "");
      setAmount(String(transaction.amount));
      setMemo(transaction.memo ?? "");
      setCleared(transaction.cleared);
      if (transaction.splits.length > 0) {
        setUseSplits(true);
        setSplits(
          transaction.splits.map((s) => ({
            category_id: s.category_id ?? "",
            amount: String(s.amount),
            memo: s.memo ?? "",
          })),
        );
      } else {
        setUseSplits(false);
        setSplits([{ category_id: "", amount: "", memo: "" }]);
      }
      setSelectedTagIds(transaction.tags);
      void loadAttachments(transaction.id);
    } else {
      setDate(todayIso());
      setPayeeName("");
      setCategoryId("");
      setAmount("");
      setMemo("");
      setCleared(false);
      setUseSplits(false);
      setSplits([{ category_id: "", amount: "", memo: "" }]);
      setSelectedTagIds([]);
      setAttachments([]);
    }
    setError("");
  }, [open, transaction]);

  const buildInput = (): CreateTransaction => {
    const parsedAmount = parseFloat(amount) || 0;
    const splitData: CreateSplit[] = useSplits
      ? splits
          .filter((s) => s.amount)
          .map((s) => ({
            category_id: s.category_id || undefined,
            amount: parseFloat(s.amount) || 0,
            memo: s.memo || undefined,
          }))
      : [];

    return {
      account_id: accountId,
      date,
      payee_name: payeeName || undefined,
      category_id: useSplits ? undefined : categoryId || undefined,
      amount: parsedAmount,
      memo: memo || undefined,
      cleared,
      splits: splitData,
      tag_ids: selectedTagIds,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount === 0) {
      setError("Amount is required and cannot be zero");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const input = buildInput();
      if (transaction) {
        await db.updateTransaction(transaction.id, input);
      } else {
        await db.createTransaction(input);
      }
      onSaved();
      setHasUnsavedChanges(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const addAttachment = async () => {
    if (!transaction) return;
    const selected = await openDialog({
      multiple: true,
      filters: [
        { name: "Receipts and documents", extensions: ["pdf", "png", "jpg", "jpeg", "webp", "csv", "txt"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (paths.length === 0) return;

    try {
      for (const path of paths) {
        await db.addAttachment(transaction.id, path, mimeTypeFor(path));
      }
      await loadAttachments(transaction.id);
      addToast("success", paths.length === 1 ? "Attachment added" : `${paths.length} attachments added`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to add attachment");
    }
  };

  const removeAttachment = async (attachment: Attachment) => {
    if (!transaction) return;
    try {
      await db.deleteAttachment(attachment.id);
      await loadAttachments(transaction.id);
      addToast("success", "Attachment removed");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to remove attachment");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? "Edit Transaction" : "New Transaction"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            type="submit"
            form="transaction-form"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="tx-date" className="mb-1 block text-sm font-medium">Date</label>
            <input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="tx-amount" className="mb-1 block text-sm font-medium">Amount</label>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Negative for expenses"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label htmlFor="tx-payee" className="mb-1 block text-sm font-medium">Payee</label>
          <input
            id="tx-payee"
            type="text"
            value={payeeName}
            onChange={(e) => setPayeeName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="use-splits"
            checked={useSplits}
            onChange={(e) => setUseSplits(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="use-splits" className="text-sm">Split transaction</label>
        </div>

        {!useSplits ? (
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Splits</label>
            {splits.map((split, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={split.category_id}
                  onChange={(e) => {
                    const next = [...splits];
                    next[i] = { ...next[i], category_id: e.target.value };
                    setSplits(next);
                  }}
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={split.amount}
                  onChange={(e) => {
                    const next = [...splits];
                    next[i] = { ...next[i], amount: e.target.value };
                    setSplits(next);
                  }}
                  placeholder="Amount"
                  className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setSplits(splits.filter((_, j) => j !== i))}
                  className="text-destructive text-sm"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSplits([...splits, { category_id: "", amount: "", memo: "" }])}
              className="text-sm text-primary hover:underline"
            >
              + Add split
            </button>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Memo</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {tags.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    selectedTagIds.includes(tag.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  style={tag.color ? { borderColor: tag.color } : undefined}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Attachments</p>
              <p className="text-xs text-muted-foreground">
                Receipts, invoices, statements, or other files linked to this transaction.
              </p>
            </div>
            <button
              type="button"
              onClick={addAttachment}
              disabled={!transaction}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Attach file
            </button>
          </div>
          {!transaction ? (
            <p className="text-xs text-muted-foreground">Save the transaction before adding attachments.</p>
          ) : attachmentsLoading ? (
            <p className="text-xs text-muted-foreground">Loading attachments…</p>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attachments yet.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center justify-between gap-3 rounded border border-border px-2 py-1.5 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{fileName(attachment.file_path)}</p>
                    <p className="truncate text-muted-foreground">{attachment.file_path}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => openPath(attachment.file_path)} className="text-primary hover:underline">
                      Open
                    </button>
                    <button type="button" onClick={() => revealItemInDir(attachment.file_path)} className="text-primary hover:underline">
                      Show
                    </button>
                    <button type="button" onClick={() => removeAttachment(attachment)} className="text-destructive hover:underline">
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cleared} onChange={(e) => setCleared(e.target.checked)} className="rounded" />
          Cleared
        </label>
      </form>
    </Modal>
  );
}
