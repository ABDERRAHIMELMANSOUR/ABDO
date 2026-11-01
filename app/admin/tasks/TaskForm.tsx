"use client";

import { useActionState } from "react";
import FormMessage from "@/components/FormMessage";
import type { User } from "@/lib/db";
import { createTask } from "../actions";

export default function TaskForm({ members, date }: { members: User[]; date: string }) {
  const [state, formAction, pending] = useActionState(createTask, null);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h2 className="font-medium">New task</h2>
      <fieldset>
        <legend className="label">Type</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "day", label: "Daily task" },
            { value: "week", label: "Weekly roadmap" },
          ].map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700"
            >
              <input type="radio" name="scope" value={o.value} defaultChecked={o.value === "day"} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="title" className="label">
          Title
        </label>
        <input id="title" name="title" required maxLength={200} className="input" placeholder="Call back leads from Google Ads" />
      </div>
      <div>
        <label htmlFor="description" className="label">
          Details <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea id="description" name="description" rows={3} maxLength={2000} className="input" />
      </div>
      <div>
        <label htmlFor="dueDate" className="label">
          Day <span className="font-normal text-slate-400">(weekly items go to that day's week)</span>
        </label>
        <input id="dueDate" name="dueDate" type="date" required defaultValue={date} key={date} className="input" />
      </div>
      <fieldset>
        <legend className="label">Assign to</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700"
            >
              <input type="checkbox" name="assigneeIds" value={m.id} className="accent-indigo-600" />
              {m.name}
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Assigning…" : "Assign task"}
      </button>
    </form>
  );
}
