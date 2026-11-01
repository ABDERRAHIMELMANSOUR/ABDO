import { TaskBadge } from "@/components/Badge";
import type { Task } from "@/lib/queries";
import { formatShortDate } from "@/lib/time";
import { setTaskStatus } from "./actions";
import TaskStatusSelect from "./TaskStatusSelect";

/** Daily tasks get a checkbox; weekly roadmap items get a To do / In progress / Done picker. */
export default function TaskItem({ task, showDate = false }: { task: Task; showDate?: boolean }) {
  const done = task.status === "done";
  const weekly = task.scope === "week";

  return (
    <li className="flex items-start gap-3 px-5 py-4">
      {!weekly && (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="status" value={done ? "pending" : "done"} />
          <button
            type="submit"
            aria-label={done ? `Mark "${task.title}" as pending` : `Mark "${task.title}" as done`}
            className={`mt-0.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border transition ${
              done ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white hover:border-indigo-500"
            }`}
          >
            {done && (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3" aria-hidden>
                <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </form>
      )}
      <div className="min-w-0 flex-1">
        <p className={done ? "text-slate-400 line-through" : "font-medium"}>{task.title}</p>
        {task.description && (
          <p className="mt-0.5 text-sm whitespace-pre-line text-slate-500">{task.description}</p>
        )}
        {showDate && <p className="mt-1 text-xs text-amber-700">From {formatShortDate(task.due_date)}</p>}
      </div>
      {weekly ? (
        <TaskStatusSelect id={task.id} status={task.status} title={task.title} />
      ) : (
        <TaskBadge status={task.status} />
      )}
    </li>
  );
}
