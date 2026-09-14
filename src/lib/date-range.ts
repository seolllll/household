export interface DateRange {
  from: string;
  to: string;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function enumerateDateKeys(from: string, to: string): string[] {
  const end = parseDateKey(to);
  const keys: string[] = [];
  for (const cursor = parseDateKey(from); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    keys.push(toDateKey(cursor));
  }
  return keys;
}

export function getMonthRange(year: number, month: number): DateRange {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { from: toDateKey(first), to: toDateKey(last) };
}

/** Last `count` Sun–Sat weeks, oldest first, ending with the week containing `endDate`. */
export function getRecentWeekRanges(count: number, endDate: Date = new Date()): DateRange[] {
  const currentWeekEnd = new Date(endDate);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + (6 - currentWeekEnd.getDay()));
  const ranges: DateRange[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const weekEnd = new Date(currentWeekEnd);
    weekEnd.setDate(currentWeekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    ranges.push({ from: toDateKey(weekStart), to: toDateKey(weekEnd) });
  }
  return ranges;
}

/** Last `count` calendar months, oldest first, ending with the month containing `endDate`. */
export function getRecentMonthRanges(count: number, endDate: Date = new Date()): DateRange[] {
  const ranges: DateRange[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
    ranges.push(getMonthRange(d.getFullYear(), d.getMonth()));
  }
  return ranges;
}

export function encodeMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function parseMonthParam(param: string): { year: number; month: number } | null {
  const match = param.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}
