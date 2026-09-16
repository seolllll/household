import { cn } from "cn";
import { formatCurrency } from "@/lib/format";

export interface CategoryBarItem {
  id: string;
  name: string;
  color: string;
  amount: number;
  budget: number;
}

interface CategoryBarBreakdownProps {
  items: CategoryBarItem[];
}

export function CategoryBarBreakdown({ items }: CategoryBarBreakdownProps) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">지출 내역이 없습니다</p>;
  }

  const sorted = [...items].sort((a, b) => b.amount - a.amount);

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((item) => {
        const ratio = (item.amount / total) * 100;
        return (
          <li key={item.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs lg:text-sm">
              <span>{item.name}</span>
              <span
                className={cn(
                  "tabular-nums",
                  item.amount > item.budget ? "text-expense" : "text-income"
                )}
              >
                예산 {formatCurrency(item.budget)} / 지출 {formatCurrency(item.amount)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted lg:h-2.5">
              <div
                className="h-full rounded-full"
                style={{ width: `${ratio}%`, backgroundColor: item.color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
