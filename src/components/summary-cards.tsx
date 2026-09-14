import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "cn";

interface SummaryCardsProps {
  income: number;
  expense: number;
}

export function SummaryCards({ income, expense }: SummaryCardsProps) {
  const balance = income - expense;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs whitespace-nowrap text-muted-foreground">수입</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="truncate text-base font-semibold tracking-tight text-income sm:text-lg">
            {formatCurrency(income)}
          </p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs whitespace-nowrap text-muted-foreground">지출</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="truncate text-base font-semibold tracking-tight text-expense sm:text-lg">
            {formatCurrency(expense)}
          </p>
        </CardContent>
      </Card>
      <Card size="sm">
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
