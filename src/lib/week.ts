import { toDateKey } from "@/lib/date-range";
import type { TransactionWithCategory } from "@/lib/queries";

// 주간정산은 매주 변동이 없는 고정 지출 성격의 분류를 예산 계산에서 제외한다.
const WEEKLY_EXCLUDED_EXPENSE_CATEGORIES = new Set(["고정지출", "특별비1", "특별비2(여행비)"]);

export function isWeeklyBudgetExpense(t: TransactionWithCategory): boolean {
  return t.type === "expense" && !WEEKLY_EXCLUDED_EXPENSE_CATEGORIES.has(t.category?.name ?? "");
}

export interface MonthWeek {
  weekNumber: number;
  from: string;
  to: string;
}

export function getMonthWeeks(year: number, month: number): MonthWeek[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const weeks: MonthWeek[] = [];
  let weekNumber = 1;
  let weekStart = 1;

  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = (firstWeekday + day - 1) % 7;
    const isLastDayOfMonth = day === daysInMonth;
    if (weekday === 6 || isLastDayOfMonth) {
      weeks.push({
        weekNumber,
        from: toDateKey(new Date(year, month, weekStart)),
        to: toDateKey(new Date(year, month, day)),
      });
      weekNumber++;
      weekStart = day + 1;
    }
  }

  return weeks;
}

export function encodeWeekParam(year: number, month: number, weekNumber: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${weekNumber}`;
}

export function decodeWeekParam(
  param: string
): { year: number; month: number; weekNumber: number } | null {
  const match = param.match(/^(\d{4})-(\d{2})-(\d+)$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    weekNumber: Number(match[3]),
  };
}
