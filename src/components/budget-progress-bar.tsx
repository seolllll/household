import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/format";

interface BudgetProgressBarProps {
  spent: number;
  budget: number;
}

export function BudgetProgressBar({ spent, budget }: BudgetProgressBarProps) {
  const ratio = budget > 0 ? spent / budget : 0;
  const percent = Math.round(ratio * 100);
  const colorClass = ratio > 1 ? "bg-expense" : ratio >= 0.8 ? "bg-budget-warning" : "bg-income";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground lg:text-sm">
        <span className="truncate">
          {formatCurrency(spent)} / {formatCurrency(budget)}
        </span>
        <span className="shrink-0 tabular-nums">{percent}%</span>
      </div>
      <ProgressPrimitive.Root value={Math.min(percent, 100)}>
        <ProgressTrack>
          <ProgressIndicator className={colorClass} />
        </ProgressTrack>
      </ProgressPrimitive.Root>
    </div>
  );
}
