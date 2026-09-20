import * as XLSX from "xlsx";
import { toDateKey } from "@/lib/date-range";
import { joinSubCategoryMemo } from "@/lib/sub-category-memo";
import type { TransactionType } from "@/types/database";

export interface ParsedImportItem {
  type: TransactionType;
  date: string;
  categoryName: string;
  amount: number;
  memo: string | null;
}

export interface ParsedImport {
  items: ParsedImportItem[];
  /** 분류명 목록(P/R열). 이번 달 거래가 없어 금액이 0인 분류도 포함되므로, item에 없어도 카테고리는 생성해야 함. */
  incomeCategories: string[];
  expenseCategories: string[];
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

// 월간 리포트 엑셀의 열 인덱스(0-based). A=0, B=1, ... 양식이 바뀌면 이 값들만 수정하면 됨.
const COL = {
  incomeDate: 0, // A
  incomeCategory: 1, // B
  incomeMemo: 2, // C
  incomeAmount: 3, // D
  expenseDate: 5, // F
  expenseCategory: 6, // G
  expenseSubcategory: 7, // H: 채워져 있으면 add-modal에서 세부분류 칩을 선택한 것과 동일하게 memo로 사용(내용열보다 우선)
  expenseMemo: 8, // I
  expenseAmount: 9, // J
  incomeCategoryList: 16, // Q: 이번 달 수입 분류명 목록(합계 0 포함, R열 합계는 무시)
  expenseCategoryList: 18, // S: 이번 달 지출 분류명 목록(합계 0 포함, T열 합계는 무시)
} as const;

function findHeaderRowIndex(rows: unknown[][]): number {
  const idx = rows.findIndex(
    (row) => toText(row[COL.incomeDate]) === "날짜" && toText(row[COL.expenseDate]) === "날짜"
  );
  if (idx === -1) throw new Error("헤더 행을 찾을 수 없습니다");
  return idx;
}

/**
 * 일일정산 엑셀 업로드 양식: "월간 리포트" 형식.
 * - 거래 데이터: A~D = 수입(날짜/분류/내용/금액), F~J = 지출(날짜/분류/세부분류/내용/금액). 날짜 열이 "날짜"인 행 다음부터 데이터 시작.
 * - 지출의 세부분류(H열)가 채워져 있으면 add-modal에서 그 세부분류 칩을 선택한 것과 동일하게 매칭되도록 memo를
 *   "세부분류 · 내용"(joinSubCategoryMemo) 형태로 저장. 내용열(I)이 비어있으면 세부분류만. 세부분류가 비어있으면
 *   내용열만 그대로 memo로 사용(기존 자유 입력 방식).
 * - 분류명 목록: Q = 수입 분류 전체, S = 지출 분류 전체 (헤더 행부터 바로 시작, 그 달 거래가 없어 금액이 0인 분류도 포함됨). R/T열의 합계 숫자는 사용하지 않음.
 * - 양식이 바뀌면 이 파일의 COL 매핑만 수정하면 됨.
 */
export async function parseImportFile(file: File): Promise<ParsedImport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  const headerRow = findHeaderRowIndex(rows);

  const incomeCategories = new Set<string>();
  const expenseCategories = new Set<string>();
  for (let i = headerRow; i < rows.length; i++) {
    const incomeCategory = toText(rows[i]?.[COL.incomeCategoryList]);
    if (incomeCategory) incomeCategories.add(incomeCategory);
    const expenseCategory = toText(rows[i]?.[COL.expenseCategoryList]);
    if (expenseCategory) expenseCategories.add(expenseCategory);
  }

  const items: ParsedImportItem[] = [];
  for (const row of rows.slice(headerRow + 1)) {
    const incDate = excelDateToKey(row[COL.incomeDate]);
    const incAmount = toAmount(row[COL.incomeAmount]);
    const incCategory = toText(row[COL.incomeCategory]);
    if (incDate && incAmount && incCategory) {
      items.push({
        type: "income",
        date: incDate,
        categoryName: incCategory,
        amount: incAmount,
        memo: toText(row[COL.incomeMemo]) || null,
      });
    }

    const expDate = excelDateToKey(row[COL.expenseDate]);
    const expAmount = toAmount(row[COL.expenseAmount]);
    const expCategory = toText(row[COL.expenseCategory]);
    if (expDate && expAmount && expCategory) {
      const subCategory = toText(row[COL.expenseSubcategory]);
      const content = toText(row[COL.expenseMemo]);
      items.push({
        type: "expense",
        date: expDate,
        categoryName: expCategory,
        amount: expAmount,
        memo: subCategory ? joinSubCategoryMemo(subCategory, content) : content || null,
      });
    }
  }

  return {
    items,
    incomeCategories: Array.from(incomeCategories),
    expenseCategories: Array.from(expenseCategories),
  };
}
