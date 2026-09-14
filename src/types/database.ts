export type TransactionType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
};

export type Transaction = {
  id: string;
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
  category_id: string;
  month: string;
  amount: number;
  created_at: string;
  updated_at: string;
};

export type MonthlyBudget = {
  id: string;
  month: string;
  amount: number;
  created_at: string;
  updated_at: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
