"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const STATUSES = ["pending", "in_progress", "done"] as const;

export async function setTaskStatus(formData: FormData) {
  const user = await requireUser();
  const requested = formData.get("status");
  const status = STATUSES.find((s) => s === requested) ?? "pending";
  const id = Number(formData.get("id"));

  // Employees may only change their own tasks; admins may update anyone's.
  getDb()
    .prepare(
      `UPDATE tasks
       SET status = ?, completed_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END
       WHERE id = ? AND (assignee_id = ? OR ? = 'admin')`,
    )
    .run(status, status, id, user.id, user.role);

  revalidatePath("/dashboard");
  revalidatePath("/admin", "layout");
}
