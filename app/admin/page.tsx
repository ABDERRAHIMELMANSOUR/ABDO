import Link from "next/link";
import { AttendanceBadge } from "@/components/Badge";
import PageHeader, { HrSheetLink } from "@/components/PageHeader";
import Roadmap from "@/components/Roadmap";
import { recordPunchIn } from "@/lib/attendance";
import { requireUser } from "@/lib/auth";
import { attendanceForDate, listAssignable, tasksForDate, weeklyTasks } from "@/lib/queries";
import { sheetsConfigured } from "@/lib/sheets";
import { formatDate, formatWeek, hhmm, todayInTz, weekStart, workStartLabel } from "@/lib/time";

export default async function AdminOverview() {
  const user = await requireUser("admin");
  // Covers an admin who stays signed in overnight and opens the overview next morning.
  await recordPunchIn(user);
  const today = todayInTz();
  const week = weekStart(today);
  const members = listAssignable();
  const roadmap = weeklyTasks(week);
  const attendance = new Map(attendanceForDate(today).map((a) => [a.user_id, a]));
  const tasks = tasksForDate(today);

  const onTime = [...attendance.values()].filter((a) => a.status === "Present").length;
  const late = [...attendance.values()].filter((a) => a.status === "En retard").length;
  const notIn = members.filter((e) => !attendance.has(e.id)).length;
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={`${formatDate(today)} · Work starts at ${workStartLabel()}`}
        actions={<HrSheetLink />}
      />

      {!sheetsConfigured() && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Google Sheets isn't connected yet, so arrivals are only saved here. Set{" "}
          <code className="font-mono">GOOGLE_SHEETS_WEBHOOK_URL</code> in your environment variables (Vercel: Settings → Environment
          Variables), then redeploy. See the README.
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="On time" value={onTime} tone="text-emerald-700" />
        <Stat label="En retard" value={late} tone="text-amber-700" />
        <Stat label="Not checked in" value={notIn} tone="text-slate-700" />
        <Stat label="Tasks done" value={`${done} / ${tasks.length}`} tone="text-indigo-700" />
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium">Team</h2>
          <Link href="/admin/tasks" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Assign tasks →
          </Link>
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No team members yet.{" "}
            <Link href="/admin/team" className="font-medium text-indigo-600">
              Add someone
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Member</th>
                  <th className="th">Arrival</th>
                  <th className="th">Status</th>
                  <th className="th">Today's tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((e) => {
                  const a = attendance.get(e.id);
                  const mine = tasks.filter((t) => t.assignee_id === e.id);
                  const mineDone = mine.filter((t) => t.status === "done").length;
                  return (
                    <tr key={e.id}>
                      <td className="td font-medium">{e.name}</td>
                      <td className="td tabular-nums text-slate-600">{a ? hhmm(a.punch_in_time) : "—"}</td>
                      <td className="td">
                        <AttendanceBadge status={a?.status} />
                      </td>
                      <td className="td">
                        {mine.length === 0 ? (
                          <span className="text-slate-400">None</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${(mineDone / mine.length) * 100}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-slate-600">
                              {mineDone}/{mine.length}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">This week's roadmap</h2>
            <p className="text-sm text-slate-500">{formatWeek(week)}</p>
          </div>
          <Link href="/admin/tasks" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Edit roadmap →
          </Link>
        </div>
        <Roadmap members={members} tasks={roadmap} />
      </section>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
