"use client";

import { useState } from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportSettlementExcel, type MonthTarget } from "@/lib/export-excel";

const MONTH_COUNT = 12;

function recentMonths(count: number): MonthTarget[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

function monthKeyOf(m: MonthTarget): string {
  return `${m.year}-${m.month}`;
}

type SettlementType = "daily" | "weekly" | "monthly";

const TYPE_OPTIONS: { key: SettlementType; label: string }[] = [
  { key: "daily", label: "일일정산" },
  { key: "weekly", label: "주간정산" },
  { key: "monthly", label: "월간정산" },
];

const MONTHS = recentMonths(MONTH_COUNT);

export function ExcelDownloadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(
    () => new Set([monthKeyOf(MONTHS[0])])
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<SettlementType>>(
    () => new Set(["daily", "weekly", "monthly"])
  );
  const [downloading, setDownloading] = useState(false);

  function toggleMonth(key: string) {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleType(key: SettlementType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleDownload() {
    const targets = MONTHS.filter((m) => selectedMonths.has(monthKeyOf(m)));
    if (targets.length === 0 || selectedTypes.size === 0) return;
    setDownloading(true);
    try {
      await exportSettlementExcel(targets, {
        daily: selectedTypes.has("daily"),
        weekly: selectedTypes.has("weekly"),
        monthly: selectedTypes.has("monthly"),
      });
      onOpenChange(false);
    } finally {
      setDownloading(false);
    }
  }

  const canDownload = selectedMonths.size > 0 && selectedTypes.size > 0 && !downloading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>엑셀 다운로드</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">월 선택</span>
            <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto">
              {MONTHS.map((m) => {
                const key = monthKeyOf(m);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selectedMonths.has(key)}
                      onChange={() => toggleMonth(key)}
                    />
                    {m.year}년 {m.month + 1}월
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">정산 종류</span>
            <div className="flex gap-3">
              {TYPE_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selectedTypes.has(opt.key)}
                    onChange={() => toggleType(opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={!canDownload} onClick={handleDownload}>
            {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            다운로드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
