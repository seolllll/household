import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/format";

interface RemainingBudgetBarProps {
  remaining: number;
  budget: number;
}

export function RemainingBudgetBar({ remaining, budget }: RemainingBudgetBarProps) {
  const ratio = budget > 0 ? remaining / budget : 0;
  const percent = Math.round(Math.max(ratio, 0) * 100);
  const colorClass =
    remaining < 0 ? "bg-expense" : ratio <= 0.2 ? "bg-budget-warning" : "bg-income";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground lg:text-sm">
        <span className="truncate">
          {formatCurrency(remaining)} / {formatCurrency(budget)}
        </span>
        <span className="shrink-0 tabular-nums">{percent}%</span>
      </div>
      <ProgressPrimitive.Root value={percent}>
        <ProgressTrack>
          <ProgressIndicator className={colorClass} />
        </ProgressTrack>
      </ProgressPrimitive.Root>
    </div>
  );
}
