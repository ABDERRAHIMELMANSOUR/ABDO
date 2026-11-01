"use client";

import type { TaskStatus } from "@/lib/db";
import { setTaskStatus } from "./actions";

const tones: Record<TaskStatus, string> = {
  pending: "border-slate-300 bg-white text-slate-700",
  in_progress: "border-indigo-300 bg-indigo-50 text-indigo-700",
  done: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

export default function TaskStatusSelect({ id, status, title }: { id: number; status: TaskStatus; title: string }) {
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        aria-label={`Status of "${title}"`}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium ${tones[status]}`}
      >
        <option value="pending">To do</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
      </select>
    </form>
  );
}
