"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { QuickAddModal } from "@/components/quick-add-modal";
import { deleteTransaction, fetchTransactions, type TransactionWithCategory } from "@/lib/queries";
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

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" onClick={() => goToMonth(-1)}>
          <ChevronLeftIcon />
        </Button>
        <h1 className="text-base font-medium">
          {year}년 {month + 1}월
        </h1>
        <Button type="button" variant="ghost" size="icon" onClick={() => goToMonth(1)}>
          <ChevronRightIcon />
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">거래 내역이 없습니다</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([date, items]) => (
            <section key={date} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {formatDateWithWeekday(date)}
              </h2>
              <ul className="flex flex-col gap-2">
                {items.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-col gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-border"
                  >
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
                          <span className="text-xs text-muted-foreground">
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
    </main>
  );
}
