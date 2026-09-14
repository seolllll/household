# TASK

## 2026-09-14

### 환경/DB
- `.env.local`이 없어진 원인 확인: 이 작업 디렉토리가 GitHub에서 새로 클론된 상태라, `.gitignore`로 추적 제외되는 `.env.local`이 애초에 딸려오지 않았던 것. `.env.local.example`을 템플릿으로 재작성.
- Supabase 연결 오류 수정: `NEXT_PUBLIC_SUPABASE_URL`에 `/rest/v1/`가 잘못 붙어 있던 것 제거 (base URL만 넣어야 함).
- "카테고리가 없습니다" 오류의 원인이 RLS(Row Level Security)였음을 확인: SQL Editor(관리자 권한)로는 데이터가 보이지만 앱은 `anon` 키로 접근하기 때문에, `anon` 롤에 대한 SELECT 정책이 없으면 에러 없이 빈 배열만 반환됨. 해결책(RLS 비활성화 또는 anon 허용 정책 추가)을 안내함.

### 정산 화면 (일일/주간/월말)
- 월말정산에 있던 이전/다음 이동 UI 패턴을 앱 전체에 통일:
  - 주간정산 상세보기(`/weekly/[week]`)에 이전주/다음주 화살표 추가 (월 경계를 넘어가도록 처리).
  - 주간정산 목록(`/weekly`)도 지금 달에 고정되어 있던 것을 이전/다음 달 이동 가능하도록 수정.
  - 일일정산(`/`)을 "전체 내역 리스트"에서 "월 단위 + 날짜별 그룹 리스트" 구조로 변경, 상단에 월 이동 버튼 추가.
- 주간정산 상세보기의 "수입" 카드를 "남은 생활비"로 교체 (해당 월 1일부터 그 주 마지막 날까지의 누적 지출 기준 예산 잔액).
- 바텀 내비게이션 "일일정산" 아이콘을 `HomeIcon` → `NotebookPenIcon`으로 변경.

### 통계 탭
- 신규 섹션 추가: 기간별 지출 추이(주별/월별 토글 + 라인 차트), 수입 대비 지출 비율(도넛 게이지), 전월/전주 대비 증감률.
  - 차트는 기존에 쓰던 `recharts`만 재사용, 데이터 조회도 기존 `fetchTransactions`/`fetchMonthlyBudget`만 재사용 (신규 fetching 로직 없음, 전체 기간 한 번만 조회 후 클라이언트에서 집계).
  - 로딩 스켈레톤용 `Skeleton` 컴포넌트 신규 추가.
- 이후 요청에 따라 "카테고리별 예산" 섹션과 "예산 대비 실제 지출 진행률" 섹션은 삭제 (관련 미사용 코드도 함께 정리).

### 거래 추가/수정/삭제
- `queries.ts`에 `updateTransaction`, `deleteTransaction` 추가.
- `QuickAddModal`을 확장해서 `transaction` prop을 넘기면 "수정" 모드로 동작 (값 프리필 + `updateTransaction` 호출). 항목별로 `key`를 다르게 줘서 모달을 리마운트시키는 방식으로 상태 초기화 처리.
- 일일정산 리스트: 항목을 탭하면 수정/삭제 버튼이 펼쳐지도록 함. 삭제는 확인 단계 없이 즉시 삭제.

### 날짜 선택 UI
- 네이티브 `<input type="date">`가 Windows+Chrome 한국어 로케일에서 요일 표시가 빈 괄호 `( )`로 깨지는 문제 발견.
- TOAST UI Date Picker(`tui-date-picker`)로 교체: `src/components/ui/date-picker-input.tsx` 신규 작성.
  - SSR 시 `window is not defined` 크래시 → `next/dynamic({ ssr: false })`로 해결.
  - 캘린더 아이콘(SVG) 클릭 시 `elem.className.split is not a function` 크래시 → 아이콘에 `pointer-events-none` 추가로 해결 (SVG의 `className`은 문자열이 아닌 `SVGAnimatedString`이라 라이브러리 내부 클래스 처리 로직이 깨졌던 것).
  - 팝업 캘린더가 input 아래가 아니라 위로 뜨도록 `globals.css`에 위치 오버라이드 CSS 추가.

## 다음 작업 (예정)
- [ ] 카테고리 추가/수정/삭제 설정 기능
- [ ] 엑셀 다운로드 기능
- [ ] (추가 예정 항목 있음)
