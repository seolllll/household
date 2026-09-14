"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { cn } from "cn";
import { SummaryCards } from "@/components/summary-cards";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { enumerateDateKeys, parseDateKey } from "@/lib/date-range";
import { decodeWeekParam, getMonthWeeks } from "@/lib/week";
import { fetchTransactions, type TransactionWithCategory } from "@/lib/queries";

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

  const weekInfo = useMemo(() => {
    const parsed = decodeWeekParam(week);
    if (!parsed) return null;
    const weeks = getMonthWeeks(parsed.year, parsed.month);
    return weeks.find((w) => w.weekNumber === parsed.weekNumber) ?? null;
  }, [week]);

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!weekInfo) return;
    let cancelled = false;
    fetchTransactions({ from: weekInfo.from, to: weekInfo.to }).then((data) => {
      if (!cancelled) setTransactions(data);
    });
    return () => {
      cancelled = true;
    };
  }, [weekInfo]);

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!weekInfo) return [];
    return enumerateDateKeys(weekInfo.from, weekInfo.to).map((date) => {
      const expense = transactions
        .filter((t) => t.type === "expense" && t.date === date)
        .reduce((sum, t) => sum + t.amount, 0);
      return { date, label: WEEKDAYS[parseDateKey(date).getDay()], expense };
    });
  }, [weekInfo, transactions]);

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

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

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-base font-medium">
        {weekInfo.weekNumber}주차 · {formatShortDate(weekInfo.from)} ~{" "}
        {formatShortDate(weekInfo.to)}
      </h1>

      <SummaryCards income={income} expense={expense} />

      <section className="flex flex-col gap-3">
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
