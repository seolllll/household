import { toDateKey } from "@/lib/date-range";

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
