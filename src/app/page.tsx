"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { QuickAddModal } from "@/components/quick-add-modal";
import { fetchAllTransactions, type TransactionWithCategory } from "@/lib/queries";
import { formatCurrency, formatDateWithWeekday } from "@/lib/format";

export default function DailySettlementPage() {
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAllTransactions().then((data) => {
      if (cancelled) return;
      setTransactions(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const groups = useMemo(() => {
    const map = new Map<string, TransactionWithCategory[]>();
    for (const t of transactions) {
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 sm:p-6">

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : groups.length === 0 ? (
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
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-border"
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
        onClick={() => setModalOpen(true)}
      >
        <PlusIcon />
        <span className="sr-only">빠른입력</span>
      </Button>

      <QuickAddModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </main>
  );
}
