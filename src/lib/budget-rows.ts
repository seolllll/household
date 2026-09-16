import type { BudgetReviewRow } from "@/components/budget-review-table";
import type { BudgetWithCategory, TransactionWithCategory } from "@/lib/queries";
import type { BudgetLabel, Category } from "@/types/database";

export const FIXED_EXPENSE_GROUP = "고정지출";
export const FIXED_EXPENSE_OTHER_LABEL = "기타";

export function buildRows(
  categories: Category[],
  transactions: TransactionWithCategory[],
  budgetList: BudgetWithCategory[]
): BudgetReviewRow[] {
  const budgetByCategory = new Map(
    budgetList.filter((b) => !b.label).map((b) => [b.category_id, b])
  );
  return categories.map((category) => ({
    category,
    actual: transactions
      .filter((t) => t.category?.id === category.id)
      .reduce((sum, t) => sum + t.amount, 0),
    budget: budgetByCategory.get(category.id),
    transactions: transactions
      .filter((t) => t.category?.id === category.id)
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

/** "고정지출" 카테고리를 세부항목(메모) 단위로 쪼갠 행. 실제 금액은 해당 월 거래 중 그 메모와 일치하는 것만 합산. */
export function buildFixedExpenseLabelRows(
  categories: Category[],
  categoryTransactions: TransactionWithCategory[],
  budgetList: BudgetWithCategory[],
  labels: BudgetLabel[]
): BudgetReviewRow[] {
  return categories.flatMap((category) => {
    const txForCategory = categoryTransactions.filter((t) => t.category?.id === category.id);
    const budgetByLabel = new Map(
      budgetList.filter((b) => b.category_id === category.id).map((b) => [b.label, b])
    );
    const categoryLabels = labels.filter((l) => l.category_id === category.id);
    const labelRows: BudgetReviewRow[] = categoryLabels.map((l) => ({
      category,
      label: l.name,
      labelId: l.id,
      actual: txForCategory
        .filter((t) => (t.memo ?? "") === l.name)
        .reduce((sum, t) => sum + t.amount, 0),
      budget: budgetByLabel.get(l.name),
    }));
    const matchedAmount = labelRows.reduce((sum, r) => sum + r.actual, 0);
    const totalAmount = txForCategory.reduce((sum, t) => sum + t.amount, 0);
    const otherAmount = totalAmount - matchedAmount;
    if (otherAmount !== 0) {
      labelRows.push({
        category,
        label: FIXED_EXPENSE_OTHER_LABEL,
        actual: otherAmount,
        budget: budgetByLabel.get(FIXED_EXPENSE_OTHER_LABEL),
      });
    }
    return labelRows;
  });
}
