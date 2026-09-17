"use client";

import { Fragment, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";
import { ArrowLeftIcon, PencilIcon, Settings2Icon, Trash2Icon } from "lucide-react";

// tui-date-picker touches `window` at module load time, which breaks Next's
// server-side render of this client component — load it in the browser only.
const DatePickerInput = dynamic(
  () => import("@/components/ui/date-picker-input").then((m) => m.DatePickerInput),
  { ssr: false }
);
import {
  createCategory,
  createTransaction,
  deleteCategory,
  fetchBudgetLabels,
  fetchCategories,
  fetchRecentCategoryIds,
  fetchVariableBudgetItems,
  updateCategory,
  updateTransaction,
  type TransactionWithCategory,
  type VariableBudgetItemWithCategory,
} from "@/lib/queries";
import { toDateKey } from "@/lib/date-range";
import { FIXED_EXPENSE_GROUP } from "@/lib/budget-rows";
import type { BudgetLabel, Category, TransactionType } from "@/types/database";

/** 카테고리 밑에 보여줄 2뎁스 세부항목 칩. 고정지출은 budget_labels(월 무관 고정 목록), 변동지출은 그 달의 variable_budget_items(월별 계획) memo에서 가져옴. */
interface SubItemOption {
  id: string;
  name: string;
}

function variableSubItemOptions(
  items: VariableBudgetItemWithCategory[],
  categoryId: string
): SubItemOption[] {
  const seen = new Set<string>();
  const options: SubItemOption[] = [];
  for (const item of items) {
    if (item.category_id !== categoryId) continue;
    const name = (item.memo ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    options.push({ id: item.id, name });
  }
  return options;
}

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Pass an existing transaction to edit it instead of creating a new one. */
  transaction?: TransactionWithCategory | null;
}

function orderByRecent(categories: Category[], recentIds: string[]): Category[] {
  const recent = recentIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Category => Boolean(c));
  const rest = categories.filter((c) => !recentIds.includes(c.id));
  return [...recent, ...rest];
}

export function QuickAddModal({
  open,
  onOpenChange,
  onSaved,
  transaction = null,
}: QuickAddModalProps) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetLabels, setBudgetLabels] = useState<BudgetLabel[]>([]);
  const [variableBudgetItems, setVariableBudgetItems] = useState<VariableBudgetItemWithCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.category_id ?? null);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [date, setDate] = useState(() => transaction?.date ?? toDateKey(new Date()));
  const [memo, setMemo] = useState(transaction?.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"form" | "manage">("form");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  async function loadCategories() {
    const [cats, recentIds] = await Promise.all([
      fetchCategories(type),
      fetchRecentCategoryIds(type),
    ]);
    setCategories(orderByRecent(cats, recentIds));
    setCategoryId((current) =>
      current && cats.some((c) => c.id === current) ? current : null
    );

    const fixedCategoryIds = cats
      .filter((c) => c.report_group === FIXED_EXPENSE_GROUP)
      .map((c) => c.id);
    setBudgetLabels(fixedCategoryIds.length > 0 ? await fetchBudgetLabels(fixedCategoryIds) : []);
  }

  useEffect(() => {
    if (!open) return;
    (async () => {
      await loadCategories();
    })();
  }, [open, type]);

  const monthKey = `${date.slice(0, 7)}-01`;

  useEffect(() => {
    if (!open || type !== "expense") {
      setVariableBudgetItems([]);
      return;
    }
    fetchVariableBudgetItems(monthKey).then(setVariableBudgetItems);
  }, [open, type, monthKey]);

  function resetForm() {
    setType("expense");
    setCategoryId(null);
    setAmount("");
    setDate(toDateKey(new Date()));
    setMemo("");
    setView("form");
    setNewCategoryName("");
    setActiveCategoryId(null);
    setCategoryError(null);
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setCategoryError(null);
    try {
      await createCategory(name, type);
      setNewCategoryName("");
      await loadCategories();
    } catch {
      setCategoryError("카테고리를 추가하지 못했습니다");
    }
  }

  async function handleSaveCategoryName(id: string) {
    const name = editingCategoryName.trim();
    if (!name) return;
    setCategoryError(null);
    try {
      await updateCategory(id, name);
      setActiveCategoryId(null);
      await loadCategories();
    } catch {
      setCategoryError("카테고리를 수정하지 못했습니다");
    }
  }

  async function handleDeleteCategory(id: string) {
    setCategoryError(null);
    try {
      await deleteCategory(id);
      setActiveCategoryId(null);
      await loadCategories();
    } catch {
      setCategoryError("카테고리를 삭제하지 못했습니다");
    }
  }

  const amountValue = Number(amount);
  const isValid = amountValue > 0 && Boolean(categoryId) && Boolean(date);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const selectedCategoryLabels: SubItemOption[] = !selectedCategory
    ? []
    : selectedCategory.report_group === FIXED_EXPENSE_GROUP
      ? budgetLabels.filter((l) => l.category_id === selectedCategory.id)
      : variableSubItemOptions(variableBudgetItems, selectedCategory.id);

  function toggleMemoLabel(name: string) {
    setMemo((m) => (m.trim() === name ? "" : name));
  }

  async function handleSave() {
    if (!isValid || !categoryId) return;
    setSaving(true);
    try {
      const input = {
        type,
        amount: amountValue,
        category_id: categoryId,
        date,
        memo: memo.trim() || null,
      };
      if (transaction) {
        await updateTransaction(transaction.id, input);
      } else {
        await createTransaction(input);
      }
      resetForm();
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            {view === "manage" && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setView("form")}
              >
                <ArrowLeftIcon />
                <span className="sr-only">뒤로</span>
              </Button>
            )}
            <DialogTitle>
              {view === "manage" ? "카테고리 관리" : transaction ? "수정" : "추가"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {view === "manage" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              {categories.map((c) =>
                activeCategoryId === c.id ? (
                  <div
                    key={c.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ring-1 ring-border"
                  >
                    <Input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="h-7 flex-1 text-sm"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => handleSaveCategoryName(c.id)}
                    >
                      <PencilIcon className="size-3.5" />
                      수정
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="text-expense"
                      onClick={() => handleDeleteCategory(c.id)}
                    >
                      <Trash2Icon className="size-3.5" />
                      삭제
                    </Button>
                  </div>
                ) : (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm ring-1 ring-border"
                    onClick={() => {
                      setActiveCategoryId(c.id);
                      setEditingCategoryName(c.name);
                    }}
                  >
                    {c.name}
                  </button>
                )
              )}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">등록된 카테고리가 없습니다</p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Input
                placeholder="새 카테고리 이름"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button type="button" onClick={handleAddCategory}>
                추가
              </Button>
            </div>

            {categoryError && <p className="text-sm text-expense">{categoryError}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={type === "expense" ? "default" : "outline"}
                onClick={() => setType("expense")}
              >
                지출
              </Button>
              <Button
                type="button"
                variant={type === "income" ? "default" : "outline"}
                onClick={() => setType("income")}
              >
                수입
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-add-amount">금액</Label>
              <Input
                id="quick-add-amount"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>카테고리</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setView("manage")}
                >
                  <Settings2Icon />
                  <span className="sr-only">카테고리 관리</span>
                </Button>
              </div>
              <div className="flex flex-wrap items-start gap-1.5">
                {categories.map((c) => (
                  <Fragment key={c.id}>
                    <button
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-sm transition-colors",
                        categoryId === c.id
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      {c.name}
                    </button>
                    {c.id === categoryId && selectedCategoryLabels.length > 0 && (
                      <div className="flex w-full flex-wrap gap-1.5 pl-3">
                        {selectedCategoryLabels.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => toggleMemoLabel(l.name)}
                            className={cn(
                              "rounded-lg border px-2 py-0.5 text-xs transition-colors",
                              memo.trim() === l.name
                                ? "border-transparent bg-primary text-primary-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {l.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </Fragment>
                ))}
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground">등록된 카테고리가 없습니다</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-add-date">날짜</Label>
              <DatePickerInput id="quick-add-date" value={date} onChange={setDate} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-add-memo">메모</Label>
              <Input
                id="quick-add-memo"
                type="text"
                placeholder="메모 (선택)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {view === "manage" ? (
            <Button type="button" variant="outline" onClick={() => setView("form")}>
              완료
            </Button>
          ) : (
            <Button type="button" disabled={!isValid || saving} onClick={handleSave}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
