"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { upsertAssetSnapshot } from "@/lib/queries";
import type { AssetItem, AssetSnapshot } from "@/types/database";

interface AssetReviewSectionProps {
  month: string;
  items: AssetItem[];
  snapshots: AssetSnapshot[];
  prevSnapshots: AssetSnapshot[];
  onSaved: () => void;
}

function AssetRow({
  month,
  item,
  snapshot,
  prevAmount,
  onSaved,
}: {
  month: string;
  item: AssetItem;
  snapshot?: AssetSnapshot;
  prevAmount: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amountInput, setAmountInput] = useState(String(snapshot?.amount ?? ""));
  const [reasonInput, setReasonInput] = useState(snapshot?.reason ?? "");
  const [feedbackInput, setFeedbackInput] = useState(snapshot?.feedback ?? "");
  const [saving, setSaving] = useState(false);

  const amount = snapshot?.amount ?? 0;
  const variance = amount - prevAmount;

  function toggleOpen() {
    if (!open) {
      setAmountInput(String(snapshot?.amount ?? ""));
      setReasonInput(snapshot?.reason ?? "");
      setFeedbackInput(snapshot?.feedback ?? "");
    }
    setOpen((v) => !v);
  }

  async function handleSave() {
    const value = Number(amountInput);
    if (!Number.isFinite(value)) return;
    setSaving(true);
    try {
      await upsertAssetSnapshot(item.id, month, value, reasonInput || null, feedbackInput || null);
      onSaved();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-2 text-sm lg:text-base">
      <button type="button" className="flex items-center justify-between gap-2 text-left" onClick={toggleOpen}>
        <span>{item.label}</span>
        <span className="flex shrink-0 items-center gap-2 tabular-nums">
          <span>{formatCurrency(amount)}</span>
          <span
            className={cn(
              "text-xs lg:text-sm",
              variance === 0 ? "text-muted-foreground" : variance > 0 ? "text-income" : "text-expense"
            )}
          >
            {formatCurrency(variance)}
          </span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground lg:text-sm">
            이번 달 금액
            <Input
              type="number"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground lg:text-sm">
            오차원인
            <Textarea value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground lg:text-sm">
            피드백
            <Textarea value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)} />
          </label>
          <Button type="button" size="sm" disabled={saving} onClick={handleSave} className="self-end">
            저장
          </Button>
        </div>
      )}
    </li>
  );
}

export function AssetReviewSection({ month, items, snapshots, prevSnapshots, onSaved }: AssetReviewSectionProps) {
  const snapshotByItem = useMemo(() => new Map(snapshots.map((s) => [s.asset_item_id, s])), [snapshots]);
  const prevAmountByItem = useMemo(
    () => new Map(prevSnapshots.map((s) => [s.asset_item_id, s.amount])),
    [prevSnapshots]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Map<string, AssetItem[]>>();
    for (const item of items) {
      if (!map.has(item.group_name)) map.set(item.group_name, new Map());
      const subgroups = map.get(item.group_name)!;
      if (!subgroups.has(item.subgroup)) subgroups.set(item.subgroup, []);
      subgroups.get(item.subgroup)!.push(item);
    }
    return map;
  }, [items]);

  const total = items.reduce((sum, item) => sum + (snapshotByItem.get(item.id)?.amount ?? 0), 0);
  const prevTotal = items.reduce((sum, item) => sum + (prevAmountByItem.get(item.id) ?? 0), 0);
  const totalVariance = total - prevTotal;

  return (
    <div className="flex flex-col gap-3">
      {Array.from(groups.entries()).map(([groupName, subgroups]) => {
        const groupTotal = Array.from(subgroups.values())
          .flat()
          .reduce((sum, item) => sum + (snapshotByItem.get(item.id)?.amount ?? 0), 0);
        return (
          <Card key={groupName} size="sm" className="border-primary/30 bg-white">
            <CardContent>
              <div className="mb-1 flex items-center justify-between text-sm font-medium lg:text-base">
                <span>{groupName}</span>
                <span className="tabular-nums">{formatCurrency(groupTotal)}</span>
              </div>
              <ul className="divide-y divide-border">
                {Array.from(subgroups.entries()).map(([subgroupName, subItems]) => {
                  const showSubgroupLabel = !(subItems.length === 1 && subItems[0].label === subgroupName);
                  return (
                    <li key={subgroupName}>
                      {showSubgroupLabel && (
                        <p className="pt-2 text-xs text-muted-foreground lg:text-sm">{subgroupName}</p>
                      )}
                      <ul className="divide-y divide-border">
                        {subItems.map((item) => (
                          <AssetRow
                            key={item.id}
                            month={month}
                            item={item}
                            snapshot={snapshotByItem.get(item.id)}
                            prevAmount={prevAmountByItem.get(item.id) ?? 0}
                            onSaved={onSaved}
                          />
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <Card size="sm" className="border-primary/30 bg-white">
        <CardContent className="flex items-center justify-between text-sm font-medium lg:text-base">
          <span>총계</span>
          <span className="flex items-center gap-2 tabular-nums">
            <span>{formatCurrency(total)}</span>
            <span
              className={cn(
                "text-xs lg:text-sm",
                totalVariance === 0 ? "text-muted-foreground" : totalVariance > 0 ? "text-income" : "text-expense"
              )}
            >
              {formatCurrency(totalVariance)}
            </span>
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
