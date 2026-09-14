"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BudgetProgressBar } from "@/components/budget-progress-bar";
import { getMonthRange } from "@/lib/date-range";
import {
  fetchBudgets,
  fetchTransactions,
  type BudgetWithCategory,
  type TransactionWithCategory,
} from "@/lib/queries";

export default function StatsPage() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    const range = getMonthRange(year, month);
    Promise.all([fetchBudgets(monthKey), fetchTransactions(range)]).then(([b, tx]) => {
      if (cancelled) return;
      setBudgets(b);
      setTransactions(tx);
    });
    return () => {
      cancelled = true;
    };
  }, [year, month, monthKey]);

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount);
    }
    return map;
  }, [transactions]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-base font-medium">{month + 1}월 카테고리별 예산</h1>

      {budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">설정된 카테고리 예산이 없습니다</p>
      ) : (
        <Card size="sm">
          <CardContent className="flex flex-col gap-4">
            {budgets.map((b) => (
              <div key={b.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: b.category?.color ?? "#888780" }}
                  />
                  <span>{b.category?.name ?? "미분류"}</span>
                </div>
                <BudgetProgressBar spent={spentByCategory.get(b.category_id) ?? 0} budget={b.amount} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
