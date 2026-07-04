import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BudgetsPage from "./BudgetsPage";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useUiStore } from "@/stores/index";

const mocks = vi.hoisted(() => ({
  listBudgets: vi.fn(async () => [
    {
      id: "budget-1",
      category_id: "cat-1",
      category_name: "Food",
      period: "2026-07",
      amount: 500,
      spent: 120,
    },
  ]),
  listCategories: vi.fn(async () => [
    { id: "cat-1", name: "Food", parent_id: null, category_type: "expense", is_tax_related: false },
    { id: "cat-2", name: "Salary", parent_id: null, category_type: "income", is_tax_related: false },
  ]),
  createBudget: vi.fn(async () => ({
    id: "budget-2",
    category_id: "cat-1",
    category_name: "Food",
    period: "2026-07",
    amount: 300,
    spent: 0,
  })),
  updateBudget: vi.fn(async () => undefined),
  deleteBudget: vi.fn(async () => undefined),
}));

vi.mock("@/services/db", () => ({ db: mocks }));

describe("BudgetsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      toasts: [],
      confirm: { open: false, title: "", message: "" },
    });
  });

  it("creates a budget from modal", async () => {
    const user = userEvent.setup();
    render(<BudgetsPage />);
    await screen.findByText("Food");
    await user.click(screen.getByText("+ New Budget"));
    await user.selectOptions(screen.getByDisplayValue("Select category"), "cat-1");
    await user.type(screen.getByRole("dialog").querySelector('input[type="number"]')!, "300");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(mocks.createBudget).toHaveBeenCalledWith("cat-1", expect.stringMatching(/^\d{4}-\d{2}$/), 300);
    });
  });

  it("edits budget amount via modal", async () => {
    const user = userEvent.setup();
    render(<BudgetsPage />);
    await screen.findByText("Edit");
    await user.click(screen.getByText("Edit"));
    const amountInput = screen.getByRole("dialog").querySelector('input[type="number"]') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "600");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mocks.updateBudget).toHaveBeenCalledWith("budget-1", 600);
    });
  });

  it("deletes budget after confirmation", async () => {
    const user = userEvent.setup();
    render(
      <>
        <BudgetsPage />
        <ConfirmDialog />
      </>,
    );
    await screen.findByText("Delete");
    await user.click(screen.getByText("Delete"));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => {
      expect(mocks.deleteBudget).toHaveBeenCalledWith("budget-1");
    });
  });
});
