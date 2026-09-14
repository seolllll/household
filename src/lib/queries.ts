import { supabase } from "@/lib/supabase/client";
import type { Category, MonthlyBudget, Transaction, TransactionType } from "@/types/database";
import type { DateRange } from "@/lib/date-range";

export type TransactionWithCategory = Transaction & { category: Category | null };

export async function fetchCategories(type: TransactionType): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("type", type)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
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
