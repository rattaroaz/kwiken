import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoriesPage from "./CategoriesPage";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useUiStore } from "@/stores/index";

const mocks = vi.hoisted(() => ({
  listCategories: vi.fn(async () => [
    {
      id: "cat-1",
      name: "Food",
      parent_id: null,
      category_type: "expense",
      is_tax_related: false,
    },
  ]),
  listAutoRules: vi.fn(async () => [
    {
      id: "rule-1",
      pattern: "coffee",
      category_id: "cat-1",
      category_name: "Food",
      target_field: "payee" as const,
      match_type: "contains" as const,
      priority: 100,
      enabled: true,
    },
  ]),
  applyAutoRulesToTransactions: vi.fn(async () => 3),
  createAutoRule: vi.fn(async () => ({})),
  deleteAutoRule: vi.fn(async () => undefined),
  createCategory: vi.fn(async () => ({})),
  updateCategory: vi.fn(async () => ({})),
  deleteCategory: vi.fn(async () => undefined),
}));

vi.mock("@/services/db", () => ({
  db: {
    listCategories: mocks.listCategories,
    listAutoRules: mocks.listAutoRules,
    applyAutoRulesToTransactions: mocks.applyAutoRulesToTransactions,
    createAutoRule: mocks.createAutoRule,
    deleteAutoRule: mocks.deleteAutoRule,
    createCategory: mocks.createCategory,
    updateCategory: mocks.updateCategory,
    deleteCategory: mocks.deleteCategory,
  },
}));

describe("CategoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      toasts: [],
      confirm: { open: false, title: "", message: "" },
    });
  });

  it("renders categories and auto rules", async () => {
    render(<CategoriesPage />);
    expect(await screen.findByRole("heading", { name: "Auto-Categorize Rules" })).toBeInTheDocument();
    expect(screen.getByText('"coffee"')).toBeInTheDocument();
    expect(screen.getAllByText("Food").length).toBeGreaterThan(0);
  });

  it("applies rules to uncategorized transactions after confirmation", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CategoriesPage />
        <ConfirmDialog />
      </>,
    );
    await screen.findByText("Apply to uncategorized");
    await user.click(screen.getByText("Apply to uncategorized"));
    expect(screen.getByText("Categorize Transactions")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => {
      expect(mocks.applyAutoRulesToTransactions).toHaveBeenCalledWith(false);
    });
  });

  it("opens add rule modal", async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByText("+ Add Rule");
    await user.click(screen.getByText("+ Add Rule"));
    expect(screen.getByRole("heading", { name: "New Auto-Categorize Rule" })).toBeInTheDocument();
  });
});
