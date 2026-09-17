"use client";

import { useState } from "react";
import { cn } from "cn";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReviewInputCell } from "@/components/review-input-cell";
import { formatCurrency } from "@/lib/format";
import { createAssetItem, deleteAssetItem, updateAssetItem, upsertAssetSnapshot } from "@/lib/queries";
import { parseDateKey } from "@/lib/date-range";
import type { AssetItem, AssetSnapshot } from "@/types/database";

interface AssetReviewSectionProps {
  month: string;
  prevMonth: string;
  items: AssetItem[];
  snapshots: AssetSnapshot[];
  prevSnapshots: AssetSnapshot[];
  onSaved: () => void;
}

function monthLabel(monthKey: string): string {
  return `${parseDateKey(monthKey).getMonth() + 1}월`;
}

function varianceTextClass(variance: number) {
  if (variance === 0) return "text-muted-foreground";
  return variance > 0 ? "text-income" : "text-expense";
}

interface RowMeta {
  item: AssetItem;
  showGroupCell: boolean;
  groupRowSpan: number;
  showSubgroupCell: boolean;
  subgroupRowSpan: number;
  isLastInGroup: boolean;
}

function buildRowMeta(items: AssetItem[]): RowMeta[] {
  return items.map((item, i) => {
    const prev = items[i - 1];
    const next = items[i + 1];
    const showGroupCell = !prev || prev.group_name !== item.group_name;
    const showSubgroupCell = showGroupCell || prev.subgroup !== item.subgroup;
    const isLastInGroup = !next || next.group_name !== item.group_name;

    let groupRowSpan = 0;
    if (showGroupCell) {
      let j = i;
      while (j < items.length && items[j].group_name === item.group_name) j++;
      groupRowSpan = j - i;
    }

    let subgroupRowSpan = 0;
    if (showSubgroupCell) {
      let j = i;
      while (j < items.length && items[j].group_name === item.group_name && items[j].subgroup === item.subgroup) j++;
      subgroupRowSpan = j - i;
    }

    return { item, showGroupCell, groupRowSpan, showSubgroupCell, subgroupRowSpan, isLastInGroup };
  });
}

function AssetEditFormRow({
  item,
  onSaved,
  onClose,
}: {
  item: AssetItem;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [groupInput, setGroupInput] = useState(item.group_name);
  const [subgroupInput, setSubgroupInput] = useState(item.subgroup);
  const [labelInput, setLabelInput] = useState(item.label);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const groupName = groupInput.trim();
    const subgroup = subgroupInput.trim();
    const label = labelInput.trim();
    if (!groupName || !subgroup || !label) return;
    setError(null);
    try {
      await updateAssetItem(item.id, groupName, subgroup, label);
      onSaved();
      onClose();
    } catch {
      setError("수정하지 못했습니다");
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteAssetItem(item.id);
      onSaved();
      onClose();
    } catch {
      setError("삭제하지 못했습니다");
    }
  }

  return (
    <tr className="border-b border-border bg-muted/30">
      <td colSpan={8} className="py-2 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            autoFocus
            placeholder="구분"
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            className="w-24"
          />
          <Input
            placeholder="내역"
            value={subgroupInput}
            onChange={(e) => setSubgroupInput(e.target.value)}
            className="w-24"
          />
          <Input
            placeholder="상세내역"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="w-28"
          />
          <Button type="button" size="sm" onClick={handleSave}>
            저장
          </Button>
          <Button type="button" size="sm" variant="outline" className="text-expense" onClick={handleDelete}>
            <Trash2Icon className="size-3.5" />
            삭제
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            취소
          </Button>
          {error && <p className="w-full text-sm text-expense">{error}</p>}
        </div>
      </td>
    </tr>
  );
}

function AssetRow({
  month,
  meta,
  snapshot,
  prevAmount,
  isEditing,
  onToggleEdit,
  onSaved,
}: {
  month: string;
  meta: RowMeta;
  snapshot?: AssetSnapshot;
  prevAmount: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSaved: () => void;
}) {
  const { item, showGroupCell, groupRowSpan, showSubgroupCell, subgroupRowSpan } = meta;
  const [amountInput, setAmountInput] = useState(String(snapshot?.amount ?? ""));
  const [reasonInput, setReasonInput] = useState(snapshot?.reason ?? "");
  const [feedbackInput, setFeedbackInput] = useState(snapshot?.feedback ?? "");

  const amount = snapshot?.amount ?? 0;
  const variance = amount - prevAmount;

  function save(overrides: Partial<{ amount: number; reason: string; feedback: string }>) {
    upsertAssetSnapshot(
      item.id,
      month,
      overrides.amount ?? amount,
      (overrides.reason ?? reasonInput) || null,
      (overrides.feedback ?? feedbackInput) || null
    ).then(onSaved);
  }

  function handleAmountBlur() {
    const value = Number(amountInput);
    if (!Number.isFinite(value)) {
      setAmountInput(String(amount));
      return;
    }
    save({ amount: value });
  }

  return (
    <tr className="border-b border-border">
      {showGroupCell && (
        <td rowSpan={groupRowSpan} className="py-2 px-1 align-top font-medium">
          {item.group_name}
        </td>
      )}
      {showSubgroupCell && (
        <td rowSpan={subgroupRowSpan} className="py-2 px-1 align-top text-muted-foreground">
          {item.subgroup}
        </td>
      )}
      <td className="py-2 px-1 align-middle">
        <button
          type="button"
          className={cn("truncate text-left hover:underline", isEditing && "font-medium text-primary")}
          onClick={onToggleEdit}
        >
          {item.label}
        </button>
      </td>
      <td className="py-2 px-1 text-right tabular-nums align-middle">{formatCurrency(prevAmount)}</td>
      <td className="py-1 px-1 align-middle">
        <Input
          type="number"
          inputMode="numeric"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          onBlur={handleAmountBlur}
          className="w-full text-right"
        />
      </td>
      <td className={cn("py-2 px-1 text-right tabular-nums align-middle", varianceTextClass(variance))}>
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

export function AssetReviewSection({
  month,
  prevMonth,
  items,
  snapshots,
  prevSnapshots,
  onSaved,
}: AssetReviewSectionProps) {
  const [adding, setAdding] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [newSubgroup, setNewSubgroup] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  async function handleAdd() {
    const groupName = newGroup.trim();
    const subgroup = newSubgroup.trim();
    const label = newLabel.trim();
    if (!groupName || !subgroup || !label) return;
    setAddError(null);
    try {
      await createAssetItem(groupName, subgroup, label);
      setNewGroup("");
      setNewSubgroup("");
      setNewLabel("");
      setAdding(false);
      onSaved();
    } catch {
      setAddError("항목을 추가하지 못했습니다");
    }
  }

  const addForm = (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAdding((v) => !v)}>
          <PlusIcon className="size-4" />
          <span className="sr-only">항목 추가</span>
        </Button>
      </div>
      {adding && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            autoFocus
            placeholder="구분"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            className="w-24"
          />
          <Input
            placeholder="내역"
            value={newSubgroup}
            onChange={(e) => setNewSubgroup(e.target.value)}
            className="w-24"
          />
          <Input
            placeholder="상세내역"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="w-28"
          />
          <Button type="button" onClick={handleAdd}>
            추가
          </Button>
        </div>
      )}
      {addError && <p className="text-sm text-expense">{addError}</p>}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {addForm}
        <p className="text-sm text-muted-foreground lg:text-base">항목이 없습니다</p>
      </div>
    );
  }

  const snapshotByItem = new Map(snapshots.map((s) => [s.asset_item_id, s]));
  const prevAmountByItem = new Map(prevSnapshots.map((s) => [s.asset_item_id, s.amount]));
  const rowMetas = buildRowMeta(items);

  const total = items.reduce((sum, item) => sum + (snapshotByItem.get(item.id)?.amount ?? 0), 0);
  const prevTotal = items.reduce((sum, item) => sum + (prevAmountByItem.get(item.id) ?? 0), 0);
  const totalVariance = total - prevTotal;

  return (
    <div className="flex flex-col gap-2">
      {addForm}
      <Card size="sm" className="border-primary/30 bg-white">
        <CardContent>
          <table className="w-full table-fixed border-collapse text-xs lg:text-sm">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[15.5%]" />
              <col className="w-[15.5%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground lg:text-xs">
                <th className="py-1.5 px-1 text-left font-medium">구분</th>
                <th className="py-1.5 px-1 text-left font-medium">내역</th>
                <th className="py-1.5 px-1 text-left font-medium">상세내역</th>
                <th className="py-1.5 px-1 text-right font-medium">{monthLabel(prevMonth)} 자산</th>
                <th className="py-1.5 px-1 text-right font-medium">{monthLabel(month)} 자산</th>
                <th className="py-1.5 px-1 text-right font-medium">오차</th>
                <th className="py-1.5 px-1 text-left font-medium">오차원인</th>
                <th className="py-1.5 px-1 text-left font-medium">피드백</th>
              </tr>
            </thead>
            <tbody>
              {rowMetas.map((meta) => {
                const item = meta.item;
                const rows = [
                  <AssetRow
                    key={item.id}
                    month={month}
                    meta={meta}
                    snapshot={snapshotByItem.get(item.id)}
                    prevAmount={prevAmountByItem.get(item.id) ?? 0}
                    isEditing={editingItemId === item.id}
                    onToggleEdit={() => setEditingItemId((id) => (id === item.id ? null : item.id))}
                    onSaved={onSaved}
                  />,
                ];

                if (editingItemId === item.id) {
                  rows.push(
                    <AssetEditFormRow
                      key={`${item.id}-edit`}
                      item={item}
                      onSaved={onSaved}
                      onClose={() => setEditingItemId(null)}
                    />
                  );
                }

                if (meta.isLastInGroup) {
                  const groupItems = items.filter((it) => it.group_name === item.group_name);
                  const groupAmount = groupItems.reduce(
                    (sum, it) => sum + (snapshotByItem.get(it.id)?.amount ?? 0),
                    0
                  );
                  const groupPrevAmount = groupItems.reduce(
                    (sum, it) => sum + (prevAmountByItem.get(it.id) ?? 0),
                    0
                  );
                  const groupVariance = groupAmount - groupPrevAmount;
                  rows.push(
                    <tr key={`${item.group_name}-total`} className="border-b border-border text-muted-foreground">
                      <td colSpan={3} className="py-1.5 px-1">
                        {item.group_name} 총계
                      </td>
                      <td className="py-1.5 px-1 truncate text-right tabular-nums">
                        {formatCurrency(groupPrevAmount)}
                      </td>
                      <td className="py-1.5 px-1 truncate text-right tabular-nums">{formatCurrency(groupAmount)}</td>
                      <td
                        className={cn(
                          "py-1.5 px-1 truncate text-right tabular-nums",
                          varianceTextClass(groupVariance)
                        )}
                      >
                        {formatCurrency(groupVariance)}
                      </td>
                      <td className="py-1.5 px-1" />
                      <td className="py-1.5 px-1" />
                    </tr>
                  );
                }

                return rows;
              })}
            </tbody>
            <tfoot>
              <tr className="text-xs font-medium lg:text-sm">
                <td colSpan={3} className="pt-2 px-1">
                  총합계
                </td>
                <td className="pt-2 px-1 truncate text-right tabular-nums">{formatCurrency(prevTotal)}</td>
                <td className="pt-2 px-1 truncate text-right tabular-nums">{formatCurrency(total)}</td>
                <td className={cn("pt-2 px-1 truncate text-right tabular-nums", varianceTextClass(totalVariance))}>
                  {formatCurrency(totalVariance)}
                </td>
                <td className="pt-2 px-1" />
                <td className="pt-2 px-1" />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
