"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { BudgetExcelTable } from "@/components/budget-excel-table";
import { VariableBudgetItemReviewTable } from "@/components/variable-budget-item-review-table";
import { AssetReviewSection } from "@/components/asset-review-section";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { encodeMonthParam, getMonthRange, parseMonthParam } from "@/lib/date-range";
import { buildFixedExpenseLabelRows, buildRows, FIXED_EXPENSE_GROUP } from "@/lib/budget-rows";
import {
  fetchAssetItems,
  fetchAssetSnapshots,
  fetchBudgetLabels,
  fetchBudgets,
  fetchCategories,
  fetchMonthlyBudget,
  fetchTransactions,
  fetchVariableBudgetItems,
  type BudgetWithCategory,
  type TransactionWithCategory,
  type VariableBudgetItemWithCategory,
} from "@/lib/queries";
import type { AssetItem, AssetSnapshot, BudgetLabel, Category } from "@/types/database";

export default function MonthlyPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: monthParam } = use(params);
  const parsed = useMemo(() => parseMonthParam(monthParam), [monthParam]);

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [assetItems, setAssetItems] = useState<AssetItem[]>([]);
  const [assetSnapshots, setAssetSnapshots] = useState<AssetSnapshot[]>([]);
  const [prevAssetSnapshots, setPrevAssetSnapshots] = useState<AssetSnapshot[]>([]);
  const [budgetLabels, setBudgetLabels] = useState<BudgetLabel[]>([]);
  const [variableBudgetItems, setVariableBudgetItems] = useState<VariableBudgetItemWithCategory[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const monthKey = parsed ? getMonthRange(parsed.year, parsed.month).from : null;
  const prevMonthKey = parsed
    ? getMonthRange(new Date(parsed.year, parsed.month - 1, 1).getFullYear(), new Date(parsed.year, parsed.month - 1, 1).getMonth()).from
    : null;

  useEffect(() => {
    if (!parsed || !monthKey || !prevMonthKey) return;
    let cancelled = false;
    const range = getMonthRange(parsed.year, parsed.month);

    Promise.all([
      fetchTransactions(range),
      fetchMonthlyBudget(monthKey),
      fetchCategories("income"),
      fetchCategories("expense"),
      fetchBudgets(monthKey),
      fetchAssetItems(),
      fetchAssetSnapshots(monthKey),
      fetchAssetSnapshots(prevMonthKey),
      fetchVariableBudgetItems(monthKey),
    ]).then(
      async ([
        tx,
        monthlyBudget,
        incomeCats,
        expenseCats,
        budgetRows,
        assetItemRows,
        assetSnapshotRows,
        prevAssetSnapshotRows,
        variableItemRows,
      ]) => {
        if (cancelled) return;
        const fixedCategoryIds = expenseCats
          .filter((c) => c.report_group === FIXED_EXPENSE_GROUP)
          .map((c) => c.id);
        const labelRows = await fetchBudgetLabels(fixedCategoryIds);
        if (cancelled) return;
        setTransactions(tx);
        setBudgetAmount(monthlyBudget?.amount ?? 0);
        setIncomeCategories(incomeCats);
        setExpenseCategories(expenseCats);
        setBudgets(budgetRows);
        setAssetItems(assetItemRows);
        setAssetSnapshots(assetSnapshotRows);
        setPrevAssetSnapshots(prevAssetSnapshotRows);
        setBudgetLabels(labelRows);
        setVariableBudgetItems(variableItemRows);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [parsed, monthKey, prevMonthKey, refreshKey]);

  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const carryover = budgetAmount - expense;

  const fixedExpenseCategories = expenseCategories.filter((c) => c.report_group === FIXED_EXPENSE_GROUP);
  const variableExpenseCategories = expenseCategories.filter((c) => c.report_group !== FIXED_EXPENSE_GROUP);

  const incomeRows = buildRows(incomeCategories, transactions, budgets);
  const fixedExpenseRows = buildFixedExpenseLabelRows(fixedExpenseCategories, transactions, budgets, budgetLabels);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  if (!parsed || !monthKey || !prevMonthKey) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6 lg:max-w-4xl lg:gap-6 lg:p-8">
        <p className="text-sm text-muted-foreground lg:text-base">잘못된 월입니다.</p>
      </main>
    );
  }

  const prevLink = (() => {
    const d = new Date(parsed.year, parsed.month - 1, 1);
    return encodeMonthParam(d.getFullYear(), d.getMonth());
  })();
  const nextLink = (() => {
    const d = new Date(parsed.year, parsed.month + 1, 1);
    return encodeMonthParam(d.getFullYear(), d.getMonth());
  })();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6 lg:max-w-4xl lg:gap-6 lg:p-8">
      <div className="flex items-center justify-between">
        <Link
          href={`/monthly/${prevLink}`}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
        <h1 className="text-base font-medium lg:text-xl">
          {parsed.year}년 {parsed.month + 1}월 정산
        </h1>
        <Link
          href={`/monthly/${nextLink}`}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">수입</h2>
        <BudgetExcelTable month={monthKey} actualLabel="수입" rows={incomeRows} onSaved={refresh} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">고정지출</h2>
        <BudgetExcelTable month={monthKey} actualLabel="사용 금액" rows={fixedExpenseRows} onSaved={refresh} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">변동지출</h2>
        <VariableBudgetItemReviewTable
          month={monthKey}
          categories={variableExpenseCategories}
          items={variableBudgetItems}
          budgets={budgets}
          transactions={transactions}
          onSaved={refresh}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground lg:text-base">자산현황</h2>
        <AssetReviewSection
          month={monthKey}
          prevMonth={prevMonthKey}
          items={assetItems}
          snapshots={assetSnapshots}
          prevSnapshots={prevAssetSnapshots}
          onSaved={refresh}
        />
      </section>
    </main>
  );
}
