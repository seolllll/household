"use client";

import { Fragment, useState } from "react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewInputCell } from "@/components/review-input-cell";
import { formatCurrency } from "@/lib/format";
import { FIXED_EXPENSE_OTHER_LABEL } from "@/lib/budget-rows";
import { matchesSubCategory } from "@/lib/sub-category-memo";
import {
  updateVariableBudgetItemReview,
  upsertBudget,
  type BudgetWithCategory,
  type VariableBudgetItemWithCategory,
} from "@/lib/queries";
import type { TransactionWithCategory } from "@/lib/queries";
import type { Category } from "@/types/database";
import { varianceClass } from "@/components/budget-review-table";

interface VariableBudgetItemReviewTableProps {
  month: string;
  categories: Category[];
  items: VariableBudgetItemWithCategory[];
  budgets: BudgetWithCategory[];
  transactions: TransactionWithCategory[];
  onSaved: () => void;
}

export function actualForItem(item: VariableBudgetItemWithCategory, transactions: TransactionWithCategory[]): number {
  return transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.category?.id === item.category_id &&
        matchesSubCategory(t.memo, item.memo)
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

function ItemRow({
  item,
  actual,
  onSaved,
}: {
  item: VariableBudgetItemWithCategory;
  actual: number;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(item.reason ?? "");
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const variance = item.amount - actual;

  function save(overrides: Partial<{ reason: string; feedback: string }>) {
    updateVariableBudgetItemReview(
      item.id,
      (overrides.reason ?? reason) || null,
      (overrides.feedback ?? feedback) || null
    ).then(onSaved);
  }

  return (
    <tr className="border-b border-border">
      <td className="py-2 px-1 align-middle">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate">{item.memo || item.category?.name || "미분류"}</span>
          {item.detail_memo && (
            <span className="truncate text-xs text-muted-foreground">{item.detail_memo}</span>
          )}
        </span>
      </td>
      <td className="py-2 px-1 text-right tabular-nums align-middle">
        <span className="block truncate">{formatCurrency(item.amount)}</span>
      </td>
      <td className="py-2 px-1 text-right tabular-nums align-middle">
        <span className="block truncate">{formatCurrency(actual)}</span>
      </td>
      <td className={cn("py-2 px-1 text-right tabular-nums align-middle", varianceClass("expense", variance))}>
        <span className="block truncate">{formatCurrency(variance)}</span>
      </td>
      <td className="py-1 px-1 align-middle">
        <ReviewInputCell value={reason} onChange={setReason} onBlur={() => save({})} />
      </td>
      <td className="py-1 px-1 align-middle">
        <ReviewInputCell value={feedback} onChange={setFeedback} onBlur={() => save({})} expandable />
      </td>
    </tr>
  );
}

/** 예산계획에 없거나 항목 메모와 매칭되지 않은 실제 지출을 카테고리 단위로 자동 집계하는 행. */
function RemainderRow({
  month,
  category,
  label,
  amount,
  actual,
  reason,
  feedback,
  onSaved,
}: {
  month: string;
  category: Category;
  label: string | null;
  amount: number;
  actual: number;
  reason: string | null;
  feedback: string | null;
  onSaved: () => void;
}) {
  const [reasonInput, setReasonInput] = useState(reason ?? "");
  const [feedbackInput, setFeedbackInput] = useState(feedback ?? "");
  const variance = amount - actual;

  function save(overrides: Partial<{ reason: string; feedback: string }>) {
    upsertBudget(
      category.id,
      month,
      FIXED_EXPENSE_OTHER_LABEL,
      amount,
      (overrides.reason ?? reasonInput) || null,
      (overrides.feedback ?? feedbackInput) || null
    ).then(onSaved);
  }

  return (
    <tr className="border-b border-border text-muted-foreground">
      <td className="py-2 px-1 align-middle">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate">{label || category.name}</span>
          <span className="shrink-0 text-[10px]">자동집계</span>
        </span>
      </td>
      <td className="py-2 px-1 text-right tabular-nums align-middle">
        <span className="block truncate">{formatCurrency(amount)}</span>
      </td>
      <td className="py-2 px-1 text-right tabular-nums align-middle">
        <span className="block truncate">{formatCurrency(actual)}</span>
      </td>
      <td className={cn("py-2 px-1 text-right tabular-nums align-middle", varianceClass("expense", variance))}>
        <span className="block truncate">{formatCurrency(variance)}</span>
      </td>
      <td className="py-1 px-1 align-middle">
        <ReviewInputCell value={reasonInput} onChange={setReasonInput} onBlur={() => save({})} />
      </td>
      <td className="py-1 px-1 align-middle">
        <ReviewInputCell value={feedbackInput} onChange={setFeedbackInput} onBlur={() => save({})} expandable />
      </td>
    </tr>
  );
}

export interface CategoryGroup {
  category: Category;
  items: VariableBudgetItemWithCategory[];
  showRemainder: boolean;
  remainderLabel: string | null;
  remainderAmount: number;
  remainderActual: number;
  remainderReason: string | null;
  remainderFeedback: string | null;
  budget: number;
  actual: number;
}

export function buildGroups(
  categories: Category[],
  items: VariableBudgetItemWithCategory[],
  budgets: BudgetWithCategory[],
  transactions: TransactionWithCategory[]
): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const category of categories) {
    const categoryItems = items.filter((i) => i.category_id === category.id);
    const categoryTx = transactions.filter((t) => t.type === "expense" && t.category?.id === category.id);
    const totalActual = categoryTx.reduce((sum, t) => sum + t.amount, 0);
    const matchedActual = categoryItems.reduce((sum, i) => sum + actualForItem(i, transactions), 0);
    const remainderActual = totalActual - matchedActual;
    const remainderBudget = budgets.find((b) => b.category_id === category.id && b.label === FIXED_EXPENSE_OTHER_LABEL);
    const showRemainder = remainderActual !== 0 || !!remainderBudget?.reason || !!remainderBudget?.feedback;

    if (categoryItems.length === 0 && !showRemainder) continue;

    const itemBudget = categoryItems.reduce((sum, i) => sum + i.amount, 0);
    const remainderAmount = remainderBudget?.amount ?? 0;

    groups.push({
      category,
      items: categoryItems,
      showRemainder,
      remainderLabel: categoryItems.length === 0 ? null : FIXED_EXPENSE_OTHER_LABEL,
      remainderAmount,
      remainderActual,
      remainderReason: remainderBudget?.reason ?? null,
      remainderFeedback: remainderBudget?.feedback ?? null,
      budget: itemBudget + (showRemainder ? remainderAmount : 0),
      actual: matchedActual + (showRemainder ? remainderActual : 0),
    });
  }
  return groups;
}

export function VariableBudgetItemReviewTable({
  month,
  categories,
  items,
  budgets,
  transactions,
  onSaved,
}: VariableBudgetItemReviewTableProps) {
  const groups = buildGroups(categories, items, budgets, transactions);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground lg:text-base">항목이 없습니다</p>;
  }

  const totalBudget = groups.reduce((sum, g) => sum + g.budget, 0);
  const totalActual = groups.reduce((sum, g) => sum + g.actual, 0);
  const totalVariance = totalBudget - totalActual;

  return (
    <Card size="sm" className="border-primary/30 bg-white">
      <CardContent>
        <table className="w-full table-fixed border-collapse text-xs lg:text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground lg:text-xs">
              <th className="py-1.5 px-1 text-left font-medium">항목</th>
              <th className="py-1.5 px-1 text-right font-medium">예산</th>
              <th className="py-1.5 px-1 text-right font-medium">사용금액</th>
              <th className="py-1.5 px-1 text-right font-medium">오차</th>
              <th className="py-1.5 px-1 text-left font-medium">오차원인</th>
              <th className="py-1.5 px-1 text-left font-medium">피드백</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const groupVariance = group.budget - group.actual;

              return (
                <Fragment key={group.category.id}>
                  {group.items.map((item) => (
                    <ItemRow key={item.id} item={item} actual={actualForItem(item, transactions)} onSaved={onSaved} />
                  ))}
                  {group.showRemainder && (
                    <RemainderRow
                      month={month}
                      category={group.category}
                      label={group.remainderLabel}
                      amount={group.remainderAmount}
                      actual={group.remainderActual}
                      reason={group.remainderReason}
                      feedback={group.remainderFeedback}
                      onSaved={onSaved}
                    />
                  )}
                  <tr className="border-b border-border text-muted-foreground">
                    <td className="py-1.5 px-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: group.category.color ?? "#888780" }}
                        />
                        {group.category.name} 총계
                      </span>
                    </td>
                    <td className="py-1.5 px-1 truncate text-right tabular-nums">{formatCurrency(group.budget)}</td>
                    <td className="py-1.5 px-1 truncate text-right tabular-nums">{formatCurrency(group.actual)}</td>
                    <td
                      className={cn(
                        "py-1.5 px-1 truncate text-right tabular-nums",
                        varianceClass("expense", groupVariance)
                      )}
                    >
                      {formatCurrency(groupVariance)}
                    </td>
                    <td className="py-1.5 px-1" />
                    <td className="py-1.5 px-1" />
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-xs font-medium lg:text-sm">
              <td className="pt-2 px-1">총합계</td>
              <td className="pt-2 px-1 truncate text-right tabular-nums">{formatCurrency(totalBudget)}</td>
              <td className="pt-2 px-1 truncate text-right tabular-nums">{formatCurrency(totalActual)}</td>
              <td className={cn("pt-2 px-1 truncate text-right tabular-nums", varianceClass("expense", totalVariance))}>
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
