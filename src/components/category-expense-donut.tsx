"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

export interface CategorySlice {
  id: string;
  name: string;
  color: string;
  amount: number;
}

interface CategoryExpenseDonutProps {
  data: CategorySlice[];
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CategorySlice }[];
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground">
      <span className="font-medium">{slice.name}</span>{" "}
      <span className="text-muted-foreground">{formatCurrency(slice.amount)}</span>
    </div>
  );
}

export function CategoryExpenseDonut({ data }: CategoryExpenseDonutProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        지출 내역이 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="h-48 w-full sm:w-48 sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell key={slice.id} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-1 flex-col gap-1.5">
        {data.map((slice) => (
          <li key={slice.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 truncate">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate">{slice.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatCurrency(slice.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
