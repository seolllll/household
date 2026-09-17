import { supabase } from "@/lib/supabase/client";
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
import type { DateRange } from "@/lib/date-range";

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
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("type", type)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(name: string, type: TransactionType): Promise<string> {
  const { data: inactive, error: findError } = await supabase
    .from("categories")
    .select("id")
    .eq("type", type)
    .eq("name", name)
    .eq("is_active", false)
    .maybeSingle();
  if (findError) throw findError;

  if (inactive) {
    const { error } = await supabase
      .from("categories")
      .update({ is_active: true })
      .eq("id", inactive.id);
    if (error) throw error;
    return inactive.id;
  }

  const categories = await fetchCategories(type);
  const nextSortOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;
  const { data, error } = await supabase
    .from("categories")
    .insert({ name, type, sort_order: nextSortOrder, color: pickCategoryColor(categories) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCategory(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function fetchRecentCategoryIds(
  type: TransactionType,
  limit = 6
): Promise<string[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("category_id")
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
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TransactionWithCategory[];
}

export async function fetchAllTransactions(): Promise<TransactionWithCategory[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
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
  const { error } = await supabase.from("transactions").insert(input);
  if (error) throw error;
}

export async function updateTransaction(id: string, input: NewTransactionInput): Promise<void> {
  const { error } = await supabase.from("transactions").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMonthlyBudget(month: string): Promise<MonthlyBudget | null> {
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select("*")
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertMonthlyBudget(month: string, amount: number): Promise<void> {
  const { error } = await supabase
    .from("monthly_budgets")
    .upsert({ month, amount }, { onConflict: "month" });
  if (error) throw error;
}

export async function fetchWeeklyBudgetItems(range: DateRange): Promise<WeeklyBudgetItemWithCategory[]> {
  const { data, error } = await supabase
    .from("weekly_budget_items")
    .select("*, category:categories(*)")
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
  const { error } = await supabase.from("weekly_budget_items").insert(input);
  if (error) throw error;
}

export async function updateWeeklyBudgetItem(id: string, input: WeeklyBudgetItemInput): Promise<void> {
  const { error } = await supabase.from("weekly_budget_items").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteWeeklyBudgetItem(id: string): Promise<void> {
  const { error } = await supabase.from("weekly_budget_items").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBudgetLabels(categoryIds: string[]): Promise<BudgetLabel[]> {
  if (categoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from("budget_labels")
    .select("*")
    .in("category_id", categoryIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBudgetLabel(categoryId: string, name: string): Promise<void> {
  const { data: last, error: findError } = await supabase
    .from("budget_labels")
    .select("sort_order")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  const { error } = await supabase
    .from("budget_labels")
    .insert({ category_id: categoryId, name, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) throw error;
}

export async function renameBudgetLabel(
  id: string,
  categoryId: string,
  oldName: string,
  newName: string
): Promise<void> {
  const { error } = await supabase.from("budget_labels").update({ name: newName }).eq("id", id);
  if (error) throw error;
  // 이 세부항목으로 이미 저장된 과거 예산 기록도 새 이름을 따라가도록 함께 갱신.
  const { error: budgetsError } = await supabase
    .from("budgets")
    .update({ label: newName })
    .eq("category_id", categoryId)
    .eq("label", oldName);
  if (budgetsError) throw budgetsError;
}

export async function deleteBudgetLabel(id: string): Promise<void> {
  const { error } = await supabase.from("budget_labels").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBudgets(month: string): Promise<BudgetWithCategory[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("*, category:categories(*)")
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
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { category_id: categoryId, month, label, amount, reason, feedback },
      { onConflict: "category_id,month,label" }
    );
  if (error) throw error;
}

export type VariableBudgetItemWithCategory = VariableBudgetItem & { category: Category | null };

export async function fetchVariableBudgetItems(month: string): Promise<VariableBudgetItemWithCategory[]> {
  const { data, error } = await supabase
    .from("variable_budget_items")
    .select("*, category:categories(*)")
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
async function syncVariableCategoryBudget(categoryId: string, month: string): Promise<void> {
  const { data: items, error: itemsError } = await supabase
    .from("variable_budget_items")
    .select("amount")
    .eq("category_id", categoryId)
    .eq("month", month);
  if (itemsError) throw itemsError;
  const total = (items ?? []).reduce((sum, it) => sum + it.amount, 0);

  const { data: existing, error: findError } = await supabase
    .from("budgets")
    .select("reason, feedback")
    .eq("category_id", categoryId)
    .eq("month", month)
    .eq("label", "")
    .maybeSingle();
  if (findError) throw findError;

  await upsertBudget(categoryId, month, "", total, existing?.reason ?? null, existing?.feedback ?? null);
}

export async function createVariableBudgetItem(input: VariableBudgetItemInput): Promise<void> {
  const { error } = await supabase.from("variable_budget_items").insert(input);
  if (error) throw error;
  await syncVariableCategoryBudget(input.category_id, input.month);
}

export async function updateVariableBudgetItem(
  id: string,
  input: VariableBudgetItemInput,
  previousCategoryId?: string
): Promise<void> {
  const { error } = await supabase.from("variable_budget_items").update(input).eq("id", id);
  if (error) throw error;
  await syncVariableCategoryBudget(input.category_id, input.month);
  if (previousCategoryId && previousCategoryId !== input.category_id) {
    await syncVariableCategoryBudget(previousCategoryId, input.month);
  }
}

export async function deleteVariableBudgetItem(id: string, categoryId: string, month: string): Promise<void> {
  const { error } = await supabase.from("variable_budget_items").delete().eq("id", id);
  if (error) throw error;
  await syncVariableCategoryBudget(categoryId, month);
}

export async function updateVariableBudgetItemReview(
  id: string,
  reason: string | null,
  feedback: string | null
): Promise<void> {
  const { error } = await supabase.from("variable_budget_items").update({ reason, feedback }).eq("id", id);
  if (error) throw error;
}

export async function fetchAssetItems(): Promise<AssetItem[]> {
  const { data, error } = await supabase
    .from("asset_items")
    .select("*")
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
    const key = `${item.group_name} ${item.subgroup}`;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }

  const ordered = groupOrder.flatMap((group) =>
    (subgroupOrderByGroup.get(group) ?? []).flatMap(
      (subgroup) => buckets.get(`${group} ${subgroup}`) ?? []
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
  const { data: last, error: findError } = await supabase
    .from("asset_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  const { error } = await supabase
    .from("asset_items")
    .insert({ group_name: groupName, subgroup, label, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) throw error;
  await resequenceAssetItems();
}

export async function updateAssetItem(
  id: string,
  groupName: string,
  subgroup: string,
  label: string
): Promise<void> {
  const { error } = await supabase
    .from("asset_items")
    .update({ group_name: groupName, subgroup, label })
    .eq("id", id);
  if (error) throw error;
  await resequenceAssetItems();
}

export async function deleteAssetItem(id: string): Promise<void> {
  const { error } = await supabase.from("asset_items").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function fetchAssetSnapshots(month: string): Promise<AssetSnapshot[]> {
  const { data, error } = await supabase.from("asset_snapshots").select("*").eq("month", month);
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
  const { error } = await supabase
    .from("asset_snapshots")
    .upsert(
      { asset_item_id: assetItemId, month, amount, reason, feedback },
      { onConflict: "asset_item_id,month" }
    );
  if (error) throw error;
}
