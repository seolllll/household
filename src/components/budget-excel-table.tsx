"use client";

import { useState } from "react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { upsertBudget } from "@/lib/queries";
import { varianceClass, type BudgetReviewRow } from "@/components/budget-review-table";

interface BudgetExcelTableProps {
  month: string;
  actualLabel: string;
  rows: BudgetReviewRow[];
  onSaved: () => void;
}

export function BudgetItemLabel({ row }: { row: BudgetReviewRow }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: row.category.color ?? "#888780" }}
      />
      <span className="truncate">{row.label || row.category.name}</span>
    </span>
  );
}

/** 예산·실제·오차·오차원인·피드백 5개 셀. 세부항목(및 분류) 셀은 호출부에서 별도로 렌더링. 예산 금액은 예산계획 탭에서만 수정 가능(여기서는 조회 전용). */
export function BudgetEditableCells({
  month,
  row,
  onSaved,
}: {
  month: string;
  row: BudgetReviewRow;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(row.budget?.reason ?? "");
  const [feedback, setFeedback] = useState(row.budget?.feedback ?? "");

  const budgetAmount = row.budget?.amount ?? 0;
  const variance = budgetAmount - row.actual;

  function save(overrides: Partial<{ reason: string; feedback: string }>) {
    upsertBudget(
      row.category.id,
      month,
      row.label ?? "",
      budgetAmount,
      (overrides.reason ?? reason) || null,
      (overrides.feedback ?? feedback) || null
    ).then(onSaved);
  }

  return (
    <>
      <td className="py-2 px-1 text-right tabular-nums align-middle">
        <span className="block truncate">{formatCurrency(budgetAmount)}</span>
      </td>
      <td className="py-2 px-1 text-right tabular-nums align-middle">
        <span className="block truncate">{formatCurrency(row.actual)}</span>
      </td>
      <td className={cn("py-2 px-1 text-right tabular-nums align-middle", varianceClass(row.category.type, variance))}>
        <span className="block truncate">{formatCurrency(variance)}</span>
      </td>
      <td className="py-1 px-1 align-middle">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => save({})} className="w-full" />
      </td>
      <td className="py-1 px-1 align-middle">
        <Input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onBlur={() => save({})}
          className="w-full"
        />
      </td>
    </>
  );
}

function ExcelRow({
  month,
  row,
  onSaved,
}: {
  month: string;
  row: BudgetReviewRow;
  onSaved: () => void;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 px-1 align-middle">
        <BudgetItemLabel row={row} />
      </td>
      <BudgetEditableCells month={month} row={row} onSaved={onSaved} />
    </tr>
  );
}

export function BudgetExcelTable({ month, actualLabel, rows, onSaved }: BudgetExcelTableProps) {
  const totalBudget = rows.reduce((sum, r) => sum + (r.budget?.amount ?? 0), 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const totalVariance = totalBudget - totalActual;
  const type = rows[0]?.category.type ?? "expense";

  const visibleRows = rows.filter((r) => r.actual !== 0);

  if (visibleRows.length === 0) {
    return <p className="text-sm text-muted-foreground lg:text-base">항목이 없습니다</p>;
  }

  return (
    <Card size="sm" className="border-primary/30 bg-white">
      <CardContent>
        <table className="w-full table-fixed border-collapse text-xs lg:text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[19%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground lg:text-xs">
              <th className="py-1.5 px-1 text-left font-medium">세부항목</th>
              <th className="py-1.5 px-1 text-left font-medium">예산</th>
              <th className="py-1.5 px-1 text-right font-medium">{actualLabel}</th>
              <th className="py-1.5 px-1 text-right font-medium">오차</th>
              <th className="py-1.5 px-1 text-left font-medium">오차원인</th>
              <th className="py-1.5 px-1 text-left font-medium">피드백</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <ExcelRow
                key={`${row.category.id}:${row.label ?? ""}`}
                month={month}
                row={row}
                onSaved={onSaved}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="text-xs font-medium lg:text-sm">
              <td className="pt-2 px-1">총계</td>
              <td className="pt-2 px-1 truncate text-right tabular-nums">{formatCurrency(totalBudget)}</td>
              <td className="pt-2 px-1 truncate text-right tabular-nums">{formatCurrency(totalActual)}</td>
              <td className={cn("pt-2 px-1 truncate text-right tabular-nums", varianceClass(type, totalVariance))}>
                {formatCurrency(totalVariance)}
              </td>
              <td className="pt-2 px-1" />
              <td className="pt-2 px-1" />
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
