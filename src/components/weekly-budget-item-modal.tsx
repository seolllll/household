"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";
import {
  createWeeklyBudgetItem,
  updateWeeklyBudgetItem,
  type WeeklyBudgetItemWithCategory,
} from "@/lib/queries";
import type { Category } from "@/types/database";

interface WeeklyBudgetItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: string | null;
  categories: Category[];
  /** Pass an existing item to edit it instead of creating a new one. */
  item?: WeeklyBudgetItemWithCategory | null;
  onSaved: () => void;
}

export function WeeklyBudgetItemModal({
  open,
  onOpenChange,
  weekStart,
  categories,
  item = null,
  onSaved,
}: WeeklyBudgetItemModalProps) {
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [amount, setAmount] = useState(item ? String(item.amount) : "");
  const [memo, setMemo] = useState(item?.memo ?? "");
  const [saving, setSaving] = useState(false);

  const amountValue = Number(amount);
  const isValid = amountValue > 0 && Boolean(categoryId) && Boolean(weekStart);

  async function handleSave() {
    if (!isValid || !categoryId || !weekStart) return;
    setSaving(true);
    try {
      const input = {
        week_start: weekStart,
        category_id: categoryId,
        amount: amountValue,
        memo: memo.trim() || null,
      };
      if (item) {
        await updateWeeklyBudgetItem(item.id, input);
      } else {
        await createWeeklyBudgetItem(input);
      }
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "지출 계획 수정" : "지출 계획 추가"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weekly-budget-item-amount">금액</Label>
            <Input
              id="weekly-budget-item-amount"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>카테고리</Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-sm transition-colors",
                    categoryId === c.id
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {c.name}
                </button>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">등록된 카테고리가 없습니다</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weekly-budget-item-memo">메모</Label>
            <Input
              id="weekly-budget-item-memo"
              type="text"
              placeholder="메모 (선택)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={!isValid || saving} onClick={handleSave}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
