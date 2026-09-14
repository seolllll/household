"use client";

import { useEffect, useState } from "react";
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
  createTransaction,
  fetchCategories,
  fetchRecentCategoryIds,
} from "@/lib/queries";
import { toDateKey } from "@/lib/date-range";
import type { Category, TransactionType } from "@/types/database";

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function orderByRecent(categories: Category[], recentIds: string[]): Category[] {
  const recent = recentIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Category => Boolean(c));
  const rest = categories.filter((c) => !recentIds.includes(c.id));
  return [...recent, ...rest];
}

export function QuickAddModal({ open, onOpenChange, onSaved }: QuickAddModalProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [memo, setMemo] = useState("");
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
      await createTransaction({
        type,
        amount: amountValue,
        category_id: categoryId,
        date,
        memo: memo.trim() || null,
      });
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
          <DialogTitle>빠른입력</DialogTitle>
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
            <Input
              id="quick-add-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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
