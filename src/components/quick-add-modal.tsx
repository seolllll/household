"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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

// tui-date-picker touches `window` at module load time, which breaks Next's
// server-side render of this client component — load it in the browser only.
const DatePickerInput = dynamic(
  () => import("@/components/ui/date-picker-input").then((m) => m.DatePickerInput),
  { ssr: false }
);
import {
  createTransaction,
  fetchCategories,
  fetchRecentCategoryIds,
  updateTransaction,
  type TransactionWithCategory,
} from "@/lib/queries";
import { toDateKey } from "@/lib/date-range";
import type { Category, TransactionType } from "@/types/database";

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Pass an existing transaction to edit it instead of creating a new one. */
  transaction?: TransactionWithCategory | null;
}

function orderByRecent(categories: Category[], recentIds: string[]): Category[] {
  const recent = recentIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Category => Boolean(c));
  const rest = categories.filter((c) => !recentIds.includes(c.id));
  return [...recent, ...rest];
}

export function QuickAddModal({
  open,
  onOpenChange,
  onSaved,
  transaction = null,
}: QuickAddModalProps) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.category_id ?? null);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [date, setDate] = useState(() => transaction?.date ?? toDateKey(new Date()));
  const [memo, setMemo] = useState(transaction?.memo ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [cats, recentIds] = await Promise.all([
        fetchCategories(type),
        fetchRecentCategoryIds(type),
      ]);
      if (cancelled) return;
      setCategories(orderByRecent(cats, recentIds));
      setCategoryId((current) =>
        current && cats.some((c) => c.id === current) ? current : null
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, type]);

  function resetForm() {
    setType("expense");
    setCategoryId(null);
    setAmount("");
    setDate(toDateKey(new Date()));
    setMemo("");
  }

  const amountValue = Number(amount);
  const isValid = amountValue > 0 && Boolean(categoryId) && Boolean(date);

  async function handleSave() {
    if (!isValid || !categoryId) return;
    setSaving(true);
    try {
      const input = {
        type,
        amount: amountValue,
        category_id: categoryId,
        date,
        memo: memo.trim() || null,
      };
      if (transaction) {
        await updateTransaction(transaction.id, input);
      } else {
        await createTransaction(input);
      }
      resetForm();
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? "수정" : "추가"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              onClick={() => setType("expense")}
            >
              지출
            </Button>
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              onClick={() => setType("income")}
            >
              수입
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-add-amount">금액</Label>
            <Input
              id="quick-add-amount"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
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
            <Label htmlFor="quick-add-date">날짜</Label>
            <DatePickerInput id="quick-add-date" value={date} onChange={setDate} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-add-memo">메모</Label>
            <Input
              id="quick-add-memo"
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
