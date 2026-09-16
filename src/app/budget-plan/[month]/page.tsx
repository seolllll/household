"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BudgetReviewTable } from "@/components/budget-review-table";
import { WeeklyBudgetItemModal } from "@/components/weekly-budget-item-modal";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { encodeMonthParam, getMonthRange, parseMonthParam } from "@/lib/date-range";
import { getMonthWeeks } from "@/lib/week";
import { buildFixedExpenseLabelRows, buildRows, FIXED_EXPENSE_GROUP } from "@/lib/budget-rows";
import {
  deleteWeeklyBudgetItem,
  fetchBudgets,
  fetchCategories,
  fetchMonthlyBudget,
  fetchWeeklyBudgetItems,
  upsertMonthlyBudget,
  type BudgetWithCategory,
  type WeeklyBudgetItemWithCategory,
} from "@/lib/queries";
import type { Category } from "@/types/database";

export default function BudgetPlanPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: monthParam } = use(params);
  const parsed = useMemo(() => parseMonthParam(monthParam), [monthParam]);

  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [livingBudget, setLivingBudget] = useState(0);
  const [weeklyBudgetItems, setWeeklyBudgetItems] = useState<WeeklyBudgetItemWithCategory[]>([]);
  const [editingLiving, setEditingLiving] = useState(false);
  const [livingInput, setLivingInput] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [modalWeekStart, setModalWeekStart] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<WeeklyBudgetItemWithCategory | null>(null);

  const monthKey = parsed ? getMonthRange(parsed.year, parsed.month).from : null;

  useEffect(() => {
    if (!parsed || !monthKey) return;
    let cancelled = false;
    const range = getMonthRange(parsed.year, parsed.month);

    Promise.all([
      fetchCategories("income"),
      fetchCategories("expense"),
      fetchBudgets(monthKey),
      fetchMonthlyBudget(monthKey),
      fetchWeeklyBudgetItems(range),
    ]).then(([incomeCats, expenseCats, budgetRows, monthlyBudget, weeklyBudgetItemRows]) => {
      if (cancelled) return;
      setIncomeCategories(incomeCats);
      setExpenseCategories(expenseCats);
      setBudgets(budgetRows);
      setLivingBudget(monthlyBudget?.amount ?? 0);
      setWeeklyBudgetItems(weeklyBudgetItemRows);
    });

    return () => {
      cancelled = true;
    };
  }, [parsed, monthKey, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  if (!parsed || !monthKey) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6 lg:max-w-4xl lg:gap-6 lg:p-8">
        <p className="text-sm text-muted-foreground lg:text-base">잘못된 월입니다.</p>
      </main>
    );
  }

  const currentMonthKey = monthKey;
  const weeks = getMonthWeeks(parsed.year, parsed.month);
  const fixedExpenseCategories = expenseCategories.filter((c) => c.report_group === FIXED_EXPENSE_GROUP);
  const variableExpenseCategories = expenseCategories.filter((c) => c.report_group !== FIXED_EXPENSE_GROUP);

  const incomeRows = buildRows(incomeCategories, [], budgets);
  const fixedExpenseRows = buildFixedExpenseLabelRows(fixedExpenseCategories, [], budgets);
  const variableExpenseRows = buildRows(variableExpenseCategories, [], budgets);

  const prevLink = (() => {
    const d = new Date(parsed.year, parsed.month - 1, 1);
    return encodeMonthParam(d.getFullYear(), d.getMonth());
  })();
  const nextLink = (() => {
    const d = new Date(parsed.year, parsed.month + 1, 1);
    return encodeMonthParam(d.getFullYear(), d.getMonth());
  })();

  function startEditLiving() {
    setLivingInput(String(livingBudget));
    setEditingLiving(true);
  }

  async function saveLiving() {
    setEditingLiving(false);
    const value = Number(livingInput);
    if (!Number.isFinite(value) || value < 0) return;
    setLivingBudget(value);
    await upsertMonthlyBudget(currentMonthKey, value);
  }

  function openAddItemModal(weekStart: string) {
    setEditingItem(null);
    setModalWeekStart(weekStart);
    setItemModalOpen(true);
  }

  function openEditItemModal(item: WeeklyBudgetItemWithCategory) {
    setEditingItem(item);
    setModalWeekStart(item.week_start);
    setItemModalOpen(true);
    setActiveItemId(null);
  }

  async function handleDeleteItem(id: string) {
    await deleteWeeklyBudgetItem(id);
    setActiveItemId(null);
    refresh();
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6 lg:max-w-4xl lg:gap-6 lg:p-8">
      <div className="flex items-center justify-between">
        <Link
          href={`/budget-plan/${prevLink}`}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
        <h1 className="text-base font-medium lg:text-xl">
          {parsed.year}년 {parsed.month + 1}월 예산계획
        </h1>
        <Link
          href={`/budget-plan/${nextLink}`}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">생활비</h2>
        <Card size="sm" className="border-primary/30 bg-white">
          <CardContent className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground lg:text-sm">{parsed.month + 1}월 생활비</span>
            {editingLiving ? (
              <Input
                autoFocus
                type="number"
                inputMode="numeric"
                min={0}
                className="w-32 text-right lg:w-40 lg:text-base"
                value={livingInput}
                onChange={(e) => setLivingInput(e.target.value)}
                onBlur={saveLiving}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingLiving(false);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={startEditLiving}
                className="text-lg font-semibold tracking-tight lg:text-2xl"
              >
                {formatCurrency(livingBudget)}
              </button>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">주간별 예산</h2>
        {weeks.map((week) => {
          const items = weeklyBudgetItems.filter((it) => it.week_start === week.from);
          const total = items.reduce((sum, it) => sum + it.amount, 0);

          return (
            <div key={week.weekNumber} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm lg:text-base">
                  {week.weekNumber}주차{" "}
                  <span className="text-xs text-muted-foreground lg:text-sm">
                    ({formatShortDate(week.from)} ~ {formatShortDate(week.to)})
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold tabular-nums lg:text-base">
                    {formatCurrency(total)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openAddItemModal(week.from)}
                  >
                    <PlusIcon className="size-4" />
                    <span className="sr-only">추가</span>
                  </Button>
                </div>
              </div>

              <Card size="sm" className="border-primary/30 bg-white">
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground lg:text-base">항목이 없습니다</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {items.map((item) => (
                        <li key={item.id} className="flex flex-col gap-2 py-2 text-sm lg:text-base">
                          <button
                            type="button"
                            className="flex items-center justify-between gap-2 text-left"
                            onClick={() =>
                              setActiveItemId((id) => (id === item.id ? null : item.id))
                            }
                          >
                            <div className="flex flex-col">
                              <span>{item.memo || item.category?.name || "지출"}</span>
                              {item.memo && (
                                <span className="text-xs text-muted-foreground lg:text-sm">
                                  {item.category?.name ?? "미분류"}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 font-medium tabular-nums text-expense">
                              {formatCurrency(item.amount)}
                            </span>
                          </button>

                          {activeItemId === item.id && (
                            <div className="flex items-center justify-end gap-1.5 border-t border-border pt-2">
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() => openEditItemModal(item)}
                              >
                                <PencilIcon className="size-3.5" />
                                수정
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                className="text-expense"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2Icon className="size-3.5" />
                                삭제
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">수입 계획</h2>
        <BudgetReviewTable month={monthKey} rows={incomeRows} showActual={false} onSaved={refresh} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">고정지출 계획</h2>
        <BudgetReviewTable month={monthKey} rows={fixedExpenseRows} showActual={false} onSaved={refresh} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">변동지출 계획</h2>
        <BudgetReviewTable month={monthKey} rows={variableExpenseRows} showActual={false} onSaved={refresh} />
      </section>

      <WeeklyBudgetItemModal
        key={editingItem?.id ?? modalWeekStart ?? "none"}
        open={itemModalOpen}
        onOpenChange={(next) => {
          setItemModalOpen(next);
          if (!next) {
            setEditingItem(null);
            setModalWeekStart(null);
          }
        }}
        weekStart={modalWeekStart}
        categories={expenseCategories}
        item={editingItem}
        onSaved={refresh}
      />
    </main>
  );
}
