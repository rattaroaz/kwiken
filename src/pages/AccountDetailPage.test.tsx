import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AccountDetailPage from "./AccountDetailPage";
import { useUiStore } from "@/stores/index";

const mocks = vi.hoisted(() => {
  const account = {
    id: "acct-1",
    name: "Checking",
    account_type: "checking",
    currency: "USD",
    opening_balance: 1000,
    balance: 925,
    institution: "Bank",
    is_archived: false,
    created_at: "2026-01-01",
  };
  const transaction = {
    id: "tx-1",
    account_id: account.id,
    date: "2026-01-02",
    amount: -75,
    payee_name: "Grocer",
    category_name: "Food",
    memo: "Weekly groceries",
    cleared: false,
    reconciled: false,
    splits: [],
    tags: [],
    running_balance: 925,
  };
  return {
    getAccountRegister: vi.fn(async () => ({
      account,
      transactions: [transaction],
      total_count: 1,
      saved_filters: [],
    })),
    listAccounts: vi.fn(async () => [account]),
    createSavedFilter: vi.fn(async () => ({
      id: "filter-1",
      name: "Groceries",
      account_id: account.id,
      filter_json: "{}",
    })),
    listSavedFilters: vi.fn(async () => []),
  };
});

vi.mock("@/services/db", () => ({ db: mocks }));

describe("AccountDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ toasts: [] });
  });

  it("saves a named filter from modal", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/accounts/acct-1"]}>
        <Routes>
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId("transaction-register");
    await user.click(screen.getByText("Save filter"));
    await user.type(screen.getByRole("dialog").querySelector('input[type="text"]')!, "Groceries");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mocks.createSavedFilter).toHaveBeenCalledWith("Groceries", "acct-1", expect.any(String));
    });
  });
});
