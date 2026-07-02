import type { Category } from "@/shared/types";

export interface CategoryTreeNode {
  category: Category;
  children: CategoryTreeNode[];
}

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const roots = categories.filter((c) => !c.parent_id);
  return roots.map((root) => ({
    category: root,
    children: categories
      .filter((c) => c.parent_id === root.id)
      .map((child) => ({
        category: child,
        children: categories
          .filter((c) => c.parent_id === child.id)
          .map((grandchild) => ({ category: grandchild, children: [] })),
      })),
  }));
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]): Category[] {
  const result: Category[] = [];
  for (const node of nodes) {
    result.push(node.category);
    result.push(...flattenCategoryTree(node.children));
  }
  return result;
}
