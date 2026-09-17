"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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
import { DownloadIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExcelDownloadDialog } from "@/components/excel-download-dialog";
import { formatCurrency } from "@/lib/format";
import { getRecentMonthRanges, parseDateKey } from "@/lib/date-range";
import {
  fetchAssetItems,
  fetchAssetSnapshots,
  fetchTransactions,
  type TransactionWithCategory,
} from "@/lib/queries";
import type { AssetItem, AssetSnapshot } from "@/types/database";

const LIQUID_GROUP = "유동성 자산";
const INVESTMENT_SUBGROUP = "투자";
const INVESTMENT_COLORS = ["#2a78d6", "#1baf7a", "#e87ba4"];

interface InvestmentBucket {
  key: string;
  label: string;
  fullLabel: string;
  [itemId: string]: string | number;
}

function InvestmentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload: InvestmentBucket }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground">
      <p className="font-medium">{payload[0].payload.fullLabel}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name} {formatCurrency(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

interface MonthlyBucket {
  key: string;
  label: string;
  fullLabel: string;
  from: string;
  to: string;
  expense: number;
  income: number;
}

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
  payload?: { payload: MonthlyBucket }[];
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

interface CategoryRankItem {
  id: string;
  rank: number;
  name: string;
  color: string;
  amount: number;
  ratio: number;
}

function CategoryRankTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CategoryRankItem }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground">
      <span className="font-medium">{point.name}</span>{" "}
      <span className="text-muted-foreground">
        {formatCurrency(point.amount)} ({point.ratio.toFixed(1)}%)
      </span>
    </div>
  );
}

export default function StatsPage() {
  const today = useMemo(() => new Date(), []);

  const monthRanges = useMemo(() => getRecentMonthRanges(MONTH_COUNT, today), [today]);

  const overallRange = useMemo(
    () => ({ from: monthRanges[0].from, to: monthRanges[monthRanges.length - 1].to }),
    [monthRanges]
  );

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [assetItems, setAssetItems] = useState<AssetItem[]>([]);
  const [assetSnapshotsByMonth, setAssetSnapshotsByMonth] = useState<Record<string, AssetSnapshot[]>>({});
  const [assetLoading, setAssetLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAssetItems(), Promise.all(monthRanges.map((r) => fetchAssetSnapshots(r.from)))]).then(
      ([items, snapshotsByRange]) => {
        if (cancelled) return;
        setAssetItems(items);
        const map: Record<string, AssetSnapshot[]> = {};
        monthRanges.forEach((r, i) => {
          map[r.from] = snapshotsByRange[i];
        });
        setAssetSnapshotsByMonth(map);
        setAssetLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [monthRanges]);

  const investmentItems = useMemo(
    () => assetItems.filter((item) => item.group_name === LIQUID_GROUP && item.subgroup === INVESTMENT_SUBGROUP),
    [assetItems]
  );

  const investmentBuckets = useMemo<InvestmentBucket[]>(
    () =>
      monthRanges.map((range) => {
        const d = parseDateKey(range.from);
        const snapshots = assetSnapshotsByMonth[range.from] ?? [];
        const amountByItem = new Map(snapshots.map((s) => [s.asset_item_id, s.amount]));
        const bucket: InvestmentBucket = {
          key: range.from,
          label: `${d.getMonth() + 1}월`,
          fullLabel: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
        };
        for (const item of investmentItems) {
          bucket[item.id] = amountByItem.get(item.id) ?? 0;
        }
        return bucket;
      }),
    [monthRanges, assetSnapshotsByMonth, investmentItems]
  );
  const hasAssetData = investmentBuckets.some((bucket) =>
    investmentItems.some((item) => (bucket[item.id] as number) !== 0)
  );

  const monthlyBuckets = useMemo<MonthlyBucket[]>(
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

  const buckets = monthlyBuckets;
  const selectedBucketIndex = selectedIndex ?? buckets.length - 1;
  const selectedBucket = buckets[selectedBucketIndex];
  const compareBucket = buckets[selectedBucketIndex - 1];

  const incomeRatio =
    selectedBucket && selectedBucket.income > 0 ? selectedBucket.expense / selectedBucket.income : null;

  const hasPreviousData = Boolean(compareBucket && compareBucket.expense > 0);
  const diff = selectedBucket && compareBucket ? selectedBucket.expense - compareBucket.expense : 0;
  const changePct =
    hasPreviousData && compareBucket ? Math.round((diff / compareBucket.expense) * 100) : null;

  const categoryRanking = useMemo(() => {
    if (!selectedBucket) return [];
    const inRange = transactions.filter(
      (t) => t.type === "expense" && t.date >= selectedBucket.from && t.date <= selectedBucket.to
    );
    const totalExpense = inRange.reduce((sum, t) => sum + t.amount, 0);
    const map = new Map<string, { id: string; name: string; color: string; amount: number }>();
    for (const t of inRange) {
      const id = t.category?.id ?? "__uncategorized__";
      const existing = map.get(id);
      if (existing) existing.amount += t.amount;
      else
        map.set(id, {
          id,
          name: t.category?.name ?? "미분류",
          color: t.category?.color ?? "#888780",
          amount: t.amount,
        });
    }
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((c, i) => ({ ...c, rank: i + 1, ratio: totalExpense > 0 ? (c.amount / totalExpense) * 100 : 0 }));
  }, [transactions, selectedBucket]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6 lg:max-w-4xl lg:gap-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-medium lg:text-xl">통계</h1>
        <Button type="button" variant="ghost" size="icon" onClick={() => setDownloadOpen(true)}>
          <DownloadIcon />
          <span className="sr-only">엑셀 다운로드</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* 1. 월별 지출 추이 */}
          <Card size="sm" className="border-primary/30 bg-white">
            <CardContent className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground lg:text-base">
                월별 지출 추이
              </h2>
              <div className="h-48 w-full cursor-pointer lg:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={buckets}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                    onClick={(e) => {
                      const index = Number(e?.activeTooltipIndex);
                      if (Number.isInteger(index) && buckets[index]) setSelectedIndex(index);
                    }}
                  >
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
                      dot={(props: { cx?: number; cy?: number; index?: number }) => {
                        const isSelected = props.index === selectedBucketIndex;
                        return (
                          <circle
                            key={`dot-${props.index}`}
                            cx={props.cx ?? 0}
                            cy={props.cy ?? 0}
                            r={isSelected ? 5 : 3}
                            fill="var(--expense)"
                            stroke={isSelected ? "var(--foreground)" : "none"}
                            strokeWidth={isSelected ? 2 : 0}
                          />
                        );
                      }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground lg:text-sm">
                그래프를 탭하면 해당 월 기준으로 아래 통계가 바뀝니다
              </p>
            </CardContent>
          </Card>

          {/* 2. 수입 대비 지출 비율 */}
          <Card size="sm" className="border-primary/30 bg-white">
            <CardContent className="flex flex-col items-center gap-3">
              <h2 className="self-start text-sm font-medium text-muted-foreground lg:text-base">
                수입 대비 지출 비율
              </h2>
              {incomeRatio === null ? (
                <p className="py-6 text-sm text-muted-foreground lg:text-base">수입 데이터 없음</p>
              ) : (
                <>
                  <div className="relative size-36 lg:size-44">
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
                          innerRadius="67%"
                          outerRadius="89%"
                          stroke="none"
                          isAnimationActive={false}
                        >
                          <Cell fill={statusColor(incomeRatio)} />
                          <Cell fill="var(--border)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-semibold tracking-tight lg:text-2xl">
                        {Math.round(incomeRatio * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground lg:text-sm">
                    {selectedBucket.fullLabel} 수입 {formatCurrency(selectedBucket.income)} 중 지출{" "}
                    {formatCurrency(selectedBucket.expense)} ({Math.round(incomeRatio * 100)}%)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 3. 전월 대비 증감률 */}
          <Card size="sm" className="border-primary/30 bg-white">
            <CardContent className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground lg:text-sm">전월 대비</span>
              {!hasPreviousData || changePct === null ? (
                <span className="text-sm text-muted-foreground lg:text-base">비교 데이터 없음</span>
              ) : diff === 0 ? (
                <span className="text-sm font-medium text-muted-foreground lg:text-base">
                  변화 없음
                </span>
              ) : (
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums lg:text-base",
                    diff > 0 ? "text-expense" : "text-income"
                  )}
                >
                  {diff > 0 ? "▲" : "▼"} {formatCurrency(Math.abs(diff))}
                </span>
              )}
            </CardContent>
          </Card>

          {/* 4. 카테고리별 지출 비중 랭킹 (선택된 월 기준, Top 10) */}
          <Card size="sm" className="border-primary/30 bg-white">
            <CardContent className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground lg:text-base">
                카테고리별 지출 비중 {selectedBucket ? `· ${selectedBucket.fullLabel}` : ""}
              </h2>
              {categoryRanking.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground lg:text-base">
                  지출 내역이 없습니다
                </p>
              ) : (
                <>
                  <div className="h-48 w-full lg:h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryRanking} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <XAxis
                          dataKey="rank"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                        />
                        <Tooltip content={<CategoryRankTooltip />} cursor={{ fill: "var(--muted)" }} />
                        <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          {categoryRanking.map((c) => (
                            <Cell key={c.id} fill={c.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {categoryRanking.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 text-xs lg:text-sm">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">
                            {c.rank}
                          </span>
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(c.amount)}{" "}
                          <span className="text-muted-foreground">({c.ratio.toFixed(1)}%)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {/* 5. 투자 자산 추이 (유동성 자산 > 투자 내역별) */}
          <Card size="sm" className="border-primary/30 bg-white">
            <CardContent className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground lg:text-base">투자 자산 추이</h2>
              {assetLoading ? (
                <Skeleton className="h-48 w-full rounded-2xl lg:h-64" />
              ) : !hasAssetData ? (
                <p className="py-6 text-center text-sm text-muted-foreground lg:text-base">
                  투자 내역 데이터가 없습니다
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground lg:text-sm">
                    {investmentItems.map((item, i) => (
                      <span key={item.id} className="flex items-center gap-1.5">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: INVESTMENT_COLORS[i % INVESTMENT_COLORS.length] }}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                  <div className="h-48 w-full lg:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={investmentBuckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                        />
                        <Tooltip content={<InvestmentTooltip />} cursor={{ stroke: "var(--border)" }} />
                        {investmentItems.map((item, i) => {
                          const color = INVESTMENT_COLORS[i % INVESTMENT_COLORS.length];
                          return (
                            <Line
                              key={item.id}
                              type="monotone"
                              dataKey={item.id}
                              name={item.label}
                              stroke={color}
                              strokeWidth={2}
                              dot={{ r: 3, fill: color, strokeWidth: 0 }}
                              activeDot={{ r: 5 }}
                              isAnimationActive={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ExcelDownloadDialog open={downloadOpen} onOpenChange={setDownloadOpen} />
    </main>
  );
}
