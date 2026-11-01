import Link from "next/link";
import { TaskBadge } from "@/components/Badge";
import PageHeader from "@/components/PageHeader";
import TaskStatusSelect from "@/app/dashboard/TaskStatusSelect";
import { requireUser } from "@/lib/auth";
import type { User } from "@/lib/db";
import { listAssignable, tasksForDate, weeklyTasks, type Task } from "@/lib/queries";
import { formatDate, formatWeek, isIsoDate, shiftDate, todayInTz, weekStart } from "@/lib/time";
import { deleteTask } from "../actions";
import TaskForm from "./TaskForm";

export default async function AdminTasks({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser("admin");
  const { date: requested } = await searchParams;
  const today = todayInTz();
  const date = isIsoDate(requested) ? requested : today;
  const week = weekStart(date);
  const members = listAssignable();

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={formatDate(date)}
        actions={
          <>
            <Link href={`/admin/tasks?date=${shiftDate(date, -1)}`} className="btn btn-secondary" aria-label="Previous day">
              ←
            </Link>
            <form className="flex gap-2">
              <input type="date" name="date" defaultValue={date} key={date} className="input w-auto" aria-label="Day" />
              <button type="submit" className="btn btn-secondary">
                Go
              </button>
            </form>
            <Link href={`/admin/tasks?date=${shiftDate(date, 1)}`} className="btn btn-secondary" aria-label="Next day">
              →
            </Link>
            {date !== today && (
              <Link href="/admin/tasks" className="btn btn-ghost">
                Today
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <TaskGroups
            heading="Weekly roadmap"
            subheading={formatWeek(week)}
            members={members}
            tasks={weeklyTasks(week)}
            empty="Nothing on the roadmap this week."
          />
          <TaskGroups
            heading="Daily tasks"
            subheading={formatDate(date)}
            members={members}
            tasks={tasksForDate(date)}
            empty="No tasks for this day."
          />
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <TaskForm members={members} date={date} />
        </div>
      </div>
    </>
  );
}

function TaskGroups({
  heading,
  subheading,
  members,
  tasks,
  empty,
}: {
  heading: string;
  subheading: string;
  members: User[];
  tasks: Task[];
  empty: string;
}) {
  // Keep members with no tasks visible, and show tasks of deactivated members separately.
  const groups = members.map((m) => ({
    key: String(m.id),
    member: m.name,
    tasks: tasks.filter((t) => t.assignee_id === m.id),
  }));
  const inactive = tasks.filter((t) => !members.some((m) => m.id === t.assignee_id));
  if (inactive.length) groups.push({ key: "inactive", member: "Inactive members", tasks: inactive });

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="text-sm text-slate-500">{subheading}</p>
      </div>
      <div className="space-y-4">
        {groups.map((g) => {
          const done = g.tasks.filter((t) => t.status === "done").length;
          return (
            <div key={g.key} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="font-medium">{g.member}</h3>
                <span className="text-sm text-slate-500 tabular-nums">
                  {done}/{g.tasks.length} done
                </span>
              </div>
              {g.tasks.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-400">{empty}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {g.tasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className={t.status === "done" ? "text-slate-400 line-through" : ""}>{t.title}</p>
                        {t.description && (
                          <p className="mt-0.5 text-sm whitespace-pre-line text-slate-500">{t.description}</p>
                        )}
                      </div>
                      {t.scope === "week" ? (
                        <TaskStatusSelect id={t.id} status={t.status} title={t.title} />
                      ) : (
                        <TaskBadge status={t.status} />
                      )}
                      <form action={deleteTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="btn btn-danger -my-1 px-2 py-1 text-xs">
                          Delete
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
