"use client";

import { useState } from "react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { upsertBudget, type BudgetWithCategory, type TransactionWithCategory } from "@/lib/queries";
import type { Category, TransactionType } from "@/types/database";

export interface BudgetReviewRow {
  category: Category;
  /** 카테고리 전체 예산이면 생략. "고정지출"처럼 카테고리 안 세부항목별 예산이면 항목명(예: "계비"). */
  label?: string;
  actual: number;
  budget?: BudgetWithCategory;
  transactions?: TransactionWithCategory[];
}

interface BudgetReviewTableProps {
  month: string;
  rows: BudgetReviewRow[];
  /** false for 다음달 예산 계획: 예산/메모만 입력, 실제·오차·오차원인은 숨김 */
  showActual: boolean;
  totalLabel?: string;
  onSaved: () => void;
}

export function varianceClass(type: TransactionType, variance: number) {
  if (variance === 0) return "text-muted-foreground";
  const isGood = type === "income" ? variance < 0 : variance > 0;
  return isGood ? "text-income" : "text-expense";
}

function BudgetRow({ month, row, showActual, onSaved }: {
  month: string;
  row: BudgetReviewRow;
  showActual: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amountInput, setAmountInput] = useState(String(row.budget?.amount ?? ""));
  const [reasonInput, setReasonInput] = useState(row.budget?.reason ?? "");
  const [feedbackInput, setFeedbackInput] = useState(row.budget?.feedback ?? "");
  const [saving, setSaving] = useState(false);

  const budgetAmount = row.budget?.amount ?? 0;
  const variance = budgetAmount - row.actual;

  function toggleOpen() {
    if (!open) {
      setAmountInput(String(row.budget?.amount ?? ""));
      setReasonInput(row.budget?.reason ?? "");
      setFeedbackInput(row.budget?.feedback ?? "");
    }
    setOpen((v) => !v);
  }

  async function handleSave() {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    try {
      await upsertBudget(
        row.category.id,
        month,
        row.label ?? "",
        amount,
        showActual ? reasonInput || null : null,
        feedbackInput || null
      );
      onSaved();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-2 text-sm lg:text-base">
      <button
        type="button"
        className="flex items-center justify-between gap-2 text-left"
        onClick={toggleOpen}
      >
        <span className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.category.color ?? "#888780" }}
          />
          <span>{row.label || row.category.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 tabular-nums">
          <span className="text-xs text-muted-foreground lg:text-sm">
            예산 {formatCurrency(budgetAmount)}
          </span>
          {showActual && (
            <>
              <span>{formatCurrency(row.actual)}</span>
              <span className={cn("text-xs lg:text-sm", varianceClass(row.category.type, variance))}>
                {formatCurrency(variance)}
              </span>
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground lg:text-sm">
            예산
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
            />
          </label>
          {showActual && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground lg:text-sm">
              오차원인
              <Textarea value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground lg:text-sm">
            {showActual ? "피드백" : "메모 / 이벤트"}
            <Textarea value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)} />
          </label>
          <Button type="button" size="sm" disabled={saving} onClick={handleSave} className="self-end">
            저장
          </Button>

          {showActual && row.transactions && row.transactions.length > 0 && (
            <ul className="flex flex-col gap-1.5 border-t border-border pt-2">
              {row.transactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-xs text-muted-foreground lg:text-sm"
                >
                  <span>
                    {formatShortDate(t.date)}
                    {t.memo ? ` · ${t.memo}` : ""}
                  </span>
                  <span className="tabular-nums">{formatCurrency(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function BudgetReviewTable({ month, rows, showActual, totalLabel, onSaved }: BudgetReviewTableProps) {
  const totalBudget = rows.reduce((sum, r) => sum + (r.budget?.amount ?? 0), 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const totalVariance = totalBudget - totalActual;
  const type = rows[0]?.category.type ?? "expense";

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground lg:text-base">항목이 없습니다</p>;
  }

  return (
    <Card size="sm" className="border-primary/30 bg-white">
      <CardContent>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <BudgetRow
              key={`${row.category.id}:${row.label ?? ""}`}
              month={month}
              row={row}
              showActual={showActual}
              onSaved={onSaved}
            />
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-medium lg:text-base">
          <span>{totalLabel ?? "총계"}</span>
          <span className="flex items-center gap-2 tabular-nums">
            <span className="text-xs text-muted-foreground lg:text-sm">
              예산 {formatCurrency(totalBudget)}
            </span>
            {showActual && (
              <>
                <span>{formatCurrency(totalActual)}</span>
                <span className={cn("text-xs lg:text-sm", varianceClass(type, totalVariance))}>
                  {formatCurrency(totalVariance)}
                </span>
              </>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
