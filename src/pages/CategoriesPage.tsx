import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import { db } from "@/services/db";
import { useUiStore } from "@/stores/index";
import type { AutoCategorizeRule, Category } from "@/shared/types";

type RuleTargetField = AutoCategorizeRule["target_field"];
type RuleMatchType = AutoCategorizeRule["match_type"];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<AutoCategorizeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [catModal, setCatModal] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: "", parent_id: "", category_type: "expense", is_tax_related: false });
  const [ruleForm, setRuleForm] = useState<{
    pattern: string;
    category_id: string;
    target_field: RuleTargetField;
    match_type: RuleMatchType;
    priority: string;
    enabled: boolean;
  }>({
    pattern: "",
    category_id: "",
    target_field: "payee",
    match_type: "contains",
    priority: "100",
    enabled: true,
  });

  const addToast = useUiStore((s) => s.addToast);
  const showConfirm = useUiStore((s) => s.showConfirm);

  const load = async () => {
    try {
      const [cats, rls] = await Promise.all([db.listCategories(), db.listAutoRules()]);
      setCategories(cats);
      setRules(rls);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tree = useMemo(() => {
    const roots = categories.filter((c) => !c.parent_id);
    return roots.map((root) => ({
      ...root,
      children: categories.filter((c) => c.parent_id === root.id),
    }));
  }, [categories]);

  const openCreate = () => {
    setEditing(null);
    setCatForm({ name: "", parent_id: "", category_type: "expense", is_tax_related: false });
    setCatModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setCatForm({
      name: cat.name,
      parent_id: cat.parent_id ?? "",
      category_type: cat.category_type,
      is_tax_related: cat.is_tax_related,
    });
    setCatModal(true);
  };

  const saveCategory = async () => {
    if (!catForm.name.trim()) {
      addToast("error", "Name is required");
      return;
    }
    try {
      const parentId = catForm.parent_id || null;
      if (editing) {
        await db.updateCategory(editing.id, catForm.name, parentId, catForm.category_type, catForm.is_tax_related);
        addToast("success", "Category updated");
      } else {
        await db.createCategory(catForm.name, parentId, catForm.category_type, catForm.is_tax_related);
        addToast("success", "Category created");
      }
      setCatModal(false);
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save category");
    }
  };

  const deleteCategory = (cat: Category) => {
    showConfirm("Delete Category", `Delete "${cat.name}"?`, async () => {
      try {
        await db.deleteCategory(cat.id);
        addToast("success", "Category deleted");
        await load();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to delete");
      }
    });
  };

  const saveRule = async () => {
    if (!ruleForm.pattern || !ruleForm.category_id) {
      addToast("error", "Pattern and category are required");
      return;
    }
    try {
      await db.createAutoRule(
        ruleForm.pattern.trim(),
        ruleForm.category_id,
        ruleForm.target_field,
        ruleForm.match_type,
        parseInt(ruleForm.priority, 10) || 100,
        ruleForm.enabled,
      );
      addToast("success", "Rule created");
      setRuleModal(false);
      setRuleForm({
        pattern: "",
        category_id: "",
        target_field: "payee",
        match_type: "contains",
        priority: "100",
        enabled: true,
      });
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to create rule");
    }
  };

  const applyRules = (overwrite: boolean) => {
    showConfirm(
      overwrite ? "Recategorize Transactions" : "Categorize Transactions",
      overwrite
        ? "Apply enabled rules to all non-split transactions, replacing existing categories?"
        : "Apply enabled rules to uncategorized non-split transactions?",
      async () => {
        try {
          const count = await db.applyAutoRulesToTransactions(overwrite);
          addToast("success", `Updated ${count} transaction${count === 1 ? "" : "s"}`);
        } catch (e) {
          addToast("error", e instanceof Error ? e.message : "Failed to apply rules");
        }
      },
    );
  };

  const deleteRule = (rule: AutoCategorizeRule) => {
    showConfirm("Delete Rule", `Delete rule "${rule.pattern}"?`, async () => {
      try {
        await db.deleteAutoRule(rule.id);
        addToast("success", "Rule deleted");
        await load();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to delete rule");
      }
    });
  };

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button type="button" onClick={openCreate} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          + New Category
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {tree.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No categories yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {tree.map((root) => (
              <li key={root.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="font-medium">{root.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{root.category_type}</span>
                    {root.is_tax_related && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs">Tax</span>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(root)} className="text-xs text-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => deleteCategory(root)} className="text-xs text-destructive hover:underline">Delete</button>
                  </div>
                </div>
                {root.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 pl-10">
                    <div>
                      <span>{child.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{child.category_type}</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(child)} className="text-xs text-primary hover:underline">Edit</button>
                      <button type="button" onClick={() => deleteCategory(child)} className="text-xs text-destructive hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Auto-Categorize Rules</h2>
            <p className="text-sm text-muted-foreground">Lower priority numbers run first. Disabled rules are skipped.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyRules(false)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Apply to uncategorized
            </button>
            <button type="button" onClick={() => applyRules(true)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Reapply all
            </button>
            <button type="button" onClick={() => setRuleModal(true)} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              + Add Rule
            </button>
          </div>
        </div>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules configured</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">P{rule.priority}</span>
                    {!rule.enabled && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">Disabled</span>}
                    <span className="text-xs text-muted-foreground">{rule.target_field.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">{rule.match_type.replace("_", " ")}</span>
                    <span className="font-mono text-sm">&quot;{rule.pattern}&quot;</span>
                  </div>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-sm">{rule.category_name}</span>
                </div>
                <button type="button" onClick={() => deleteRule(rule)} className="text-xs text-destructive hover:underline">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={catModal} onClose={() => setCatModal(false)} title={editing ? "Edit Category" : "New Category"} footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setCatModal(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={saveCategory} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Save</button>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input type="text" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Parent</label>
            <select value={catForm.parent_id} onChange={(e) => setCatForm({ ...catForm, parent_id: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
              <option value="">None (top level)</option>
              {categories.filter((c) => c.id !== editing?.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select value={catForm.category_type} onChange={(e) => setCatForm({ ...catForm, category_type: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={catForm.is_tax_related} onChange={(e) => setCatForm({ ...catForm, is_tax_related: e.target.checked })} className="rounded" />
            Tax related
          </label>
        </div>
      </Modal>

      <Modal open={ruleModal} onClose={() => setRuleModal(false)} title="New Auto-Categorize Rule" footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setRuleModal(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={saveRule} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Save</button>
        </div>
      }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Match field</label>
              <select
                value={ruleForm.target_field}
                onChange={(e) => setRuleForm({ ...ruleForm, target_field: e.target.value as RuleTargetField })}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                <option value="payee">Payee</option>
                <option value="memo">Memo</option>
                <option value="payee_or_memo">Payee or memo</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Match type</label>
              <select
                value={ruleForm.match_type}
                onChange={(e) => setRuleForm({ ...ruleForm, match_type: e.target.value as RuleMatchType })}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                <option value="contains">Contains</option>
                <option value="starts_with">Starts with</option>
                <option value="equals">Equals</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Pattern</label>
            <input type="text" value={ruleForm.pattern} onChange={(e) => setRuleForm({ ...ruleForm, pattern: e.target.value })} placeholder="e.g. Starbucks" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select value={ruleForm.category_id} onChange={(e) => setRuleForm({ ...ruleForm, category_id: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Priority</label>
              <input
                type="number"
                value={ruleForm.priority}
                onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              />
            </div>
            <label className="mt-7 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ruleForm.enabled}
                onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
                className="rounded"
              />
              Enabled
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
