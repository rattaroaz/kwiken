import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionForm from "./TransactionForm";
import { useUiStore } from "@/stores/index";

const mocks = vi.hoisted(() => ({
  listCategories: vi.fn(async () => [
    {
      id: "cat-1",
      name: "Groceries",
      parent_id: null,
      category_type: "expense",
      is_tax_related: false,
    },
  ]),
  listTags: vi.fn(async () => []),
  createTransaction: vi.fn(async () => ({
    id: "tx-new",
    account_id: "acct-1",
    date: "2026-01-02",
    amount: -25,
    cleared: false,
    reconciled: false,
    splits: [],
    tags: [],
  })),
  updateTransaction: vi.fn(async () => ({})),
  listAttachments: vi.fn(async () => [
    {
      id: "att-1",
      transaction_id: "tx-1",
      file_path: "C:\\receipts\\grocery.pdf",
      mime_type: "application/pdf",
    },
  ]),
  deleteAttachment: vi.fn(async () => undefined),
}));

vi.mock("@/services/db", () => ({
  db: {
    listCategories: mocks.listCategories,
    listTags: mocks.listTags,
    createTransaction: mocks.createTransaction,
    updateTransaction: mocks.updateTransaction,
    listAttachments: mocks.listAttachments,
    deleteAttachment: mocks.deleteAttachment,
    addAttachment: vi.fn(async () => ({})),
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => null),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(async () => undefined),
  revealItemInDir: vi.fn(async () => undefined),
}));

describe("TransactionForm", () => {
  const onSaved = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ hasUnsavedChanges: false });
  });

  it("creates a transaction with required fields", async () => {
    const user = userEvent.setup();
    render(
      <TransactionForm
        open
        onClose={onClose}
        accountId="acct-1"
        onSaved={onSaved}
      />,
    );
    await user.type(screen.getByLabelText(/Payee/i), "Store");
    await user.type(screen.getByLabelText(/Amount/i), "-25");
    await waitFor(() => expect(screen.getByRole("option", { name: "Groceries" })).toBeInTheDocument());
    await user.selectOptions(screen.getByDisplayValue("Uncategorized"), "cat-1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mocks.createTransaction).toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows validation error when amount is zero", async () => {
    const user = userEvent.setup();
    render(
      <TransactionForm
        open
        onClose={onClose}
        accountId="acct-1"
        onSaved={onSaved}
      />,
    );
    await user.type(screen.getByLabelText(/Amount/i), "0");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Amount is required and cannot be zero")).toBeInTheDocument();
    expect(mocks.createTransaction).not.toHaveBeenCalled();
  });

  it("lists attachments for an existing transaction", async () => {
    render(
      <TransactionForm
        open
        onClose={onClose}
        accountId="acct-1"
        transaction={{
          id: "tx-1",
          account_id: "acct-1",
          date: "2026-01-02",
          amount: -25,
          payee_name: "Store",
          cleared: false,
          reconciled: false,
          splits: [],
          tags: [],
        }}
        onSaved={onSaved}
      />,
    );
    expect(await screen.findByText("grocery.pdf")).toBeInTheDocument();
    expect(mocks.listAttachments).toHaveBeenCalledWith("tx-1");
  });

  it("updates an existing transaction", async () => {
    const user = userEvent.setup();
    render(
      <TransactionForm
        open
        onClose={onClose}
        accountId="acct-1"
        transaction={{
          id: "tx-1",
          account_id: "acct-1",
          date: "2026-01-02",
          amount: -25,
          payee_name: "Store",
          category_id: "cat-1",
          cleared: false,
          reconciled: false,
          splits: [],
          tags: [],
        }}
        onSaved={onSaved}
      />,
    );
    await user.clear(screen.getByLabelText(/Amount/i));
    await user.type(screen.getByLabelText(/Amount/i), "-30");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledWith("tx-1", expect.objectContaining({ amount: -30 }));
    });
  });

  it("supports split transactions", async () => {
    const user = userEvent.setup();
    render(
      <TransactionForm open onClose={onClose} accountId="acct-1" onSaved={onSaved} />,
    );
    await user.click(screen.getByLabelText(/Split transaction/i));
    await user.type(screen.getByLabelText(/Amount/i), "-40");
    const splitAmounts = screen.getAllByPlaceholderText("Amount");
    await user.type(splitAmounts[0], "-40");
    await waitFor(() => expect(screen.getByRole("option", { name: "Groceries" })).toBeInTheDocument());
    const categorySelects = screen.getAllByRole("combobox");
    await user.selectOptions(categorySelects[0], "cat-1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mocks.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          splits: expect.arrayContaining([expect.objectContaining({ category_id: "cat-1", amount: -40 })]),
        }),
      );
    });
  });
});
