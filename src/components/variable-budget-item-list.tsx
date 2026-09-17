"use client";

import { useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { VariableBudgetItemWithCategory } from "@/lib/queries";

interface VariableBudgetItemListProps {
  items: VariableBudgetItemWithCategory[];
  onEdit: (item: VariableBudgetItemWithCategory) => void;
  onDelete: (item: VariableBudgetItemWithCategory) => void;
}

export function VariableBudgetItemList({ items, onEdit, onDelete }: VariableBudgetItemListProps) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground lg:text-base">항목이 없습니다</p>;
  }

  const groups = new Map<string, VariableBudgetItemWithCategory[]>();
  for (const item of items) {
    if (!groups.has(item.category_id)) groups.set(item.category_id, []);
    groups.get(item.category_id)!.push(item);
  }
  const total = items.reduce((sum, it) => sum + it.amount, 0);

  return (
    <Card size="sm" className="border-primary/30 bg-white">
      <CardContent>
        <div className="flex flex-col divide-y divide-border">
          {Array.from(groups.values()).map((groupItems) => {
            const categoryName = groupItems[0].category?.name ?? "미분류";
            const subtotal = groupItems.reduce((sum, it) => sum + it.amount, 0);

            return (
              <div key={groupItems[0].category_id} className="flex flex-col py-1.5 first:pt-0 last:pb-0">
                {groupItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 py-1 text-sm lg:text-base">
                    <button
                      type="button"
                      className="flex items-center justify-between gap-2 text-left"
                      onClick={() => setActiveItemId((id) => (id === item.id ? null : item.id))}
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span>{item.memo || categoryName}</span>
                        {item.detail_memo && (
                          <span className="truncate text-xs text-muted-foreground">{item.detail_memo}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-expense">
                        {formatCurrency(item.amount)}
                      </span>
                    </button>

                    {activeItemId === item.id && (
                      <div className="flex items-center justify-end gap-1.5 border-t border-border pt-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            onEdit(item);
                            setActiveItemId(null);
                          }}
                        >
                          <PencilIcon className="size-3.5" />
                          수정
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="text-expense"
                          onClick={() => {
                            onDelete(item);
                            setActiveItemId(null);
                          }}
                        >
                          <Trash2Icon className="size-3.5" />
                          삭제
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1 text-sm text-muted-foreground lg:text-base">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: groupItems[0].category?.color ?? "#888780" }}
                    />
                    {categoryName} 총계
                  </span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-medium lg:text-base">
          <span>총계</span>
          <span className="tabular-nums">{formatCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
