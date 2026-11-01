import TaskItem from "@/app/dashboard/TaskItem";
import type { User } from "@/lib/db";
import type { Task } from "@/lib/queries";

/** The weekly master roadmap: one column per team member with their progress. */
export default function Roadmap({ members, tasks }: { members: User[]; tasks: Task[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {members.map((m) => {
        const mine = tasks.filter((t) => t.assignee_id === m.id);
        const done = mine.filter((t) => t.status === "done").length;
        return (
          <section key={m.id} className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium">
                  {m.name}
                  {m.role === "admin" && <span className="ml-1.5 text-xs font-normal text-slate-500">Admin</span>}
                </h3>
                <span className="text-sm text-slate-500 tabular-nums">
                  {done}/{mine.length}
                </span>
              </div>
              {mine.length > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(done / mine.length) * 100}%` }} />
                </div>
              )}
            </div>
            {mine.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">Nothing on the roadmap this week.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {mine.map((t) => (
                  <TaskItem key={t.id} task={t} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
