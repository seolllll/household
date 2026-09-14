"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { fetchTransactions, type TransactionWithCategory } from "@/lib/queries";
import { formatCurrency } from "@/lib/format";
import { getMonthRange, toDateKey } from "@/lib/date-range";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function buildCalendarCells(year: number, month: number): (string | null)[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = new Date(year, month, 1).getDay();
  const cells: (string | null)[] = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDateKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function heatmapClass(ratio: number): string {
  if (ratio <= 0) return "";
  if (ratio <= 0.25) return "bg-red-100";
  if (ratio <= 0.5) return "bg-red-200";
  if (ratio <= 0.75) return "bg-red-300";
  return "bg-red-400";
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey);

  useEffect(() => {
    let cancelled = false;
    const range = getMonthRange(year, month);
    fetchTransactions(range).then((data) => {
      if (!cancelled) setTransactions(data);
    });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const dailyExpense = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
    }
    return map;
  }, [transactions]);

  const maxExpense = useMemo(
    () => Math.max(0, ...Array.from(dailyExpense.values())),
    [dailyExpense]
  );

  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const selectedTransactions = useMemo(
    () => transactions.filter((t) => t.date === selectedDate),
    [transactions, selectedDate]
  );

  function goToMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDate(null);
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" onClick={() => goToMonth(-1)}>
          <ChevronLeftIcon />
        </Button>
        <h1 className="text-base font-medium">
          {year}년 {month + 1}월
        </h1>
        <Button type="button" variant="ghost" size="icon" onClick={() => goToMonth(1)}>
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} />;
          const day = Number(date.slice(-2));
          const expense = dailyExpense.get(date) ?? 0;
          const ratio = maxExpense > 0 ? expense / maxExpense : 0;
          const isSelected = date === selectedDate;
          const isToday = date === todayKey;
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-lg text-sm ring-1 ring-border transition-colors",
                heatmapClass(ratio),
                isSelected && "ring-2 ring-foreground",
                isToday && "font-semibold"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {selectedDate ? `${selectedDate} 거래 내역` : "날짜를 선택하세요"}
        </h2>
        {selectedDate && selectedTransactions.length === 0 && (
          <p className="text-sm text-muted-foreground">거래 내역이 없습니다</p>
        )}
        <ul className="flex flex-col gap-2">
          {selectedTransactions.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-border"
            >
              <div className="flex flex-col">
                <span>{t.category?.name ?? "미분류"}</span>
                {t.memo && <span className="text-xs text-muted-foreground">{t.memo}</span>}
              </div>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  t.type === "income" ? "text-income" : "text-expense"
                )}
              >
                {formatCurrency(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
