"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickAddModal } from "@/components/quick-add-modal";
import { SummaryCards } from "@/components/summary-cards";
import {
  createCategory,
  createTransaction,
  deleteTransaction,
  fetchCategories,
  fetchTransactions,
  type TransactionWithCategory,
} from "@/lib/queries";
import type { TransactionType } from "@/types/database";
import { parseImportFile } from "@/lib/import-excel";
import { formatCurrency, formatDateWithWeekday } from "@/lib/format";
import { getMonthRange } from "@/lib/date-range";

export default function DailySettlementPage() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithCategory | null>(
    null
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const range = getMonthRange(year, month);
    fetchTransactions(range).then((data) => {
      if (!cancelled) setTransactions(data);
    });
    return () => {
      cancelled = true;
    };
  }, [year, month, refreshKey]);

  const income = useMemo(
    () => transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );
  const expense = useMemo(
    () => transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const groups = useMemo(() => {
    const map = new Map<string, TransactionWithCategory[]>();
    for (const t of transactions) {
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  function goToMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  function openCreateModal() {
    setEditingTransaction(null);
    setModalOpen(true);
  }

  function openEditModal(t: TransactionWithCategory) {
    setEditingTransaction(t);
    setModalOpen(true);
    setActiveId(null);
  }

  async function handleDelete(id: string) {
    await deleteTransaction(id);
    setActiveId(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportStatus(null);
    try {
      const parsed = await parseImportFile(file);
      const [incomeCategories, expenseCategories] = await Promise.all([
        fetchCategories("income"),
        fetchCategories("expense"),
      ]);
      const categoryIdByKey = new Map<string, string>();
      for (const c of incomeCategories) categoryIdByKey.set(`income:${c.name}`, c.id);
      for (const c of expenseCategories) categoryIdByKey.set(`expense:${c.name}`, c.id);

      async function ensureCategoryId(type: TransactionType, name: string) {
        const key = `${type}:${name}`;
        let id = categoryIdByKey.get(key);
        if (!id) {
          id = await createCategory(name, type);
          categoryIdByKey.set(key, id);
        }
        return id;
      }

      // 이번 달 거래가 없어 금액이 0인 분류도 목록에 있으면 미리 생성해둔다.
      for (const name of parsed.incomeCategories) await ensureCategoryId("income", name);
      for (const name of parsed.expenseCategories) await ensureCategoryId("expense", name);

      let added = 0;
      let skipped = 0;
      for (const item of parsed.items) {
        try {
          const categoryId = await ensureCategoryId(item.type, item.categoryName);
          await createTransaction({
            type: item.type,
            amount: item.amount,
            category_id: categoryId,
            date: item.date,
            memo: item.memo,
          });
          added++;
        } catch {
          skipped++;
        }
      }

      setImportStatus(
        parsed.items.length === 0
          ? "가져올 내역이 없습니다"
          : skipped > 0
            ? `${added}건 추가됨, ${skipped}건 실패`
            : `${added}건 추가됨`
      );
      setRefreshKey((k) => k + 1);
    } catch {
      setImportStatus("파일을 읽지 못했습니다");
    } finally {
      setImporting(false);
      setImportResultOpen(true);
    }
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6 lg:max-w-4xl lg:gap-6 lg:p-8">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" onClick={() => goToMonth(-1)}>
          <ChevronLeftIcon />
        </Button>
        <h1 className="text-base font-medium lg:text-xl">
          {year}년 {month + 1}월
        </h1>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            <span className="sr-only">엑셀 업로드</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => goToMonth(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>

      <SummaryCards income={income} expense={expense} />

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground lg:text-base">거래 내역이 없습니다</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([date, items]) => (
            <section key={date} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground lg:text-base">
                {formatDateWithWeekday(date)}
              </h2>
              <Card size="sm" className="border-primary/30 bg-white">
                <CardContent>
                  <ul className="divide-y divide-border">
                    {items.map((t) => (
                      <li key={t.id} className="flex flex-col gap-2 py-2 text-sm lg:text-base">
                        <button
                          type="button"
                          className="flex items-center justify-between gap-2 text-left"
                          onClick={() => setActiveId((id) => (id === t.id ? null : t.id))}
                        >
                          <div className="flex flex-col">
                            <span>
                              {t.memo || t.category?.name || (t.type === "income" ? "수입" : "지출")}
                            </span>
                            {t.memo && (
                              <span className="text-xs text-muted-foreground lg:text-sm">
                                {t.category?.name ?? "미분류"}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "shrink-0 font-medium tabular-nums",
                              t.type === "income" ? "text-income" : "text-expense"
                            )}
                          >
                            {formatCurrency(t.amount)}
                          </span>
                        </button>

                        {activeId === t.id && (
                          <div className="flex items-center justify-end gap-1.5 border-t border-border pt-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => openEditModal(t)}
                            >
                              <PencilIcon className="size-3.5" />
                              수정
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              className="text-expense"
                              onClick={() => handleDelete(t.id)}
                            >
                              <Trash2Icon className="size-3.5" />
                              삭제
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="icon-lg"
        className="fixed right-6 bottom-20 rounded-full"
        onClick={openCreateModal}
      >
        <PlusIcon />
        <span className="sr-only">추가</span>
      </Button>

      <QuickAddModal
        key={editingTransaction?.id ?? "new"}
        open={modalOpen}
        onOpenChange={(next) => {
          setModalOpen(next);
          if (!next) setEditingTransaction(null);
        }}
        onSaved={() => setRefreshKey((k) => k + 1)}
        transaction={editingTransaction}
      />

      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>엑셀 업로드</DialogTitle>
            <DialogDescription>{importStatus}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setImportResultOpen(false)}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
