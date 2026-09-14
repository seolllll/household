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
}

export function SummaryCards({ income, expense, firstCard }: SummaryCardsProps) {
  const balance = income - expense;
  const firstLabel = firstCard?.label ?? "수입";
  const firstValue = firstCard?.value ?? income;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card size="sm" className="min-h-[72px] border-primary/30 bg-white">
        <CardHeader>
          <CardTitle className="text-xs whitespace-nowrap text-muted-foreground">
            {firstLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "truncate text-base font-semibold tracking-tight sm:text-lg",
              firstCard ? firstValue < 0 && "text-expense" : "text-income"
            )}
          >
            {formatCurrency(firstValue)}
          </p>
        </CardContent>
      </Card>
      <Card size="sm" className="min-h-[72px] border-primary/30 bg-white">
        <CardHeader>
          <CardTitle className="text-xs whitespace-nowrap text-muted-foreground">지출</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="truncate text-base font-semibold tracking-tight text-expense sm:text-lg">
            {formatCurrency(expense)}
          </p>
        </CardContent>
      </Card>
      <Card size="sm" className="min-h-[72px] border-primary/30 bg-white">
        <CardHeader>
          <CardTitle className="text-xs whitespace-nowrap text-muted-foreground">잔액</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "truncate text-base font-semibold tracking-tight sm:text-lg",
              balance < 0 && "text-expense"
            )}
          >
            {formatCurrency(balance)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
