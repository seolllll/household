"use server";

import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { requireHouseholdId } from "@/lib/session";
import type {
  AssetItem,
  AssetSnapshot,
  Budget,
  BudgetLabel,
  Category,
  MonthlyBudget,
  Transaction,
  TransactionType,
  VariableBudgetItem,
  WeeklyBudgetItem,
} from "@/types/database";
import { getMonthRange, type DateRange } from "@/lib/date-range";
import { FIXED_EXPENSE_GROUP } from "@/lib/budget-rows";
import type { ParsedImportItem } from "@/lib/import-excel";

export type TransactionWithCategory = Transaction & { category: Category | null };
export type BudgetWithCategory = Budget & { category: Category | null };
export type WeeklyBudgetItemWithCategory = WeeklyBudgetItem & { category: Category | null };

const CATEGORY_COLOR_PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

function pickCategoryColor(existing: Category[]): string {
  const used = new Set(existing.map((c) => c.color).filter(Boolean));
  const available = CATEGORY_COLOR_PALETTE.filter((c) => !used.has(c));
  const pool = available.length > 0 ? available : CATEGORY_COLOR_PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function fetchCategories(type: TransactionType): Promise<Category[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .eq("type", type)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(name: string, type: TransactionType): Promise<string> {
  const householdId = await requireHouseholdId();
  const { data: inactive, error: findError } = await supabase
    .from("categories")
    .select("id")
    .eq("household_id", householdId)
    .eq("type", type)
    .eq("name", name)
    .eq("is_active", false)
    .maybeSingle();
  if (findError) throw findError;

  if (inactive) {
    const { error } = await supabase
      .from("categories")
      .update({ is_active: true })
      .eq("id", inactive.id)
      .eq("household_id", householdId);
    if (error) throw error;
    return inactive.id;
  }

  const categories = await fetchCategories(type);
  const nextSortOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;
  const { data, error } = await supabase
    .from("categories")
    .insert({
      household_id: householdId,
      name,
      type,
      sort_order: nextSortOrder,
      color: pickCategoryColor(categories),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCategory(id: string, name: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: false })
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function fetchRecentCategoryIds(
  type: TransactionType,
  limit = 6
): Promise<string[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("transactions")
    .select("category_id")
    .eq("household_id", householdId)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  const seen: string[] = [];
  for (const row of data ?? []) {
    if (!seen.includes(row.category_id)) seen.push(row.category_id);
    if (seen.length >= limit) break;
  }
  return seen;
}

export async function fetchTransactions(range: DateRange): Promise<TransactionWithCategory[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .eq("household_id", householdId)
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TransactionWithCategory[];
}

export async function fetchAllTransactions(): Promise<TransactionWithCategory[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .eq("household_id", householdId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TransactionWithCategory[];
}

export interface NewTransactionInput {
  type: TransactionType;
  amount: number;
  category_id: string;
  date: string;
  memo: string | null;
}

export async function createTransaction(input: NewTransactionInput): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("transactions")
    .insert({ ...input, household_id: householdId });
  if (error) throw error;
}

export async function updateTransaction(id: string, input: NewTransactionInput): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("transactions")
    .update(input)
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function fetchMonthlyBudget(month: string): Promise<MonthlyBudget | null> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select("*")
    .eq("household_id", householdId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertMonthlyBudget(month: string, amount: number): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("monthly_budgets")
    .upsert({ household_id: householdId, month, amount }, { onConflict: "household_id,month" });
  if (error) throw error;
}

export async function fetchWeeklyBudgetItems(range: DateRange): Promise<WeeklyBudgetItemWithCategory[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("weekly_budget_items")
    .select("*, category:categories(*)")
    .eq("household_id", householdId)
    .gte("week_start", range.from)
    .lte("week_start", range.to);
  if (error) throw error;
  return (data ?? []) as unknown as WeeklyBudgetItemWithCategory[];
}

export interface WeeklyBudgetItemInput {
  week_start: string;
  category_id: string;
  amount: number;
  memo: string | null;
}

export async function createWeeklyBudgetItem(input: WeeklyBudgetItemInput): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("weekly_budget_items")
    .insert({ ...input, household_id: householdId });
  if (error) throw error;
}

export async function updateWeeklyBudgetItem(id: string, input: WeeklyBudgetItemInput): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("weekly_budget_items")
    .update(input)
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function deleteWeeklyBudgetItem(id: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("weekly_budget_items")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function fetchBudgetLabels(categoryIds: string[]): Promise<BudgetLabel[]> {
  if (categoryIds.length === 0) return [];
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("budget_labels")
    .select("*")
    .eq("household_id", householdId)
    .in("category_id", categoryIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBudgetLabel(categoryId: string, name: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { data: last, error: findError } = await supabase
    .from("budget_labels")
    .select("sort_order")
    .eq("household_id", householdId)
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  const { error } = await supabase.from("budget_labels").insert({
    household_id: householdId,
    category_id: categoryId,
    name,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) throw error;
}

export async function renameBudgetLabel(
  id: string,
  categoryId: string,
  oldName: string,
  newName: string
): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("budget_labels")
    .update({ name: newName })
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
  // 이 세부항목으로 이미 저장된 과거 예산 기록도 새 이름을 따라가도록 함께 갱신.
  const { error: budgetsError } = await supabase
    .from("budgets")
    .update({ label: newName })
    .eq("household_id", householdId)
    .eq("category_id", categoryId)
    .eq("label", oldName);
  if (budgetsError) throw budgetsError;
}

export async function deleteBudgetLabel(id: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("budget_labels")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function fetchBudgets(month: string): Promise<BudgetWithCategory[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("budgets")
    .select("*, category:categories(*)")
    .eq("household_id", householdId)
    .eq("month", month);
  if (error) throw error;
  return (data ?? []) as unknown as BudgetWithCategory[];
}

export async function upsertBudget(
  categoryId: string,
  month: string,
  label: string,
  amount: number,
  reason: string | null,
  feedback: string | null
): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { household_id: householdId, category_id: categoryId, month, label, amount, reason, feedback },
      { onConflict: "category_id,month,label" }
    );
  if (error) throw error;
}

export type VariableBudgetItemWithCategory = VariableBudgetItem & { category: Category | null };

export async function fetchVariableBudgetItems(month: string): Promise<VariableBudgetItemWithCategory[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("variable_budget_items")
    .select("*, category:categories(*)")
    .eq("household_id", householdId)
    .eq("month", month);
  if (error) throw error;
  return (data ?? []) as unknown as VariableBudgetItemWithCategory[];
}

export interface VariableBudgetItemInput {
  month: string;
  category_id: string;
  amount: number;
  memo: string | null;
  detail_memo: string | null;
}

/** 변동지출 계획 항목의 카테고리별 합계를 budgets.amount에 동기화(오차원인·피드백은 기존 값 유지). 월말정산의 예산 숫자가 이 목록을 그대로 따라가게 하기 위함. */
async function syncVariableCategoryBudget(
  householdId: string,
  categoryId: string,
  month: string
): Promise<void> {
  const { data: items, error: itemsError } = await supabase
    .from("variable_budget_items")
    .select("amount")
    .eq("household_id", householdId)
    .eq("category_id", categoryId)
    .eq("month", month);
  if (itemsError) throw itemsError;
  const total = (items ?? []).reduce((sum, it) => sum + it.amount, 0);

  const { data: existing, error: findError } = await supabase
    .from("budgets")
    .select("reason, feedback")
    .eq("household_id", householdId)
    .eq("category_id", categoryId)
    .eq("month", month)
    .eq("label", "")
    .maybeSingle();
  if (findError) throw findError;

  await upsertBudget(categoryId, month, "", total, existing?.reason ?? null, existing?.feedback ?? null);
}

export async function createVariableBudgetItem(input: VariableBudgetItemInput): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("variable_budget_items")
    .insert({ ...input, household_id: householdId });
  if (error) throw error;
  await syncVariableCategoryBudget(householdId, input.category_id, input.month);
}

export async function updateVariableBudgetItem(
  id: string,
  input: VariableBudgetItemInput,
  previousCategoryId?: string
): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("variable_budget_items")
    .update(input)
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
  await syncVariableCategoryBudget(householdId, input.category_id, input.month);
  if (previousCategoryId && previousCategoryId !== input.category_id) {
    await syncVariableCategoryBudget(householdId, previousCategoryId, input.month);
  }
}

export async function deleteVariableBudgetItem(id: string, categoryId: string, month: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("variable_budget_items")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
  await syncVariableCategoryBudget(householdId, categoryId, month);
}

export async function updateVariableBudgetItemReview(
  id: string,
  reason: string | null,
  feedback: string | null
): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("variable_budget_items")
    .update({ reason, feedback })
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function fetchAssetItems(): Promise<AssetItem[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("asset_items")
    .select("*")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 구분(group_name)별로, 그 안에서는 내역(subgroup)별로 sort_order를 다시 매겨 목록 안에서 같은 구분/내역끼리 항상 붙어있게 만든다. */
async function resequenceAssetItems(): Promise<void> {
  const items = await fetchAssetItems();

  const groupOrder: string[] = [];
  const subgroupOrderByGroup = new Map<string, string[]>();
  const buckets = new Map<string, AssetItem[]>();
  for (const item of items) {
    if (!groupOrder.includes(item.group_name)) groupOrder.push(item.group_name);
    const subgroupOrder = subgroupOrderByGroup.get(item.group_name) ?? [];
    if (!subgroupOrder.includes(item.subgroup)) subgroupOrder.push(item.subgroup);
    subgroupOrderByGroup.set(item.group_name, subgroupOrder);
    const key = `${item.group_name} ${item.subgroup}`;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }

  const ordered = groupOrder.flatMap((group) =>
    (subgroupOrderByGroup.get(group) ?? []).flatMap(
      (subgroup) => buckets.get(`${group} ${subgroup}`) ?? []
    )
  );

  if (ordered.every((item, index) => item.sort_order === index)) return;

  // 최종 순서로 바로 옮기면 아직 안 옮겨진 다른 행과 sort_order가 잠깐 겹칠 수 있어, 안 쓰는 임시 구간으로 먼저 옮긴 뒤 최종 위치로 옮긴다.
  // 행마다 따로 요청을 보내면 중간에 끊겼을 때 절반만 바뀐 채로 남을 수 있어, 각 단계를 요청 하나(bulk upsert)로 묶는다.
  const TEMP_OFFSET = 1_000_000;
  const { error: tempError } = await supabase
    .from("asset_items")
    .upsert(ordered.map((item, index) => ({ ...item, sort_order: TEMP_OFFSET + index })));
  if (tempError) throw tempError;

  const { error: finalError } = await supabase
    .from("asset_items")
    .upsert(ordered.map((item, index) => ({ ...item, sort_order: index })));
  if (finalError) throw finalError;
}

export async function createAssetItem(groupName: string, subgroup: string, label: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { data: last, error: findError } = await supabase
    .from("asset_items")
    .select("sort_order")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  const { error } = await supabase.from("asset_items").insert({
    household_id: householdId,
    group_name: groupName,
    subgroup,
    label,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) throw error;
  await resequenceAssetItems();
}

export async function updateAssetItem(
  id: string,
  groupName: string,
  subgroup: string,
  label: string
): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("asset_items")
    .update({ group_name: groupName, subgroup, label })
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
  await resequenceAssetItems();
}

export async function deleteAssetItem(id: string): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("asset_items")
    .update({ is_active: false })
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) throw error;
}

export async function fetchAssetSnapshots(month: string): Promise<AssetSnapshot[]> {
  const householdId = await requireHouseholdId();
  const { data, error } = await supabase
    .from("asset_snapshots")
    .select("*")
    .eq("household_id", householdId)
    .eq("month", month);
  if (error) throw error;
  return data ?? [];
}

export async function upsertAssetSnapshot(
  assetItemId: string,
  month: string,
  amount: number,
  reason: string | null,
  feedback: string | null
): Promise<void> {
  const householdId = await requireHouseholdId();
  const { error } = await supabase
    .from("asset_snapshots")
    .upsert(
      { household_id: householdId, asset_item_id: assetItemId, month, amount, reason, feedback },
      { onConflict: "asset_item_id,month" }
    );
  if (error) throw error;
}

/**
 * 페이지별 묶음 조회 함수 모음.
 *
 * Next.js Server Function은 클라이언트에서 `Promise.all`로 여러 개를 동시에 불러도
 * 브라우저→서버 요청은 한 번에 하나씩만 처리된다("dispatches and awaits them one at a time").
 * 그래서 화면 하나가 fetch* 함수를 여러 번 부르면 병렬이 아니라 순차 왕복이 되어 느려진다.
 * 아래 함수들은 그 여러 번의 호출을 서버 안에서 한 번에 묶어(Promise.all은 서버 내부에서는
 * 정상적으로 병렬 처리됨) 클라이언트는 왕복 한 번만 하도록 만든 것.
 */

export interface WeeklyListPageData {
  transactions: TransactionWithCategory[];
  budgetAmount: number;
  weeklyBudgetItems: WeeklyBudgetItemWithCategory[];
}

export async function fetchWeeklyListPageData(
  range: DateRange,
  monthKey: string
): Promise<WeeklyListPageData> {
  const [transactions, budget, weeklyBudgetItems] = await Promise.all([
    fetchTransactions(range),
    fetchMonthlyBudget(monthKey),
    fetchWeeklyBudgetItems(range),
  ]);
  return { transactions, budgetAmount: budget?.amount ?? 0, weeklyBudgetItems };
}

export interface WeeklyDetailPageData {
  weekTransactions: TransactionWithCategory[];
  cumulativeTransactions: TransactionWithCategory[];
  budgetAmount: number;
  weeklyBudgetItems: WeeklyBudgetItemWithCategory[];
}

export async function fetchWeeklyDetailPageData(
  weekRange: DateRange,
  cumulativeRange: DateRange,
  monthKey: string
): Promise<WeeklyDetailPageData> {
  const [weekTransactions, cumulativeTransactions, budget, weeklyBudgetItems] = await Promise.all([
    fetchTransactions(weekRange),
    fetchTransactions(cumulativeRange),
    fetchMonthlyBudget(monthKey),
    fetchWeeklyBudgetItems(weekRange),
  ]);
  return {
    weekTransactions,
    cumulativeTransactions,
    budgetAmount: budget?.amount ?? 0,
    weeklyBudgetItems,
  };
}

export interface MonthlyPageData {
  transactions: TransactionWithCategory[];
  budgetAmount: number;
  incomeCategories: Category[];
  expenseCategories: Category[];
  budgets: BudgetWithCategory[];
  assetItems: AssetItem[];
  assetSnapshots: AssetSnapshot[];
  prevAssetSnapshots: AssetSnapshot[];
  variableBudgetItems: VariableBudgetItemWithCategory[];
  budgetLabels: BudgetLabel[];
}

export async function fetchMonthlyPageData(
  range: DateRange,
  monthKey: string,
  prevMonthKey: string
): Promise<MonthlyPageData> {
  const [
    transactions,
    monthlyBudget,
    incomeCategories,
    expenseCategories,
    budgets,
    assetItems,
    assetSnapshots,
    prevAssetSnapshots,
    variableBudgetItems,
  ] = await Promise.all([
    fetchTransactions(range),
    fetchMonthlyBudget(monthKey),
    fetchCategories("income"),
    fetchCategories("expense"),
    fetchBudgets(monthKey),
    fetchAssetItems(),
    fetchAssetSnapshots(monthKey),
    fetchAssetSnapshots(prevMonthKey),
    fetchVariableBudgetItems(monthKey),
  ]);
  const fixedCategoryIds = expenseCategories
    .filter((c) => c.report_group === FIXED_EXPENSE_GROUP)
    .map((c) => c.id);
  const budgetLabels = await fetchBudgetLabels(fixedCategoryIds);
  return {
    transactions,
    budgetAmount: monthlyBudget?.amount ?? 0,
    incomeCategories,
    expenseCategories,
    budgets,
    assetItems,
    assetSnapshots,
    prevAssetSnapshots,
    variableBudgetItems,
    budgetLabels,
  };
}

export interface BudgetPlanPageData {
  incomeCategories: Category[];
  expenseCategories: Category[];
  budgets: BudgetWithCategory[];
  budgetLabels: BudgetLabel[];
  livingBudget: number;
  weeklyBudgetItems: WeeklyBudgetItemWithCategory[];
  variableBudgetItems: VariableBudgetItemWithCategory[];
}

export async function fetchBudgetPlanPageData(
  range: DateRange,
  monthKey: string
): Promise<BudgetPlanPageData> {
  const [incomeCategories, expenseCategories, budgets, monthlyBudget, weeklyBudgetItems, variableBudgetItems] =
    await Promise.all([
      fetchCategories("income"),
      fetchCategories("expense"),
      fetchBudgets(monthKey),
      fetchMonthlyBudget(monthKey),
      fetchWeeklyBudgetItems(range),
      fetchVariableBudgetItems(monthKey),
    ]);
  const fixedCategoryIds = expenseCategories
    .filter((c) => c.report_group === FIXED_EXPENSE_GROUP)
    .map((c) => c.id);
  const budgetLabels = await fetchBudgetLabels(fixedCategoryIds);
  return {
    incomeCategories,
    expenseCategories,
    budgets,
    budgetLabels,
    livingBudget: monthlyBudget?.amount ?? 0,
    weeklyBudgetItems,
    variableBudgetItems,
  };
}

export interface InvestmentTrendData {
  assetItems: AssetItem[];
  snapshotsByMonth: Record<string, AssetSnapshot[]>;
}

export async function fetchInvestmentTrendData(monthKeys: string[]): Promise<InvestmentTrendData> {
  const [assetItems, snapshotsList] = await Promise.all([
    fetchAssetItems(),
    Promise.all(monthKeys.map((key) => fetchAssetSnapshots(key))),
  ]);
  const snapshotsByMonth: Record<string, AssetSnapshot[]> = {};
  monthKeys.forEach((key, i) => {
    snapshotsByMonth[key] = snapshotsList[i];
  });
  return { assetItems, snapshotsByMonth };
}

export interface BulkImportResult {
  added: number;
  skipped: number;
}

/** 엑셀 업로드 시 항목마다 서버를 왕복하지 않도록, 카테고리 생성부터 거래 추가까지 서버 한 번의 호출 안에서 처리. */
export async function bulkImportTransactions(
  items: ParsedImportItem[],
  incomeCategoryNames: string[],
  expenseCategoryNames: string[]
): Promise<BulkImportResult> {
  const [incomeCategories, expenseCategories] = await Promise.all([
    fetchCategories("income"),
    fetchCategories("expense"),
  ]);
  const categoryIdByKey = new Map<string, string>();
  for (const c of incomeCategories) categoryIdByKey.set(`income:${c.name}`, c.id);
  for (const c of expenseCategories) categoryIdByKey.set(`expense:${c.name}`, c.id);

  async function ensureCategoryId(type: TransactionType, name: string): Promise<string> {
    const key = `${type}:${name}`;
    let id = categoryIdByKey.get(key);
    if (!id) {
      id = await createCategory(name, type);
      categoryIdByKey.set(key, id);
    }
    return id;
  }

  // 이번 달 거래가 없어 금액이 0인 분류도 목록에 있으면 미리 생성해둔다.
  for (const name of incomeCategoryNames) await ensureCategoryId("income", name);
  for (const name of expenseCategoryNames) await ensureCategoryId("expense", name);

  let added = 0;
  let skipped = 0;
  for (const item of items) {
    try {
      const categoryId = await ensureCategoryId(item.type, item.categoryName);
      await createTransaction({
        type: item.type,
        amount: item.amount,
        category_id: categoryId,
        date: item.date,
        memo: item.memo,
      });
      added++;
    } catch {
      skipped++;
    }
  }

  return { added, skipped };
}

export interface ExportMonthData {
  transactions: TransactionWithCategory[];
  monthlyBudgetAmount: number;
  budgets: BudgetWithCategory[];
  variableBudgetItems: VariableBudgetItemWithCategory[];
}

export interface ExportData {
  incomeCategories: Category[];
  expenseCategories: Category[];
  assetItems: AssetItem[];
  budgetLabels: BudgetLabel[];
  byMonth: Record<string, ExportMonthData>;
  assetSnapshotsByMonth: Record<string, AssetSnapshot[]>;
}

/** 엑셀 다운로드 시 선택된 달 전체에 필요한 데이터를 서버 왕복 한 번으로 모아서 가져온다. */
export async function fetchExportData(
  months: { year: number; month: number }[]
): Promise<ExportData> {
  const monthKeys = months.map((m) => getMonthRange(m.year, m.month).from);
  const prevMonthKeys = months.map((m) => {
    const d = new Date(m.year, m.month - 1, 1);
    return getMonthRange(d.getFullYear(), d.getMonth()).from;
  });
  const snapshotMonthKeys = Array.from(new Set([...monthKeys, ...prevMonthKeys]));

  const [incomeCategories, expenseCategories, assetItems] = await Promise.all([
    fetchCategories("income"),
    fetchCategories("expense"),
    fetchAssetItems(),
  ]);
  const fixedCategoryIds = expenseCategories
    .filter((c) => c.report_group === FIXED_EXPENSE_GROUP)
    .map((c) => c.id);

  const [budgetLabels, snapshotsList, monthDataEntries] = await Promise.all([
    fetchBudgetLabels(fixedCategoryIds),
    Promise.all(snapshotMonthKeys.map((key) => fetchAssetSnapshots(key))),
    Promise.all(
      months.map(async (m): Promise<[string, ExportMonthData]> => {
        const range = getMonthRange(m.year, m.month);
        const monthKey = range.from;
        const [transactions, monthlyBudget, budgets, variableBudgetItems] = await Promise.all([
          fetchTransactions(range),
          fetchMonthlyBudget(monthKey),
          fetchBudgets(monthKey),
          fetchVariableBudgetItems(monthKey),
        ]);
        return [
          monthKey,
          { transactions, monthlyBudgetAmount: monthlyBudget?.amount ?? 0, budgets, variableBudgetItems },
        ];
      })
    ),
  ]);

  const assetSnapshotsByMonth: Record<string, AssetSnapshot[]> = {};
  snapshotMonthKeys.forEach((key, i) => {
    assetSnapshotsByMonth[key] = snapshotsList[i];
  });

  const byMonth: Record<string, ExportMonthData> = {};
  for (const [key, data] of monthDataEntries) byMonth[key] = data;

  return { incomeCategories, expenseCategories, assetItems, budgetLabels, byMonth, assetSnapshotsByMonth };
}
