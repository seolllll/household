/**
 * 변동지출 세부분류(variable_budget_items.memo)는 거래(transactions)의 memo와 정확히 일치해야 매칭되는 게
 * 앱 전체(월말정산/예산계획 실사용액 집계, 일일정산 엑셀 다운로드)의 기존 규칙이다. 엑셀 업로드 시 세부분류와
 * 별도로 "내용"까지 함께 남기기 위해 memo를 "세부분류 · 내용" 형태로 저장하고, 매칭 쪽은 정확히 일치하거나
 * 이 구분자로 시작하면 매칭되도록 확장해서 기존 규칙과 호환을 유지한다.
 */
export const SUB_CATEGORY_MEMO_DELIMITER = " · ";

export function joinSubCategoryMemo(subCategory: string, content: string | null): string {
  const trimmedContent = content?.trim();
  return trimmedContent ? `${subCategory}${SUB_CATEGORY_MEMO_DELIMITER}${trimmedContent}` : subCategory;
}

/** memo가 subCategory에 매칭되는지(정확히 일치하거나 "subCategory · ..." 형태인지). */
export function matchesSubCategory(memo: string | null, subCategory: string | null): boolean {
  const m = memo ?? "";
  const s = subCategory ?? "";
  if (!s) return m === s;
  return m === s || m.startsWith(`${s}${SUB_CATEGORY_MEMO_DELIMITER}`);
}

/** memo를 세부분류/내용으로 분리(다운로드 표시용). subCategory에 매칭 안 되면 subCategory는 null. */
export function splitSubCategoryMemo(
  memo: string | null,
  subCategory: string
): { subCategory: string | null; content: string } {
  if (!memo) return { subCategory: null, content: "" };
  if (memo === subCategory) return { subCategory, content: "" };
  const prefix = `${subCategory}${SUB_CATEGORY_MEMO_DELIMITER}`;
  if (memo.startsWith(prefix)) return { subCategory, content: memo.slice(prefix.length) };
  return { subCategory: null, content: memo };
}
