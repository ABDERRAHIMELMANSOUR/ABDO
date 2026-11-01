"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { recordPunchIn } from "@/lib/attendance";
import { endSession, homeFor, startSession } from "@/lib/auth";
import { getDb, type User } from "@/lib/db";

export type LoginState = { error: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const user = getDb()
    .prepare("SELECT id, username, name, role, active, password_hash FROM users WHERE username = ?")
    .get(username) as (User & { password_hash: string }) | undefined;

  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: "Incorrect username or password." };
  }

  await startSession(user);
  await recordPunchIn(user);
  redirect(homeFor(user));
}

export async function logout() {
  await endSession();
  redirect("/login");
}
