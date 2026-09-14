"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { SummaryCards } from "@/components/summary-cards";
import { BudgetProgressBar } from "@/components/budget-progress-bar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { encodeMonthParam, getMonthRange, parseMonthParam } from "@/lib/date-range";
import { fetchMonthlyBudget, fetchTransactions, type TransactionWithCategory } from "@/lib/queries";

interface CategorySummary {
  id: string;
  name: string;
  color: string;
  amount: number;
  prevAmount: number;
}

function ChangeBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) {
    if (current === 0) return null;
    return <span className="text-xs font-medium text-expense">신규</span>;
  }
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return <span className="text-xs text-muted-foreground">0%</span>;
  const isUp = pct > 0;
  return (
    <span
      className={cn(
        "text-xs font-medium whitespace-nowrap",
        isUp ? "text-expense" : "text-income"
      )}
    >
      {isUp ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export default function MonthlyPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: monthParam } = use(params);
  const parsed = useMemo(() => parseMonthParam(monthParam), [monthParam]);

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<TransactionWithCategory[]>([]);
  const [budgetAmount, setBudgetAmount] = useState(0);

  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    const range = getMonthRange(parsed.year, parsed.month);
    const prevDate = new Date(parsed.year, parsed.month - 1, 1);
    const prevRange = getMonthRange(prevDate.getFullYear(), prevDate.getMonth());
    const budgetKey = `${parsed.year}-${String(parsed.month + 1).padStart(2, "0")}-01`;

    Promise.all([
      fetchTransactions(range),
      fetchTransactions(prevRange),
      fetchMonthlyBudget(budgetKey),
    ]).then(([tx, prevTx, budget]) => {
      if (cancelled) return;
      setTransactions(tx);
      setPrevTransactions(prevTx);
      setBudgetAmount(budget?.amount ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [parsed]);

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const carryover = budgetAmount - expense;

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const map = new Map<string, CategorySummary>();
    for (const t of transactions) {
      if (t.type !== "expense" || !t.category) continue;
      const existing = map.get(t.category.id);
      if (existing) existing.amount += t.amount;
      else
        map.set(t.category.id, {
          id: t.category.id,
          name: t.category.name,
          color: t.category.color ?? "#888780",
          amount: t.amount,
          prevAmount: 0,
        });
    }
    for (const t of prevTransactions) {
      if (t.type !== "expense" || !t.category) continue;
      const existing = map.get(t.category.id);
      if (existing) existing.prevAmount += t.amount;
      else
        map.set(t.category.id, {
          id: t.category.id,
          name: t.category.name,
          color: t.category.color ?? "#888780",
          amount: 0,
          prevAmount: t.amount,
        });
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [transactions, prevTransactions]);

  if (!parsed) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">잘못된 월입니다.</p>
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
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/monthly/${prevLink}`}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
        <h1 className="text-base font-medium">
          {parsed.year}년 {parsed.month + 1}월 정산
        </h1>
        <Link
          href={`/monthly/${nextLink}`}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>

      <SummaryCards income={income} expense={expense} />

      <Card size="sm" className="border-primary/30 bg-white">
        <CardContent>
          <p className="mb-2 text-xs text-muted-foreground">전체 예산 대비 지출</p>
          <BudgetProgressBar spent={expense} budget={budgetAmount} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">카테고리별 지출</h2>
        <Card size="sm" className="border-primary/30 bg-white">
          <CardContent>
            {categorySummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">지출 내역이 없습니다</p>
            ) : (
              <Accordion>
                {categorySummaries.map((cat) => {
                  const dailyItems = transactions
                    .filter((t) => t.type === "expense" && t.category?.id === cat.id)
                    .sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <AccordionItem key={cat.id} value={cat.id}>
                      <AccordionTrigger>
                        <span className="flex flex-1 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span>{cat.name}</span>
                        </span>
                        <span className="flex items-center gap-2 pr-2">
                          <ChangeBadge current={cat.amount} prev={cat.prevAmount} />
                          <span className="tabular-nums">{formatCurrency(cat.amount)}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="flex flex-col gap-1.5">
                          {dailyItems.map((t) => (
                            <li
                              key={t.id}
                              className="flex items-center justify-between text-xs text-muted-foreground"
                            >
                              <span>
                                {formatShortDate(t.date)}
                                {t.memo ? ` · ${t.memo}` : ""}
                              </span>
                              <span className="tabular-nums text-expense">
                                {formatCurrency(t.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </section>

      <Card size="sm" className="border-primary/30 bg-white">
        <CardContent className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">다음달로 이월되는 금액</span>
          <span
            className={cn(
              "text-lg font-semibold tracking-tight sm:text-lg",
              carryover < 0 && "text-expense"
            )}
          >
            {formatCurrency(carryover)}
          </span>
        </CardContent>
      </Card>
    </main>
  );
}
