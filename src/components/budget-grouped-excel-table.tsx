"use client";

import { Fragment } from "react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { varianceClass, type BudgetReviewRow } from "@/components/budget-review-table";
import { BudgetEditableCells, BudgetItemLabel } from "@/components/budget-excel-table";

interface BudgetGroupedExcelTableProps {
  month: string;
  rows: BudgetReviewRow[];
  onSaved: () => void;
}

function groupKey(row: BudgetReviewRow): string {
  return row.category.report_group || row.category.name;
}

export function BudgetGroupedExcelTable({ month, rows, onSaved }: BudgetGroupedExcelTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground lg:text-base">항목이 없습니다</p>;
  }

  const groups = new Map<string, BudgetReviewRow[]>();
  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const totalBudget = rows.reduce((sum, r) => sum + (r.budget?.amount ?? 0), 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const totalVariance = totalBudget - totalActual;
  const type = rows[0].category.type;

  return (
    <Card size="sm" className="border-primary/30 bg-white">
      <CardContent>
        <table className="w-full table-fixed border-collapse text-xs lg:text-sm">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[19%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground lg:text-xs">
              <th className="py-1.5 px-1 text-left font-medium">분류</th>
              <th className="py-1.5 px-1 text-left font-medium">세부항목</th>
              <th className="py-1.5 px-1 text-left font-medium">예산</th>
              <th className="py-1.5 px-1 text-right font-medium">사용금액</th>
              <th className="py-1.5 px-1 text-right font-medium">오차</th>
              <th className="py-1.5 px-1 text-left font-medium">오차원인</th>
              <th className="py-1.5 px-1 text-left font-medium">피드백</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).map(([group, groupRows]) => {
              const groupBudget = groupRows.reduce((sum, r) => sum + (r.budget?.amount ?? 0), 0);
              const groupActual = groupRows.reduce((sum, r) => sum + r.actual, 0);
              const groupVariance = groupBudget - groupActual;
              const showSubtotal = groupRows.length > 1;

              return (
                <Fragment key={group}>
                  {groupRows.map((row, i) => (
                    <tr key={row.category.id} className="border-b border-border">
                      {i === 0 && (
                        <td className="py-2 px-1 align-middle" rowSpan={groupRows.length}>
                          <span className="truncate">{group}</span>
                        </td>
                      )}
                      <td className="py-2 px-1 align-middle">
                        <BudgetItemLabel row={row} />
                      </td>
                      <BudgetEditableCells month={month} row={row} onSaved={onSaved} />
                    </tr>
                  ))}
                  {showSubtotal && (
                    <tr key={`${group}-subtotal`} className="border-b border-border text-muted-foreground">
                      <td className="py-1.5 px-1" colSpan={2}>
                        {group} 총계
                      </td>
                      <td className="py-1.5 px-1 truncate text-right tabular-nums">
                        {formatCurrency(groupBudget)}
                      </td>
                      <td className="py-1.5 px-1 truncate text-right tabular-nums">
                        {formatCurrency(groupActual)}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-1 truncate text-right tabular-nums",
                          varianceClass(type, groupVariance)
                        )}
                      >
                        {formatCurrency(groupVariance)}
                      </td>
                      <td className="py-1.5 px-1" />
                      <td className="py-1.5 px-1" />
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-xs font-medium lg:text-sm">
              <td className="pt-2 px-1" colSpan={2}>
                총합계
              </td>
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
