import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "cn";

interface SummaryCardsProps {
  income: number;
  expense: number;
  firstCard?: {
    label: string;
    value: number;
  };
  /** Override the last card's label/value instead of the default 잔액 = income - expense. */
  lastCard?: {
    label: string;
    value: number;
  };
}

export function SummaryCards({ income, expense, firstCard, lastCard }: SummaryCardsProps) {
  const firstLabel = firstCard?.label ?? "수입";
  const firstValue = firstCard?.value ?? income;
  const lastLabel = lastCard?.label ?? "잔액";
  const lastValue = lastCard?.value ?? income - expense;

  return (
    <div className="grid grid-cols-3 gap-3 lg:gap-4">
      <Card size="sm" className="min-h-[72px] border-primary/30 bg-white lg:min-h-[96px]">
        <CardHeader>
          <CardTitle className="text-xs whitespace-nowrap text-muted-foreground lg:text-sm">
            {firstLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "truncate text-base font-semibold tracking-tight sm:text-lg lg:text-2xl",
              firstCard ? firstValue < 0 && "text-expense" : "text-income"
            )}
          >
            {formatCurrency(firstValue)}
          </p>
        </CardContent>
      </Card>
      <Card size="sm" className="min-h-[72px] border-primary/30 bg-white lg:min-h-[96px]">
        <CardHeader>
          <CardTitle className="text-xs whitespace-nowrap text-muted-foreground lg:text-sm">
            지출
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="truncate text-base font-semibold tracking-tight text-expense sm:text-lg lg:text-2xl">
            {formatCurrency(expense)}
          </p>
        </CardContent>
      </Card>
      <Card size="sm" className="min-h-[72px] border-primary/30 bg-white lg:min-h-[96px]">
        <CardHeader>
          <CardTitle className="text-xs whitespace-nowrap text-muted-foreground lg:text-sm">
            {lastLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "truncate text-base font-semibold tracking-tight sm:text-lg lg:text-2xl",
              lastValue < 0 && "text-expense"
            )}
          >
            {formatCurrency(lastValue)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
