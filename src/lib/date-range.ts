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

export function getTodayRange(now = new Date()): DateRange {
  const key = toDateKey(now);
  return { from: key, to: key };
}

export function getThisWeekRange(now = new Date()): DateRange {
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toDateKey(monday), to: toDateKey(sunday) };
}

export function getMonthRange(year: number, month: number): DateRange {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { from: toDateKey(first), to: toDateKey(last) };
}

export function getThisMonthRange(now = new Date()): DateRange {
  return getMonthRange(now.getFullYear(), now.getMonth());
}

export function encodeMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function parseMonthParam(param: string): { year: number; month: number } | null {
  const match = param.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}
