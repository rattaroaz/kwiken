import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CommandPalette from "./CommandPalette";
import { useUiStore } from "@/stores/index";

const mocks = vi.hoisted(() => ({
  listAccounts: vi.fn(async () => [
    {
      id: "acct-1",
      name: "Checking",
      account_type: "checking",
      currency: "USD",
      opening_balance: 1000,
      balance: 925,
      institution: "Bank",
      is_archived: false,
      created_at: "2026-01-01T00:00:00Z",
    },
  ]),
  listCategories: vi.fn(async () => [
    {
      id: "cat-1",
      name: "Groceries",
      parent_id: null,
      category_type: "expense",
      is_tax_related: false,
    },
  ]),
  searchPayees: vi.fn(async () => [
    { id: "payee-1", name: "Whole Foods", default_category_id: "cat-1" },
  ]),
  listTransactions: vi.fn(async () => [
    {
      id: "tx-1",
      account_id: "acct-1",
      date: "2026-01-02",
      amount: -42,
      payee_name: "Whole Foods",
      category_name: "Groceries",
      memo: "Weekly shop",
      cleared: false,
      reconciled: false,
      splits: [],
      tags: [],
    },
  ]),
}));

vi.mock("@/services/db", () => ({
  db: {
    listAccounts: mocks.listAccounts,
    listCategories: mocks.listCategories,
    searchPayees: mocks.searchPayees,
    listTransactions: mocks.listTransactions,
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    useUiStore.setState({ commandPaletteOpen: true });
  });

  it("filters built-in pages by query", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(screen.getByPlaceholderText("Search pages, accounts, payees, categories, transactions…"), "budget");
    expect(screen.getByText("Budgets")).toBeInTheDocument();
  });

  it("searches accounts, payees, and transactions after debounce", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(screen.getByPlaceholderText("Search pages, accounts, payees, categories, transactions…"), "whole");
    await waitFor(
      () => {
        expect(mocks.listAccounts).toHaveBeenCalled();
        expect(mocks.searchPayees).toHaveBeenCalledWith("whole", 8);
      },
      { timeout: 3000 },
    );
    expect(screen.getAllByText("Whole Foods").length).toBeGreaterThan(0);
  });

  it("navigates on item selection", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Dashboard/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });
});
