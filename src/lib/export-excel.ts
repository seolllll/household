import ExcelJS from "exceljs";
import { parseDateKey, toDateKey, getMonthRange } from "@/lib/date-range";
import { getMonthWeeks, isWeeklyBudgetExpense, type MonthWeek } from "@/lib/week";
import { buildFixedExpenseLabelRows, buildRows, FIXED_EXPENSE_GROUP } from "@/lib/budget-rows";
import { actualForItem, buildGroups } from "@/components/variable-budget-item-review-table";
import type { BudgetReviewRow } from "@/components/budget-review-table";
import { fetchExportData, type ExportData, type TransactionWithCategory } from "@/lib/queries";
import type { AssetItem, AssetSnapshot, BudgetLabel, Category, TransactionType } from "@/types/database";

export interface MonthTarget {
  year: number;
  month: number; // 0-indexed
}

export interface SettlementTypes {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
}

// ---------- 스타일 팔레트 (앱 자체 색상/카테고리 팔레트 재사용) ----------

const COLOR = {
  primary: "FF7F77DD",
  income: "FF639922",
  expense: "FFE24B4A",
  fixed: "FF2A78D6",
  variable: "FF4A3AA7",
  asset: "FFEB6834",
  headerGray: "FFE8E8E8",
  subtotalGray: "FFF2F2F0",
  border: "FFD9D9D9",
  white: "FFFFFFFF",
} as const;

const MONEY_FMT = '"₩"#,##0;[Red]-"₩"#,##0';

function thinBorder(): Partial<ExcelJS.Borders> {
  const style = { style: "thin" as const, color: { argb: COLOR.border } };
  return { top: style, left: style, bottom: style, right: style };
}

function styleTitle(cell: ExcelJS.Cell, argb: string, size = 13) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  cell.font = { bold: true, color: { argb: COLOR.white }, size };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

function styleColumnHeader(cell: ExcelJS.Cell) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerGray } };
  cell.font = { bold: true, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = thinBorder();
}

function styleDataCell(
  cell: ExcelJS.Cell,
  opts?: { align?: "left" | "right" | "center"; money?: boolean; color?: string; bold?: boolean }
) {
  cell.border = thinBorder();
  cell.alignment = { vertical: "middle", horizontal: opts?.align ?? (opts?.money ? "right" : "left"), wrapText: true };
  if (opts?.money) cell.numFmt = MONEY_FMT;
  if (opts?.color || opts?.bold) {
    cell.font = { color: opts.color ? { argb: opts.color } : undefined, bold: opts?.bold };
  }
}

function styleTotalRow(row: ExcelJS.Row, fromCol: number, toCol: number) {
  for (let c = fromCol; c <= toCol; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.subtotalGray } };
    cell.font = { ...(cell.font ?? {}), bold: true };
  }
}

function varianceArgb(type: TransactionType, variance: number): string | undefined {
  if (variance === 0) return undefined;
  const isGood = type === "income" ? variance < 0 : variance > 0;
  return isGood ? COLOR.income : COLOR.expense;
}

// ---------- 공통 ----------

function sortMonths(months: MonthTarget[]): MonthTarget[] {
  return [...months].sort((a, b) => a.year - b.year || a.month - b.month);
}

function monthFileLabel(m: MonthTarget): string {
  return `${m.year}-${String(m.month + 1).padStart(2, "0")}`;
}

function sheetTitle(m: MonthTarget, multiYear: boolean, typeLabel: string): string {
  return `${multiYear ? `${m.year}년 ` : ""}${m.month + 1}월 ${typeLabel}`;
}

// ---------- 일일정산 (사용자 제공 템플릿 구조 그대로 재현) ----------

const DAILY_MONEY_FMT = '"₩"#,##0';
// 템플릿 파스텔 팔레트
const DAILY_COLOR = {
  title: "FFCAEEFB",
  income: "FFF2CFEE",
  expense: "FFFBE3D6",
  savings: "FFCAEEFB",
  columnHeader: "FFD9D9D9",
};

function styleDailySectionHeader(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  cell.font = { bold: true };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

function styleDailyColumnHeader(cell: ExcelJS.Cell) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DAILY_COLOR.columnHeader } };
  cell.font = { bold: true };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

function writeDailyTxTable(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  startCol: number,
  rows: { date: string; category: string; content: string; amount: number }[]
) {
  ["날짜", "분류", "내용", "금액"].forEach((label, i) => {
    const cell = sheet.getCell(headerRow, startCol + i);
    cell.value = label;
    styleDailyColumnHeader(cell);
  });
  rows.forEach((row, i) => {
    const r = headerRow + 1 + i;
    sheet.getCell(r, startCol).value = row.date;
    sheet.getCell(r, startCol + 1).value = row.category;
    sheet.getCell(r, startCol + 2).value = row.content;
    const amountCell = sheet.getCell(r, startCol + 3);
    amountCell.value = row.amount;
    amountCell.numFmt = DAILY_MONEY_FMT;
    amountCell.alignment = { horizontal: "right" };
  });
}

function writeDailySheet(
  sheet: ExcelJS.Worksheet,
  m: MonthTarget,
  transactions: TransactionWithCategory[],
  incomeCategories: Category[],
  expenseCategories: Category[]
) {
  sheet.columns = [
    { width: 11.9 }, { width: 8.4 }, { width: 13.6 }, { width: 10.5 }, { width: 3 },
    { width: 17 }, { width: 11 }, { width: 21.1 }, { width: 10.5 }, { width: 3 },
    { width: 13 }, { width: 8.4 }, { width: 14.1 }, { width: 12.6 }, { width: 3 },
    { width: 13.75 }, { width: 13.6 }, { width: 15.9 }, { width: 13.75 },
  ];

  sheet.mergeCells(1, 1, 2, 14);
  const title = sheet.getCell(1, 1);
  title.value = `${m.year}년 ${m.month + 1}월`;
  styleDailySectionHeader(title, DAILY_COLOR.title);
  title.font = { bold: true, size: 16 };
  sheet.getRow(1).height = 22;

  const income = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const savings = 0; // 저축 및 투자는 앱에서 아직 추적하지 않는 항목

  let r = 3;
  const summary: [string, number][] = [
    ["전체 수입", income],
    ["전체 지출", expense],
    ["저축 및 투자", savings],
    ["잔여 금액", income - expense - savings],
  ];
  for (const [label, value] of summary) {
    sheet.getCell(r, 1).value = label;
    sheet.mergeCells(r, 2, r, 4);
    const valueCell = sheet.getCell(r, 2);
    valueCell.value = value;
    valueCell.numFmt = DAILY_MONEY_FMT;
    r++;
  }
  r++; // blank row

  const sectionRow = r;
  sheet.mergeCells(sectionRow, 1, sectionRow, 4);
  styleDailySectionHeader(sheet.getCell(sectionRow, 1), DAILY_COLOR.income);
  sheet.getCell(sectionRow, 1).value = "수입";
  sheet.mergeCells(sectionRow, 6, sectionRow, 9);
  styleDailySectionHeader(sheet.getCell(sectionRow, 6), DAILY_COLOR.expense);
  sheet.getCell(sectionRow, 6).value = "지출";
  sheet.mergeCells(sectionRow, 11, sectionRow, 14);
  styleDailySectionHeader(sheet.getCell(sectionRow, 11), DAILY_COLOR.savings);
  sheet.getCell(sectionRow, 11).value = "저축 및 투자";
  r++;

  const totalRow = r;
  sheet.getCell(totalRow, 1).value = "전체 수입";
  sheet.mergeCells(totalRow, 2, totalRow, 4);
  sheet.getCell(totalRow, 2).value = income;
  sheet.getCell(totalRow, 2).numFmt = DAILY_MONEY_FMT;
  sheet.getCell(totalRow, 6).value = "전체 지출";
  sheet.mergeCells(totalRow, 7, totalRow, 9);
  sheet.getCell(totalRow, 7).value = expense;
  sheet.getCell(totalRow, 7).numFmt = DAILY_MONEY_FMT;
  sheet.getCell(totalRow, 11).value = "저축 및 투자";
  sheet.mergeCells(totalRow, 12, totalRow, 14);
  sheet.getCell(totalRow, 12).value = savings;
  sheet.getCell(totalRow, 12).numFmt = DAILY_MONEY_FMT;
  r++;

  const headerRow = r;
  const incomeTx = [...transactions]
    .filter((t) => t.type === "income")
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
    .map((t) => ({ date: t.date, category: t.category?.name ?? "미분류", content: t.memo || t.category?.name || "수입", amount: t.amount }));
  const expenseTx = [...transactions]
    .filter((t) => t.type === "expense")
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
    .map((t) => ({ date: t.date, category: t.category?.name ?? "미분류", content: t.memo || t.category?.name || "지출", amount: t.amount }));

  writeDailyTxTable(sheet, headerRow, 1, incomeTx);
  writeDailyTxTable(sheet, headerRow, 6, expenseTx);
  // 저축 및 투자: 데이터 모델이 아직 없어 헤더만 표시
  ["날짜", "분류", "내용", "금액"].forEach((label, i) => {
    const cell = sheet.getCell(headerRow, 11 + i);
    cell.value = label;
    styleDailyColumnHeader(cell);
  });

  // 우측: 카테고리별 이번 달 합계 (수입 전체, 지출 전체 각각)
  incomeCategories.forEach((category, i) => {
    const rowIdx = headerRow + i;
    const total = transactions
      .filter((t) => t.type === "income" && t.category?.id === category.id)
      .reduce((sum, t) => sum + t.amount, 0);
    sheet.getCell(rowIdx, 16).value = category.name;
    const cell = sheet.getCell(rowIdx, 17);
    cell.value = total;
    cell.numFmt = DAILY_MONEY_FMT;
  });
  expenseCategories.forEach((category, i) => {
    const rowIdx = headerRow + i;
    const total = transactions
      .filter((t) => t.type === "expense" && t.category?.id === category.id)
      .reduce((sum, t) => sum + t.amount, 0);
    sheet.getCell(rowIdx, 18).value = category.name;
    const cell = sheet.getCell(rowIdx, 19);
    cell.value = total;
    cell.numFmt = DAILY_MONEY_FMT;
  });

  sheet.views = [{ state: "frozen", ySplit: headerRow }];
}

// ---------- 주간정산 ----------

/** 일요일부터 시작하는 그 주의 7일 날짜 목록. 월 경계 밖(그 주에 속하지 않는 날)은 null. */
function weekDayDates(week: MonthWeek): (string | null)[] {
  const from = parseDateKey(week.from);
  const sunday = new Date(from);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const key = toDateKey(d);
    return key >= week.from && key <= week.to ? key : null;
  });
}

/** 같은 날 같은 카테고리 거래가 여러 건이면 그만큼 행을 늘려서 각 날짜 칸에 하나씩 배치. */
function stackByDay(
  dayDates: (string | null)[],
  txByDate: Map<string, TransactionWithCategory[]>
): { memo: string; amount: number }[][] {
  const perDay = dayDates.map((d) => (d ? (txByDate.get(d) ?? []) : []));
  const rowCount = Math.max(1, ...perDay.map((list) => list.length));
  return Array.from({ length: rowCount }, (_, k) =>
    perDay.map((list) => (list[k] ? { memo: list[k].memo ?? "", amount: list[k].amount } : { memo: "", amount: 0 }))
  );
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const GRID_COLS = 16; // 1(라벨) + 7*2(요일별 내용/금액) + 1(합계)

function writeWeekDayGrid(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  week: MonthWeek,
  weekTx: TransactionWithCategory[],
  expenseCategories: Category[]
): number {
  let r = startRow;
  const dayDates = weekDayDates(week);

  sheet.mergeCells(r, 1, r, GRID_COLS);
  const title = sheet.getCell(r, 1);
  title.value = `${week.weekNumber}주차 (${week.from} ~ ${week.to})`;
  styleTitle(title, COLOR.primary, 11);
  r++;

  dayDates.forEach((date, i) => {
    const startCol = 2 + i * 2;
    sheet.mergeCells(r, startCol, r, startCol + 1);
    const cell = sheet.getCell(r, startCol);
    cell.value = date ? `${WEEKDAY_LABELS[i]} (${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))})` : "-";
    styleColumnHeader(cell);
    if (!date) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.subtotalGray } };
  });
  styleColumnHeader(sheet.getCell(r, 1));
  styleColumnHeader(sheet.getCell(r, GRID_COLS));
  sheet.getCell(r, GRID_COLS).value = "합계";
  r++;

  function txByDateFor(filter: (t: TransactionWithCategory) => boolean): Map<string, TransactionWithCategory[]> {
    const map = new Map<string, TransactionWithCategory[]>();
    for (const t of weekTx) {
      if (!filter(t)) continue;
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    return map;
  }

  function writeStackedRows(label: string, rows: { memo: string; amount: number }[][], color: string) {
    for (const row of rows) {
      sheet.getCell(r, 1).value = label;
      styleDataCell(sheet.getCell(r, 1), { bold: true });
      let rowTotal = 0;
      row.forEach((entry, i) => {
        const startCol = 2 + i * 2;
        const memoCell = sheet.getCell(r, startCol);
        const amountCell = sheet.getCell(r, startCol + 1);
        if (entry.amount > 0) {
          memoCell.value = entry.memo;
          amountCell.value = entry.amount;
          amountCell.numFmt = MONEY_FMT;
          amountCell.font = { color: { argb: color } };
          rowTotal += entry.amount;
        }
        styleDataCell(memoCell, {});
        styleDataCell(amountCell, { align: "right" });
      });
      const totalCell = sheet.getCell(r, GRID_COLS);
      totalCell.value = rowTotal;
      styleDataCell(totalCell, { money: true, bold: true });
      r++;
    }
  }

  const incomeByDate = txByDateFor((t) => t.type === "income");
  writeStackedRows("수입", stackByDay(dayDates, incomeByDate), COLOR.income);

  for (const category of expenseCategories) {
    const categoryTx = weekTx.filter((t) => t.type === "expense" && t.category?.id === category.id);
    if (categoryTx.length === 0) continue;
    const byDate = new Map<string, TransactionWithCategory[]>();
    for (const t of categoryTx) {
      const list = byDate.get(t.date);
      if (list) list.push(t);
      else byDate.set(t.date, [t]);
    }
    writeStackedRows(category.name, stackByDay(dayDates, byDate), COLOR.expense);
  }

  sheet.getCell(r, 1).value = "일별 지출 총액";
  let weekExpenseTotal = 0;
  dayDates.forEach((date, i) => {
    const startCol = 2 + i * 2;
    sheet.mergeCells(r, startCol, r, startCol + 1);
    const dayTotal = date
      ? weekTx.filter((t) => t.type === "expense" && t.date === date).reduce((sum, t) => sum + t.amount, 0)
      : 0;
    const cell = sheet.getCell(r, startCol);
    cell.value = dayTotal;
    styleDataCell(cell, { money: true });
    weekExpenseTotal += dayTotal;
  });
  const totalCell = sheet.getCell(r, GRID_COLS);
  totalCell.value = weekExpenseTotal;
  styleDataCell(totalCell, { money: true });
  styleDataCell(sheet.getCell(r, 1), {});
  styleTotalRow(sheet.getRow(r), 1, GRID_COLS);
  r++;

  return r + 1; // 다음 주차 블록 전 빈 줄
}

function writeWeeklySheet(
  sheet: ExcelJS.Worksheet,
  m: MonthTarget,
  transactions: TransactionWithCategory[],
  budgetAmount: number,
  expenseCategories: Category[]
) {
  const weeks = getMonthWeeks(m.year, m.month);

  sheet.columns = [
    { width: 15 },
    ...Array.from({ length: GRID_COLS - 1 }, () => ({ width: 12 })),
  ];

  let r = 1;
  sheet.mergeCells(r, 1, r, weeks.length + 1);
  const title = sheet.getCell(r, 1);
  title.value = `${m.month + 1}월 누적금액`;
  styleTitle(title, COLOR.primary, 13);
  r++;

  sheet.getCell(r, 1).value = "월 예산액";
  styleDataCell(sheet.getCell(r, 1), { bold: true });
  const budgetCell = sheet.getCell(r, 2);
  budgetCell.value = budgetAmount;
  styleDataCell(budgetCell, { money: true, bold: true });
  r++;

  styleColumnHeader(sheet.getCell(r, 1));
  weeks.forEach((week, i) => {
    const cell = sheet.getCell(r, i + 2);
    cell.value = `${week.weekNumber}주차`;
    styleColumnHeader(cell);
  });
  r++;

  function cumulativeThrough(week: MonthWeek, filter: (t: TransactionWithCategory) => boolean): number {
    return transactions.filter((t) => filter(t) && t.date <= week.to).reduce((sum, t) => sum + t.amount, 0);
  }

  sheet.getCell(r, 1).value = "수입";
  styleDataCell(sheet.getCell(r, 1), { bold: true });
  weeks.forEach((week, i) => {
    const cell = sheet.getCell(r, i + 2);
    cell.value = cumulativeThrough(week, (t) => t.type === "income");
    styleDataCell(cell, { money: true, color: COLOR.income });
  });
  r++;

  for (const category of expenseCategories) {
    sheet.getCell(r, 1).value = category.name;
    styleDataCell(sheet.getCell(r, 1), {});
    weeks.forEach((week, i) => {
      const cell = sheet.getCell(r, i + 2);
      cell.value = cumulativeThrough(week, (t) => t.type === "expense" && t.category?.id === category.id);
      styleDataCell(cell, { money: true });
    });
    r++;
  }

  sheet.getCell(r, 1).value = "지출 누적 총액";
  weeks.forEach((week, i) => {
    const cell = sheet.getCell(r, i + 2);
    cell.value = cumulativeThrough(week, isWeeklyBudgetExpense);
    styleDataCell(cell, { money: true, color: COLOR.expense });
  });
  styleTotalRow(sheet.getRow(r), 1, weeks.length + 1);
  r++;

  sheet.getCell(r, 1).value = "예산 잔액";
  weeks.forEach((week, i) => {
    const remaining = budgetAmount - cumulativeThrough(week, isWeeklyBudgetExpense);
    const cell = sheet.getCell(r, i + 2);
    cell.value = remaining;
    styleDataCell(cell, { money: true, color: remaining < 0 ? COLOR.expense : COLOR.income });
  });
  styleTotalRow(sheet.getRow(r), 1, weeks.length + 1);
  r += 2;

  for (const week of weeks) {
    const weekTx = transactions.filter((t) => t.date >= week.from && t.date <= week.to);
    r = writeWeekDayGrid(sheet, r, week, weekTx, expenseCategories);
  }
}

// ---------- 월간정산 ----------

function writeBudgetTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  actualLabel: string,
  titleArgb: string,
  rows: BudgetReviewRow[]
): number {
  let r = startRow;
  const visible = rows.filter((row) => row.actual !== 0);

  sheet.mergeCells(r, 1, r, 6);
  const titleCell = sheet.getCell(r, 1);
  titleCell.value = title;
  styleTitle(titleCell, titleArgb);
  r++;

  ["세부항목", "예산", actualLabel, "오차", "오차원인", "피드백"].forEach((label, i) => {
    const cell = sheet.getCell(r, i + 1);
    cell.value = label;
    styleColumnHeader(cell);
  });
  r++;

  if (visible.length === 0) {
    sheet.mergeCells(r, 1, r, 6);
    sheet.getCell(r, 1).value = "항목이 없습니다";
    styleDataCell(sheet.getCell(r, 1), { align: "center" });
    r++;
    return r + 1;
  }

  let totalBudget = 0;
  let totalActual = 0;
  const type = visible[0].category.type;
  for (const row of visible) {
    const budget = row.budget?.amount ?? 0;
    const variance = budget - row.actual;
    totalBudget += budget;
    totalActual += row.actual;

    sheet.getCell(r, 1).value = row.label || row.category.name;
    styleDataCell(sheet.getCell(r, 1), {});
    sheet.getCell(r, 2).value = budget;
    styleDataCell(sheet.getCell(r, 2), { money: true });
    sheet.getCell(r, 3).value = row.actual;
    styleDataCell(sheet.getCell(r, 3), { money: true });
    sheet.getCell(r, 4).value = variance;
    styleDataCell(sheet.getCell(r, 4), { money: true, color: varianceArgb(type, variance) });
    sheet.getCell(r, 5).value = row.budget?.reason ?? "";
    styleDataCell(sheet.getCell(r, 5), {});
    sheet.getCell(r, 6).value = row.budget?.feedback ?? "";
    styleDataCell(sheet.getCell(r, 6), {});
    r++;
  }

  const totalVariance = totalBudget - totalActual;
  sheet.getCell(r, 1).value = "총계";
  sheet.getCell(r, 2).value = totalBudget;
  sheet.getCell(r, 2).numFmt = MONEY_FMT;
  sheet.getCell(r, 3).value = totalActual;
  sheet.getCell(r, 3).numFmt = MONEY_FMT;
  sheet.getCell(r, 4).value = totalVariance;
  sheet.getCell(r, 4).numFmt = MONEY_FMT;
  sheet.getCell(r, 4).font = { bold: true, color: varianceArgb(type, totalVariance) ? { argb: varianceArgb(type, totalVariance) } : undefined };
  styleTotalRow(sheet.getRow(r), 1, 6);
  r++;

  return r + 1;
}

function writeVariableExpenseTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  categories: Category[],
  variableBudgetItems: Parameters<typeof buildGroups>[1],
  budgets: Parameters<typeof buildGroups>[2],
  transactions: TransactionWithCategory[]
): number {
  let r = startRow;
  sheet.mergeCells(r, 1, r, 6);
  const titleCell = sheet.getCell(r, 1);
  titleCell.value = "변동지출";
  styleTitle(titleCell, COLOR.variable);
  r++;

  ["항목", "예산", "사용금액", "오차", "오차원인", "피드백"].forEach((label, i) => {
    const cell = sheet.getCell(r, i + 1);
    cell.value = label;
    styleColumnHeader(cell);
  });
  r++;

  const groups = buildGroups(categories, variableBudgetItems, budgets, transactions);
  if (groups.length === 0) {
    sheet.mergeCells(r, 1, r, 6);
    sheet.getCell(r, 1).value = "항목이 없습니다";
    styleDataCell(sheet.getCell(r, 1), { align: "center" });
    r++;
    return r + 1;
  }

  let grandBudget = 0;
  let grandActual = 0;
  for (const group of groups) {
    const itemRows: { label: string; budget: number; actual: number; reason: string; feedback: string }[] =
      group.items.map((item) => ({
        label: item.memo || item.category?.name || "미분류",
        budget: item.amount,
        actual: actualForItem(item, transactions),
        reason: item.reason ?? "",
        feedback: item.feedback ?? "",
      }));
    if (group.showRemainder) {
      itemRows.push({
        label: group.remainderLabel || group.category.name,
        budget: group.remainderAmount,
        actual: group.remainderActual,
        reason: group.remainderReason ?? "",
        feedback: group.remainderFeedback ?? "",
      });
    }

    for (const item of itemRows) {
      const variance = item.budget - item.actual;
      sheet.getCell(r, 1).value = item.label;
      styleDataCell(sheet.getCell(r, 1), {});
      sheet.getCell(r, 2).value = item.budget;
      styleDataCell(sheet.getCell(r, 2), { money: true });
      sheet.getCell(r, 3).value = item.actual;
      styleDataCell(sheet.getCell(r, 3), { money: true });
      sheet.getCell(r, 4).value = variance;
      styleDataCell(sheet.getCell(r, 4), { money: true, color: varianceArgb("expense", variance) });
      sheet.getCell(r, 5).value = item.reason;
      styleDataCell(sheet.getCell(r, 5), {});
      sheet.getCell(r, 6).value = item.feedback;
      styleDataCell(sheet.getCell(r, 6), {});
      r++;
    }

    const groupVariance = group.budget - group.actual;
    sheet.getCell(r, 1).value = `${group.category.name} 총계`;
    sheet.getCell(r, 2).value = group.budget;
    sheet.getCell(r, 2).numFmt = MONEY_FMT;
    sheet.getCell(r, 3).value = group.actual;
    sheet.getCell(r, 3).numFmt = MONEY_FMT;
    sheet.getCell(r, 4).value = groupVariance;
    sheet.getCell(r, 4).numFmt = MONEY_FMT;
    styleTotalRow(sheet.getRow(r), 1, 6);
    r++;

    grandBudget += group.budget;
    grandActual += group.actual;
  }

  const grandVariance = grandBudget - grandActual;
  sheet.getCell(r, 1).value = "총합계";
  sheet.getCell(r, 2).value = grandBudget;
  sheet.getCell(r, 2).numFmt = MONEY_FMT;
  sheet.getCell(r, 3).value = grandActual;
  sheet.getCell(r, 3).numFmt = MONEY_FMT;
  sheet.getCell(r, 4).value = grandVariance;
  sheet.getCell(r, 4).numFmt = MONEY_FMT;
  sheet.getCell(r, 4).font = {
    bold: true,
    color: varianceArgb("expense", grandVariance) ? { argb: varianceArgb("expense", grandVariance) } : undefined,
  };
  styleTotalRow(sheet.getRow(r), 1, 6);
  r++;

  return r + 1;
}

function writeAssetTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  prevMonth: string,
  month: string,
  assetItems: AssetItem[],
  assetSnapshots: AssetSnapshot[],
  prevAssetSnapshots: AssetSnapshot[]
): number {
  let r = startRow;
  sheet.mergeCells(r, 1, r, 8);
  const titleCell = sheet.getCell(r, 1);
  titleCell.value = "자산현황";
  styleTitle(titleCell, COLOR.asset);
  r++;

  const prevLabel = `${Number(prevMonth.slice(5, 7))}월 자산`;
  const curLabel = `${Number(month.slice(5, 7))}월 자산`;
  ["구분", "내역", "상세내역", prevLabel, curLabel, "오차", "오차원인", "피드백"].forEach((label, i) => {
    const cell = sheet.getCell(r, i + 1);
    cell.value = label;
    styleColumnHeader(cell);
  });
  r++;

  if (assetItems.length === 0) {
    sheet.mergeCells(r, 1, r, 8);
    sheet.getCell(r, 1).value = "항목이 없습니다";
    styleDataCell(sheet.getCell(r, 1), { align: "center" });
    r++;
    return r;
  }

  const snapshotByItem = new Map(assetSnapshots.map((s) => [s.asset_item_id, s]));
  const prevAmountByItem = new Map(prevAssetSnapshots.map((s) => [s.asset_item_id, s.amount]));

  let groupAmount = 0;
  let groupPrevAmount = 0;
  let grandAmount = 0;
  let grandPrevAmount = 0;

  assetItems.forEach((item, i) => {
    const snapshot = snapshotByItem.get(item.id);
    const amount = snapshot?.amount ?? 0;
    const prevAmount = prevAmountByItem.get(item.id) ?? 0;
    const variance = amount - prevAmount;

    sheet.getCell(r, 1).value = item.group_name;
    sheet.getCell(r, 2).value = item.subgroup;
    sheet.getCell(r, 3).value = item.label;
    sheet.getCell(r, 4).value = prevAmount;
    sheet.getCell(r, 5).value = amount;
    sheet.getCell(r, 6).value = variance;
    sheet.getCell(r, 7).value = snapshot?.reason ?? "";
    sheet.getCell(r, 8).value = snapshot?.feedback ?? "";
    styleDataCell(sheet.getCell(r, 1), {});
    styleDataCell(sheet.getCell(r, 2), {});
    styleDataCell(sheet.getCell(r, 3), {});
    styleDataCell(sheet.getCell(r, 4), { money: true });
    styleDataCell(sheet.getCell(r, 5), { money: true });
    styleDataCell(sheet.getCell(r, 6), { money: true, color: variance === 0 ? undefined : variance > 0 ? COLOR.income : COLOR.expense });
    styleDataCell(sheet.getCell(r, 7), {});
    styleDataCell(sheet.getCell(r, 8), {});
    r++;

    groupAmount += amount;
    groupPrevAmount += prevAmount;
    grandAmount += amount;
    grandPrevAmount += prevAmount;

    const next = assetItems[i + 1];
    if (!next || next.group_name !== item.group_name) {
      const groupVariance = groupAmount - groupPrevAmount;
      sheet.mergeCells(r, 1, r, 3);
      sheet.getCell(r, 1).value = `${item.group_name} 총계`;
      sheet.getCell(r, 4).value = groupPrevAmount;
      sheet.getCell(r, 4).numFmt = MONEY_FMT;
      sheet.getCell(r, 5).value = groupAmount;
      sheet.getCell(r, 5).numFmt = MONEY_FMT;
      sheet.getCell(r, 6).value = groupVariance;
      sheet.getCell(r, 6).numFmt = MONEY_FMT;
      styleTotalRow(sheet.getRow(r), 1, 8);
      r++;
      groupAmount = 0;
      groupPrevAmount = 0;
    }
  });

  const grandVariance = grandAmount - grandPrevAmount;
  sheet.mergeCells(r, 1, r, 3);
  sheet.getCell(r, 1).value = "총합계";
  sheet.getCell(r, 4).value = grandPrevAmount;
  sheet.getCell(r, 4).numFmt = MONEY_FMT;
  sheet.getCell(r, 5).value = grandAmount;
  sheet.getCell(r, 5).numFmt = MONEY_FMT;
  sheet.getCell(r, 6).value = grandVariance;
  sheet.getCell(r, 6).numFmt = MONEY_FMT;
  styleTotalRow(sheet.getRow(r), 1, 8);
  r++;

  return r;
}

function writeMonthlySheet(
  sheet: ExcelJS.Worksheet,
  m: MonthTarget,
  transactions: TransactionWithCategory[],
  incomeCategories: Category[],
  expenseCategories: Category[],
  budgets: ExportData["byMonth"][string]["budgets"],
  assetItems: AssetItem[],
  assetSnapshots: AssetSnapshot[],
  prevAssetSnapshots: AssetSnapshot[],
  variableBudgetItems: ExportData["byMonth"][string]["variableBudgetItems"],
  budgetLabels: BudgetLabel[]
) {
  const range = getMonthRange(m.year, m.month);
  const monthKey = range.from;
  const prevDate = new Date(m.year, m.month - 1, 1);
  const prevMonthKey = getMonthRange(prevDate.getFullYear(), prevDate.getMonth()).from;

  const fixedExpenseCategories = expenseCategories.filter((c) => c.report_group === FIXED_EXPENSE_GROUP);
  const variableExpenseCategories = expenseCategories.filter((c) => c.report_group !== FIXED_EXPENSE_GROUP);

  sheet.columns = [
    { width: 20 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 26 },
    { width: 26 },
    { width: 20 },
    { width: 20 },
  ];

  let r = 1;
  const incomeRows = buildRows(incomeCategories, transactions, budgets);
  r = writeBudgetTable(sheet, r, "수입", "수입", COLOR.income, incomeRows);

  const fixedRows = buildFixedExpenseLabelRows(fixedExpenseCategories, transactions, budgets, budgetLabels);
  r = writeBudgetTable(sheet, r, "고정지출", "사용 금액", COLOR.fixed, fixedRows);

  r = writeVariableExpenseTable(sheet, r, variableExpenseCategories, variableBudgetItems, budgets, transactions);

  writeAssetTable(sheet, r, prevMonthKey, monthKey, assetItems, assetSnapshots, prevAssetSnapshots);
}

// ---------- 다운로드 ----------

function saveWorkbook(buffer: ExcelJS.Buffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportSettlementExcel(months: MonthTarget[], types: SettlementTypes): Promise<void> {
  const sorted = sortMonths(months);
  const multiYear = new Set(sorted.map((m) => m.year)).size > 1;

  // 선택된 달 전체에 필요한 데이터를 서버 왕복 한 번으로 모아온 뒤, 아래는 그 결과만 가지고 동기적으로 시트를 채운다.
  const exportData = await fetchExportData(sorted);

  const workbook = new ExcelJS.Workbook();

  for (const m of sorted) {
    if (!types.daily && !types.weekly && !types.monthly) continue;
    const monthKey = getMonthRange(m.year, m.month).from;
    const prevDate = new Date(m.year, m.month - 1, 1);
    const prevMonthKey = getMonthRange(prevDate.getFullYear(), prevDate.getMonth()).from;
    const monthData = exportData.byMonth[monthKey];
    const transactions = monthData.transactions;

    if (types.daily) {
      const sheet = workbook.addWorksheet(sheetTitle(m, multiYear, "일일정산"));
      writeDailySheet(sheet, m, transactions, exportData.incomeCategories, exportData.expenseCategories);
    }
    if (types.weekly) {
      const sheet = workbook.addWorksheet(sheetTitle(m, multiYear, "주간정산"));
      writeWeeklySheet(sheet, m, transactions, monthData.monthlyBudgetAmount, exportData.expenseCategories);
    }
    if (types.monthly) {
      const sheet = workbook.addWorksheet(sheetTitle(m, multiYear, "월간정산"));
      writeMonthlySheet(
        sheet,
        m,
        transactions,
        exportData.incomeCategories,
        exportData.expenseCategories,
        monthData.budgets,
        exportData.assetItems,
        exportData.assetSnapshotsByMonth[monthKey] ?? [],
        exportData.assetSnapshotsByMonth[prevMonthKey] ?? [],
        monthData.variableBudgetItems,
        exportData.budgetLabels
      );
    }
  }

  const first = monthFileLabel(sorted[0]);
  const last = monthFileLabel(sorted[sorted.length - 1]);
  const fileName = `가계부_${first === last ? first : `${first}~${last}`}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  saveWorkbook(buffer, fileName);
}
