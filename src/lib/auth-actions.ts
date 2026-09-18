"use server";

import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSession, deleteSession } from "@/lib/session";

export async function login(username: string, password: string): Promise<{ error?: string }> {
  const { data: user, error } = await supabaseAdmin
    .from("app_users")
    .select("id, password_hash, household_id")
    .eq("username", username)
    .maybeSingle();

  if (error || !user) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  await createSession({ userId: user.id, householdId: user.household_id });
  return {};
}

export async function logout(): Promise<void> {
  await deleteSession();
}
