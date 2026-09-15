"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { SummaryCards } from "@/components/summary-cards";
import { CategoryBarBreakdown, type CategoryBarItem } from "@/components/category-bar-breakdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { enumerateDateKeys, getMonthRange, parseDateKey, toDateKey } from "@/lib/date-range";
import { decodeWeekParam, encodeWeekParam, getMonthWeeks } from "@/lib/week";
import {
  fetchMonthlyBudget,
  fetchTransactions,
  type TransactionWithCategory,
} from "@/lib/queries";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface ChartPoint {
  date: string;
  label: string;
  expense: number;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground">
      <span className="font-medium">
        {formatShortDate(point.date)} ({point.label})
      </span>{" "}
      <span className="text-muted-foreground">{formatCurrency(point.expense)}</span>
    </div>
  );
}

export default function WeeklyDetailPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = use(params);

  const parsedWeek = useMemo(() => decodeWeekParam(week), [week]);
  const weekInfo = useMemo(() => {
    if (!parsedWeek) return null;
    const weeks = getMonthWeeks(parsedWeek.year, parsedWeek.month);
    return weeks.find((w) => w.weekNumber === parsedWeek.weekNumber) ?? null;
  }, [parsedWeek]);

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [cumulativeExpense, setCumulativeExpense] = useState(0);

  // Reset the selected day whenever the viewed week changes (prev/next navigation).
  const [prevWeekKey, setPrevWeekKey] = useState<string | null>(null);
  const weekKey = weekInfo ? `${weekInfo.from}_${weekInfo.to}` : null;
  if (weekKey !== prevWeekKey) {
    setPrevWeekKey(weekKey);
    setSelectedDate(null);
  }

  useEffect(() => {
    if (!weekInfo || !parsedWeek) return;
    let cancelled = false;
    const monthRange = getMonthRange(parsedWeek.year, parsedWeek.month);
    const monthKey = `${parsedWeek.year}-${String(parsedWeek.month + 1).padStart(2, "0")}-01`;
    Promise.all([
      fetchTransactions({ from: weekInfo.from, to: weekInfo.to }),
      fetchTransactions({ from: monthRange.from, to: weekInfo.to }),
      fetchMonthlyBudget(monthKey),
    ]).then(([weekTx, cumulativeTx, budget]) => {
      if (cancelled) return;
      setTransactions(weekTx);
      setCumulativeExpense(
        cumulativeTx
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + t.amount, 0)
      );
      setBudgetAmount(budget?.amount ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [weekInfo, parsedWeek]);

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!weekInfo) return [];
    return enumerateDateKeys(weekInfo.from, weekInfo.to).map((date) => {
      const expense = transactions
        .filter((t) => t.type === "expense" && t.date === date)
        .reduce((sum, t) => sum + t.amount, 0);
      return { date, label: WEEKDAYS[parseDateKey(date).getDay()], expense };
    });
  }, [weekInfo, transactions]);

  const categoryItems = useMemo<CategoryBarItem[]>(() => {
    const map = new Map<string, CategoryBarItem>();
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
        });
    }
    return Array.from(map.values());
  }, [transactions]);

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const remaining = budgetAmount - cumulativeExpense;

  const selectedTransactions = transactions.filter(
    (t) => t.type === "expense" && t.date === selectedDate
  );

  if (!weekInfo) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">잘못된 주차입니다.</p>
      </main>
    );
  }

  const prevLink = (() => {
    const d = parseDateKey(weekInfo.from);
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = toDateKey(d);
    const weeks = getMonthWeeks(year, month);
    const target = weeks.find((w) => w.to === key) ?? weeks[weeks.length - 1];
    return encodeWeekParam(year, month, target.weekNumber);
  })();
  const nextLink = (() => {
    const d = parseDateKey(weekInfo.to);
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = toDateKey(d);
    const weeks = getMonthWeeks(year, month);
    const target = weeks.find((w) => w.from === key) ?? weeks[0];
    return encodeWeekParam(year, month, target.weekNumber);
  })();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/weekly/${prevLink}`}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
        <h1 className="text-base font-medium">
          {weekInfo.weekNumber}주차 · {formatShortDate(weekInfo.from)} ~{" "}
          {formatShortDate(weekInfo.to)}
        </h1>
        <Link
          href={`/weekly/${nextLink}`}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>

      <SummaryCards
        income={income}
        expense={expense}
        firstCard={{ label: "잔액", value: remaining + expense }}
        lastCard={{ label: "남은 생활비", value: remaining }}
      />

      <section className="flex flex-col gap-3">
        <Accordion defaultValue={["category"]}>
          <AccordionItem value="category">
            <AccordionTrigger className="text-sm font-medium text-muted-foreground">
              카테고리별 지출
            </AccordionTrigger>
            <AccordionContent>
              <CategoryBarBreakdown items={categoryItems} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <h2 className="text-sm font-medium text-muted-foreground">요일별 지출</h2>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
              <Bar
                dataKey="expense"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                onClick={(data) => setSelectedDate((data.payload as ChartPoint).date)}
              >
                {chartData.map((point) => (
                  <Cell
                    key={point.date}
                    fill="var(--expense)"
                    stroke={point.date === selectedDate ? "var(--foreground)" : "transparent"}
                    strokeWidth={2}
                    cursor="pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {selectedDate ? `${formatShortDate(selectedDate)} 거래 내역` : "막대를 선택하세요"}
        </h2>
        {selectedDate && selectedTransactions.length === 0 && (
          <p className="text-sm text-muted-foreground">지출 내역이 없습니다</p>
        )}
        <ul className="flex flex-col gap-2">
          {selectedTransactions.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-border"
            >
              <div className="flex flex-col">
                <span>{t.memo || t.category?.name || "지출"}</span>
                {t.memo && (
                  <span className="text-xs text-muted-foreground">
                    {t.category?.name ?? "미분류"}
                  </span>
                )}
              </div>
              <span className={cn("shrink-0 font-medium tabular-nums text-expense")}>
                {formatCurrency(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
