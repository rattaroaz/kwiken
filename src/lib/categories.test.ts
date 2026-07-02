import { describe, expect, it } from "vitest";
import { buildCategoryTree, flattenCategoryTree } from "./categories";
import type { Category } from "@/shared/types";

const sample: Category[] = [
  { id: "1", name: "Food", category_type: "expense", is_tax_related: false },
  { id: "2", name: "Groceries", parent_id: "1", category_type: "expense", is_tax_related: false },
  { id: "3", name: "Salary", category_type: "income", is_tax_related: false },
];

describe("buildCategoryTree", () => {
  it("nests children under roots", () => {
    const tree = buildCategoryTree(sample);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].category.name).toBe("Groceries");
  });

  it("flattens back to category list", () => {
    const tree = buildCategoryTree(sample);
    const flat = flattenCategoryTree(tree);
    expect(flat.map((c) => c.id).sort()).toEqual(["1", "2", "3"]);
  });
});
