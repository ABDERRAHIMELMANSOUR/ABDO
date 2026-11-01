import AppHeader from "@/components/AppHeader";
import { AttendanceBadge } from "@/components/Badge";
import { recordPunchIn } from "@/lib/attendance";
import { requireUser } from "@/lib/auth";
import { attendanceFor, overdueTasksForUser, tasksForUser, weeklyTasksForUser } from "@/lib/queries";
import { formatDate, formatWeek, hhmm, todayInTz, weekStart, workStartLabel } from "@/lib/time";
import TaskItem from "./TaskItem";

export default async function EmployeeDashboard() {
  const user = await requireUser("employee");
  // Covers employees who stay signed in overnight and open the dashboard next morning.
  await recordPunchIn(user);

  const today = todayInTz();
  const arrival = attendanceFor(user.id, today);
  const tasks = tasksForUser(user.id, today);
  const overdue = overdueTasksForUser(user.id, today);
  const week = weekStart(today);
  const roadmap = weeklyTasksForUser(user.id, week);
  const roadmapDone = roadmap.filter((t) => t.status === "done").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <p className="text-sm text-slate-500">{formatDate(today)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hello, {user.name}</h1>
        </div>

        <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-slate-500">Arrival recorded</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">
              {arrival ? hhmm(arrival.punch_in_time) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Work starts at {workStartLabel()}</p>
          </div>
          <AttendanceBadge status={arrival?.status} />
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">Today's tasks</h2>
              <span className="text-sm text-slate-500 tabular-nums">
                {done} of {tasks.length} done
              </span>
            </div>
            {tasks.length > 0 && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          {tasks.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No tasks assigned for today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </ul>
          )}
        </section>

        {roadmap.length > 0 && (
          <section className="card overflow-hidden">
            <div className="flex items-baseline justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-medium">This week's roadmap</h2>
                <p className="text-xs text-slate-500">{formatWeek(week)}</p>
              </div>
              <span className="text-sm text-slate-500 tabular-nums">
                {roadmapDone} of {roadmap.length} done
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {roadmap.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </ul>
          </section>
        )}

        {overdue.length > 0 && (
          <section className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-medium">Still pending from earlier days</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {overdue.map((t) => (
                <TaskItem key={t.id} task={t} showDate />
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
