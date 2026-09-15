import * as XLSX from "xlsx";
import { toDateKey } from "@/lib/date-range";
import type { TransactionType } from "@/types/database";

export interface ParsedImportItem {
  type: TransactionType;
  date: string;
  categoryName: string;
  amount: number;
  memo: string | null;
}

function excelDateToKey(value: unknown): string | null {
  // SheetJS's `cellDates` builds Date objects with the local `new Date(y, m, d)`
  // constructor (not `Date.UTC`), so the calendar date must be read back with
  // local getters (matching `toDateKey`) — UTC getters land on the wrong day.
  if (!(value instanceof Date)) return null;
  return toDateKey(value);
}

function toAmount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

/**
 * 일일정산 엑셀 업로드 양식: 1행 헤더, 2행부터 데이터.
 * A~C = 수입(날짜/금액/카테고리), D~G = 지출(날짜/카테고리/금액/메모), I열은 E열 드롭다운용 목록이라 무시.
 * 양식이 바뀌면 이 함수의 컬럼 인덱스만 수정하면 됨.
 */
export async function parseImportFile(file: File): Promise<ParsedImportItem[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  const items: ParsedImportItem[] = [];
  for (const row of rows.slice(1)) {
    const [incomeDate, incomeAmount, incomeCategory, expenseDate, expenseCategory, expenseAmount, expenseMemo] =
      row;

    const incDate = excelDateToKey(incomeDate);
    const incAmount = toAmount(incomeAmount);
    const incCategory = toText(incomeCategory);
    if (incDate && incAmount && incCategory) {
      items.push({ type: "income", date: incDate, categoryName: incCategory, amount: incAmount, memo: null });
    }

    const expDate = excelDateToKey(expenseDate);
    const expAmount = toAmount(expenseAmount);
    const expCategory = toText(expenseCategory);
    if (expDate && expAmount && expCategory) {
      items.push({
        type: "expense",
        date: expDate,
        categoryName: expCategory,
        amount: expAmount,
        memo: toText(expenseMemo) || null,
      });
    }
  }
  return items;
}
