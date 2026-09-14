"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CategoryBarBreakdown, type CategoryBarItem } from "@/components/category-bar-breakdown";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getMonthRange, toDateKey } from "@/lib/date-range";
import { encodeWeekParam, getMonthWeeks } from "@/lib/week";
import {
  fetchMonthlyBudget,
  fetchTransactions,
  upsertMonthlyBudget,
  type TransactionWithCategory,
} from "@/lib/queries";

export default function WeeklyPage() {
  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const range = getMonthRange(year, month);
    Promise.all([fetchTransactions(range), fetchMonthlyBudget(monthKey)]).then(
      ([tx, budget]) => {
        if (cancelled) return;
        setTransactions(tx);
        setBudgetAmount(budget?.amount ?? 0);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [year, month, monthKey]);

  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month]);

  function startEditBudget() {
    setBudgetInput(String(budgetAmount));
    setEditingBudget(true);
  }

  async function saveBudget() {
    const value = Number(budgetInput);
    setEditingBudget(false);
    if (!Number.isFinite(value) || value < 0) return;
    setBudgetAmount(value);
    await upsertMonthlyBudget(monthKey, value);
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
      <Card size="sm">
        <CardContent className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{month + 1}월 생활비</span>
          {editingBudget ? (
            <Input
              autoFocus
              type="number"
              inputMode="numeric"
              min={0}
              className="w-32 text-right"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={saveBudget}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingBudget(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={startEditBudget}
              className="text-lg font-semibold tracking-tight"
            >
              {formatCurrency(budgetAmount)}
            </button>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {weeks.map((week) => {
          const isCurrentWeek = todayKey >= week.from && todayKey <= week.to;
          const isExpanded = expandedWeek === week.weekNumber;

          const weekExpenseTx = transactions.filter(
            (t) => t.type === "expense" && t.date >= week.from && t.date <= week.to
          );
          const weekExpense = weekExpenseTx.reduce((sum, t) => sum + t.amount, 0);

          const cumulativeExpense = transactions
            .filter((t) => t.type === "expense" && t.date <= week.to)
            .reduce((sum, t) => sum + t.amount, 0);
          const remaining = budgetAmount - cumulativeExpense;

          const categoryMap = new Map<string, CategoryBarItem>();
          for (const t of weekExpenseTx) {
            if (!t.category) continue;
            const existing = categoryMap.get(t.category.id);
            if (existing) existing.amount += t.amount;
            else
              categoryMap.set(t.category.id, {
                id: t.category.id,
                name: t.category.name,
                color: t.category.color ?? "#888780",
                amount: t.amount,
              });
          }

          return (
            <Card key={week.weekNumber} size="sm">
              <CardContent className="flex flex-col gap-3">
                <button
                  type="button"
                  className="flex flex-col gap-2 text-left"
                  onClick={() => setExpandedWeek(isExpanded ? null : week.weekNumber)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium whitespace-nowrap">
                        {week.weekNumber}주차
                      </span>
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatShortDate(week.from)} ~ {formatShortDate(week.to)}
                      </span>
                      {isCurrentWeek && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary">
                          이번주
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-expense">
                      {formatCurrency(weekExpense)}
                    </span>
                  </div>
                </button>

                {isExpanded && <CategoryBarBreakdown items={Array.from(categoryMap.values())} />}

                <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">남은 생활비</span>
                  <span className={cn("font-medium", remaining < 0 && "text-expense")}>
                    {formatCurrency(remaining)}
                  </span>
                </div>

                <Link
                  href={`/weekly/${encodeWeekParam(year, month, week.weekNumber)}`}
                  className="self-end text-xs text-primary hover:underline"
                >
                  상세보기
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
