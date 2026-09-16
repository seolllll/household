"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RemainingBudgetBar } from "@/components/remaining-budget-bar";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getMonthRange, toDateKey } from "@/lib/date-range";
import { encodeWeekParam, getMonthWeeks, isWeeklyBudgetExpense } from "@/lib/week";
import {
  fetchMonthlyBudget,
  fetchTransactions,
  fetchWeeklyBudgetItems,
  type TransactionWithCategory,
} from "@/lib/queries";

export default function WeeklyPage() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [weeklyBudgetMap, setWeeklyBudgetMap] = useState<Record<string, number>>({});

  function goToMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  useEffect(() => {
    let cancelled = false;
    const range = getMonthRange(year, month);
    Promise.all([
      fetchTransactions(range),
      fetchMonthlyBudget(monthKey),
      fetchWeeklyBudgetItems(range),
    ]).then(([tx, budget, weeklyBudgetItemRows]) => {
      if (cancelled) return;
      setTransactions(tx);
      setBudgetAmount(budget?.amount ?? 0);
      const totals: Record<string, number> = {};
      for (const item of weeklyBudgetItemRows) {
        totals[item.week_start] = (totals[item.week_start] ?? 0) + item.amount;
      }
      setWeeklyBudgetMap(totals);
    });
    return () => {
      cancelled = true;
    };
  }, [year, month, monthKey]);

  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6 lg:max-w-4xl lg:gap-6 lg:p-8">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" onClick={() => goToMonth(-1)}>
          <ChevronLeftIcon />
        </Button>
        <h1 className="text-base font-medium lg:text-xl">
          {year}년 {month + 1}월
        </h1>
        <Button type="button" variant="ghost" size="icon" onClick={() => goToMonth(1)}>
          <ChevronRightIcon />
        </Button>
      </div>

      <Card size="sm" className="border-primary/30 bg-white">
        <CardContent className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground lg:text-sm">{month + 1}월 생활비</span>
          <span className="text-lg font-semibold tracking-tight lg:text-2xl">
            {formatCurrency(budgetAmount)}
          </span>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {weeks.map((week) => {
          const isCurrentWeek = todayKey >= week.from && todayKey <= week.to;

          const weekExpense = transactions
            .filter((t) => isWeeklyBudgetExpense(t) && t.date >= week.from && t.date <= week.to)
            .reduce((sum, t) => sum + t.amount, 0);

          const cumulativeExpense = transactions
            .filter((t) => isWeeklyBudgetExpense(t) && t.date <= week.to)
            .reduce((sum, t) => sum + t.amount, 0);
          const remaining = budgetAmount - cumulativeExpense;

          return (
            <Link
              key={week.weekNumber}
              href={`/weekly/${encodeWeekParam(year, month, week.weekNumber)}`}
              className="block"
            >
              <Card size="sm" className="border-primary/30 bg-white">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium whitespace-nowrap lg:text-base">
                        {week.weekNumber}주차
                      </span>
                      <span className="text-xs whitespace-nowrap text-muted-foreground lg:text-sm">
                        {formatShortDate(week.from)} ~ {formatShortDate(week.to)}
                      </span>
                      {isCurrentWeek && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary lg:text-xs">
                          이번주
                        </span>
                      )}
                    </div>
                    <span className="flex shrink-0 items-baseline gap-1">
                      <span className="text-sm font-semibold text-expense lg:text-base">
                        {formatCurrency(weekExpense)}
                      </span>
                      {weeklyBudgetMap[week.from] != null && (
                        <span className="text-xs text-muted-foreground lg:text-sm">
                          / {formatCurrency(weeklyBudgetMap[week.from])}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="border-t border-border pt-2">
                    <p className="mb-1.5 text-xs text-muted-foreground lg:text-sm">남은 생활비</p>
                    <RemainingBudgetBar remaining={remaining} budget={budgetAmount} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
