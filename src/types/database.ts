export type TransactionType = "income" | "expense";

export type Category = {
  id: string;
  household_id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  /** 변동지출 표에서 여러 카테고리를 하나의 소계로 묶을 때 쓰는 그룹명. 비어 있으면 카테고리 이름 자체가 그룹명. */
  report_group: string | null;
  created_at: string;
};

export type Transaction = {
  id: string;
  household_id: string;
  category_id: string;
  type: TransactionType;
  amount: number;
  date: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type Budget = {
  id: string;
  household_id: string;
  category_id: string;
  month: string;
  /** 카테고리 전체 예산이면 ''. "고정지출"처럼 카테고리 안에서 세부항목별로 예산을 나눌 때만 항목명(예: "계비"). */
  label: string;
  amount: number;
  reason: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyBudget = {
  id: string;
  household_id: string;
  month: string;
  amount: number;
  created_at: string;
  updated_at: string;
};

export type WeeklyBudgetItem = {
  id: string;
  household_id: string;
  week_start: string;
  category_id: string;
  amount: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

/** "고정지출"처럼 카테고리 하나 안에서 예산/실제를 세부항목별로 쪼개 보여줄 때 쓰는 항목 목록. */
export type BudgetLabel = {
  id: string;
  household_id: string;
  category_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

/** 변동지출 계획을 카테고리 안에서 항목 단위(예: "커피")로 쪼개 입력하는 목록. 카테고리별 합계가 budgets.amount에 자동 반영됨. */
export type VariableBudgetItem = {
  id: string;
  household_id: string;
  month: string;
  category_id: string;
  amount: number;
  memo: string | null;
  /** 항목 리스트에서 항목명 옆에 작게 표시되는 참고용 상세 설명. 실거래 매칭에는 쓰이지 않음. */
  detail_memo: string | null;
  reason: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetItem = {
  id: string;
  household_id: string;
  group_name: string;
  subgroup: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export type AssetSnapshot = {
  id: string;
  household_id: string;
  asset_item_id: string;
  month: string;
  amount: number;
  reason: string | null;
  feedback: string | null;
};

export type Household = {
  id: string;
  name: string;
  created_at: string;
};

export type AppUser = {
  id: string;
  username: string;
  password_hash: string;
  household_id: string;
  created_at: string;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      categories: {
        Row: Category;
        Insert: Partial<Category> & Pick<Category, "name" | "type">;
        Update: Partial<Category>;
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction> &
          Pick<Transaction, "category_id" | "type" | "amount" | "date">;
        Update: Partial<Transaction>;
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: Budget;
        Insert: Partial<Budget> & Pick<Budget, "category_id" | "month" | "amount">;
        Update: Partial<Budget>;
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_budgets: {
        Row: MonthlyBudget;
        Insert: Partial<MonthlyBudget> & Pick<MonthlyBudget, "month" | "amount">;
        Update: Partial<MonthlyBudget>;
        Relationships: [];
      };
      weekly_budget_items: {
        Row: WeeklyBudgetItem;
        Insert: Partial<WeeklyBudgetItem> & Pick<WeeklyBudgetItem, "week_start" | "category_id" | "amount">;
        Update: Partial<WeeklyBudgetItem>;
        Relationships: [
          {
            foreignKeyName: "weekly_budget_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_labels: {
        Row: BudgetLabel;
        Insert: Partial<BudgetLabel> & Pick<BudgetLabel, "category_id" | "name">;
        Update: Partial<BudgetLabel>;
        Relationships: [
          {
            foreignKeyName: "budget_labels_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      variable_budget_items: {
        Row: VariableBudgetItem;
        Insert: Partial<VariableBudgetItem> & Pick<VariableBudgetItem, "month" | "category_id" | "amount">;
        Update: Partial<VariableBudgetItem>;
        Relationships: [
          {
            foreignKeyName: "variable_budget_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_items: {
        Row: AssetItem;
        Insert: Partial<AssetItem> & Pick<AssetItem, "group_name" | "subgroup" | "label">;
        Update: Partial<AssetItem>;
        Relationships: [];
      };
      asset_snapshots: {
        Row: AssetSnapshot;
        Insert: Partial<AssetSnapshot> & Pick<AssetSnapshot, "asset_item_id" | "month" | "amount">;
        Update: Partial<AssetSnapshot>;
        Relationships: [
          {
            foreignKeyName: "asset_snapshots_asset_item_id_fkey";
            columns: ["asset_item_id"];
            isOneToOne: false;
            referencedRelation: "asset_items";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: Household;
        Insert: Partial<Household> & Pick<Household, "name">;
        Update: Partial<Household>;
        Relationships: [];
      };
      app_users: {
        Row: AppUser;
        Insert: Partial<AppUser> & Pick<AppUser, "username" | "password_hash" | "household_id">;
        Update: Partial<AppUser>;
        Relationships: [
          {
            foreignKeyName: "app_users_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
