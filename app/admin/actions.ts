"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/FormMessage";
import { syncAttendance } from "@/lib/attendance";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { unsyncedAttendanceIds } from "@/lib/queries";
import { isIsoDate, weekStart } from "@/lib/time";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard");
}

// ---- Tasks ----

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const date = formData.get("dueDate");
  const scope = formData.get("scope") === "week" ? "week" : "day";
  const assigneeIds = formData.getAll("assigneeIds").map(Number);

  if (!title) return { error: "Give the task a title." };
  if (!isIsoDate(date)) return { error: "Pick a valid date." };
  if (assigneeIds.length === 0) return { error: "Choose at least one team member." };

  const db = getDb();
  const isActive = db.prepare("SELECT 1 FROM users WHERE id = ? AND active = 1");
  if (!assigneeIds.every((id) => isActive.get(id))) return { error: "Choose active team members." };

  // Weekly roadmap items are filed under the Monday of their week.
  const dueDate = scope === "week" ? weekStart(date) : date;
  const insert = db.prepare(
    "INSERT INTO tasks (title, description, assignee_id, due_date, scope, created_by) VALUES (?, ?, ?, ?, ?, ?)",
  );
  db.transaction(() => {
    for (const id of assigneeIds) insert.run(title, description || null, id, dueDate, scope, admin.id);
  })();

  refresh();
  return {
    message: assigneeIds.length === 1 ? "Task assigned." : `Task assigned to ${assigneeIds.length} people.`,
  };
}

export async function deleteTask(formData: FormData) {
  await requireUser("admin");
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(Number(formData.get("id")));
  refresh();
}

// ---- Team ----

export async function createMember(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "employee";

  if (!name) return { error: "Enter a name." };
  if (!/^[a-z0-9._-]{2,32}$/.test(username)) {
    return { error: "Usernames use 2–32 letters, numbers, dots, dashes or underscores." };
  }
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };

  const db = getDb();
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    return { error: `The username "${username}" is already taken.` };
  }
  db.prepare("INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)").run(
    username,
    name,
    await bcrypt.hash(password, 10),
    role,
  );

  refresh();
  return { message: `${name} can now sign in as "${username}".` };
}

export async function setMemberActive(formData: FormData) {
  const admin = await requireUser("admin");
  const id = Number(formData.get("id"));
  if (id === admin.id) return; // never lock yourself out
  getDb()
    .prepare("UPDATE users SET active = ? WHERE id = ?")
    .run(formData.get("active") === "1" ? 1 : 0, id);
  refresh();
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "At least 8 characters." };
  getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(await bcrypt.hash(password, 10), Number(formData.get("id")));
  return { message: "Password updated." };
}

// ---- Attendance ----

export async function retrySync(formData: FormData) {
  await requireUser("admin");
  await syncAttendance(Number(formData.get("id")));
  refresh();
}

export async function retryAllSyncs() {
  await requireUser("admin");
  for (const id of unsyncedAttendanceIds()) await syncAttendance(id);
  refresh();
}
