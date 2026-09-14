"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SummaryCards } from "@/components/summary-cards";
import { CategoryExpenseDonut, type CategorySlice } from "@/components/category-expense-donut";
import { QuickAddModal } from "@/components/quick-add-modal";
import { fetchTransactions, type TransactionWithCategory } from "@/lib/queries";
import { getThisMonthRange, getThisWeekRange, getTodayRange } from "@/lib/date-range";

type Period = "today" | "week" | "month";

const PERIOD_RANGE: Record<Period, () => { from: string; to: string }> = {
  today: getTodayRange,
  week: getThisWeekRange,
  month: getThisMonthRange,
};

const PERIOD_LABEL: Record<Period, string> = {
  today: "오늘",
  week: "이번주",
  month: "이번달",
};

export default function HomePage() {
  const [period, setPeriod] = useState<Period>("today");
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [renderedPeriod, setRenderedPeriod] = useState(period);
  if (period !== renderedPeriod) {
    setRenderedPeriod(period);
    setLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    const range = PERIOD_RANGE[period]();
    fetchTransactions(range).then((data) => {
      if (cancelled) return;
      setTransactions(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [period, refreshKey]);

  const income = useMemo(
    () => transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );
  const expense = useMemo(
    () => transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const categorySlices = useMemo<CategorySlice[]>(() => {
    const map = new Map<string, CategorySlice>();
    for (const t of transactions) {
      if (t.type !== "expense" || !t.category) continue;
      const existing = map.get(t.category.id);
      if (existing) {
        existing.amount += t.amount;
      } else {
        map.set(t.category.id, {
          id: t.category.id,
          name: t.category.name,
          color: t.category.color ?? "#888780",
          amount: t.amount,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4 pb-24 sm:p-6">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <TabsTrigger key={p} value={p}>
              {PERIOD_LABEL[p]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SummaryCards income={income} expense={expense} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">카테고리별 지출</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : (
          <CategoryExpenseDonut data={categorySlices} />
        )}
      </section>

      <Button
        type="button"
        size="icon-lg"
        className="fixed right-6 bottom-6 rounded-full"
        onClick={() => setModalOpen(true)}
      >
        <PlusIcon />
        <span className="sr-only">빠른입력</span>
      </Button>

      <QuickAddModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </main>
  );
}
