"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getRecentMonthRanges, getRecentWeekRanges, parseDateKey } from "@/lib/date-range";
import { fetchTransactions, type TransactionWithCategory } from "@/lib/queries";

type TrendPeriod = "weekly" | "monthly";

interface PeriodBucket {
  key: string;
  label: string;
  fullLabel: string;
  from: string;
  to: string;
  expense: number;
  income: number;
}

const WEEK_COUNT = 8;
const MONTH_COUNT = 6;

function statusColor(ratio: number): string {
  if (ratio > 1) return "var(--expense)";
  if (ratio >= 0.8) return "var(--budget-warning)";
  return "var(--income)";
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PeriodBucket }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground">
      <span className="font-medium">{point.fullLabel}</span>{" "}
      <span className="text-muted-foreground">{formatCurrency(point.expense)}</span>
    </div>
  );
}

export default function StatsPage() {
  const today = useMemo(() => new Date(), []);

  const weekRanges = useMemo(() => getRecentWeekRanges(WEEK_COUNT, today), [today]);
  const monthRanges = useMemo(() => getRecentMonthRanges(MONTH_COUNT, today), [today]);

  const overallRange = useMemo(() => {
    const firstWeek = weekRanges[0];
    const firstMonth = monthRanges[0];
    const lastWeek = weekRanges[weekRanges.length - 1];
    const lastMonth = monthRanges[monthRanges.length - 1];
    return {
      from: firstWeek.from < firstMonth.from ? firstWeek.from : firstMonth.from,
      to: lastWeek.to > lastMonth.to ? lastWeek.to : lastMonth.to,
    };
  }, [weekRanges, monthRanges]);

  const [period, setPeriod] = useState<TrendPeriod>("weekly");
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchTransactions(overallRange).then((tx) => {
      if (cancelled) return;
      setTransactions(tx);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [overallRange]);

  const weeklyBuckets = useMemo<PeriodBucket[]>(
    () =>
      weekRanges.map((range) => {
        const inRange = transactions.filter((t) => t.date >= range.from && t.date <= range.to);
        return {
          key: range.from,
          label: formatShortDate(range.to),
          fullLabel: `${formatShortDate(range.from)} ~ ${formatShortDate(range.to)}`,
          from: range.from,
          to: range.to,
          expense: inRange
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0),
          income: inRange
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0),
        };
      }),
    [weekRanges, transactions]
  );

  const monthlyBuckets = useMemo<PeriodBucket[]>(
    () =>
      monthRanges.map((range) => {
        const inRange = transactions.filter((t) => t.date >= range.from && t.date <= range.to);
        const d = parseDateKey(range.from);
        return {
          key: range.from,
          label: `${d.getMonth() + 1}월`,
          fullLabel: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
          from: range.from,
          to: range.to,
          expense: inRange
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0),
          income: inRange
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0),
        };
      }),
    [monthRanges, transactions]
  );

  const buckets = period === "weekly" ? weeklyBuckets : monthlyBuckets;
  const currentBucket = buckets[buckets.length - 1];
  const previousBucket = buckets[buckets.length - 2];

  const incomeRatio =
    currentBucket && currentBucket.income > 0 ? currentBucket.expense / currentBucket.income : null;

  const hasPreviousData = Boolean(previousBucket && previousBucket.expense > 0);
  const diff = currentBucket && previousBucket ? currentBucket.expense - previousBucket.expense : 0;
  const changePct =
    hasPreviousData && previousBucket ? Math.round((diff / previousBucket.expense) * 100) : null;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* 1. 기간별 지출 추이 */}
          <Card size="sm" className="border-primary/30 bg-white">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">기간별 지출 추이</h2>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="xs"
                    variant={period === "weekly" ? "default" : "outline"}
                    onClick={() => setPeriod("weekly")}
                  >
                    주별
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={period === "monthly" ? "default" : "outline"}
                    onClick={() => setPeriod("monthly")}
                  >
                    월별
                  </Button>
                </div>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={buckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--border)" }} />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      stroke="var(--expense)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--expense)", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 2. 수입 대비 지출 비율 */}
          <Card size="sm" className="border-primary/30 bg-white">
            <CardContent className="flex flex-col items-center gap-3">
              <h2 className="self-start text-sm font-medium text-muted-foreground">
                수입 대비 지출 비율
              </h2>
              {incomeRatio === null ? (
                <p className="py-6 text-sm text-muted-foreground">수입 데이터 없음</p>
              ) : (
                <>
                  <div className="relative size-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "expense", value: Math.min(incomeRatio, 1) },
                            { name: "remaining", value: Math.max(1 - incomeRatio, 0) },
                          ]}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                          innerRadius={48}
                          outerRadius={64}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          <Cell fill={statusColor(incomeRatio)} />
                          <Cell fill="var(--border)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-semibold tracking-tight">
                        {Math.round(incomeRatio * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {currentBucket.fullLabel} 수입 {formatCurrency(currentBucket.income)} 중 지출{" "}
                    {formatCurrency(currentBucket.expense)} ({Math.round(incomeRatio * 100)}%)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 3. 전월/전주 대비 증감률 */}
          <Card size="sm" className="border-primary/30 bg-white">
            <CardContent className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {period === "weekly" ? "전주" : "전월"} 대비
              </span>
              {!hasPreviousData || changePct === null ? (
                <span className="text-sm text-muted-foreground">비교 데이터 없음</span>
              ) : diff === 0 ? (
                <span className="text-sm font-medium text-muted-foreground">변화 없음</span>
              ) : (
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    diff > 0 ? "text-expense" : "text-income"
                  )}
                >
                  {diff > 0 ? "▲" : "▼"} {formatCurrency(Math.abs(diff))} ({diff > 0 ? "+" : "-"}
                  {Math.abs(changePct)}%)
                </span>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
