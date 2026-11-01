import Badge, { AttendanceBadge } from "@/components/Badge";
import PageHeader, { HrSheetLink } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { attendanceBetween, listMembers } from "@/lib/queries";
import { sheetsConfigured } from "@/lib/sheets";
import { formatShortDate, hhmm, isIsoDate, shiftDate, todayInTz, workStartLabel } from "@/lib/time";
import { retryAllSyncs, retrySync } from "../actions";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; member?: string }>;
}) {
  await requireUser("admin");
  const params = await searchParams;
  const today = todayInTz();
  const to = isIsoDate(params.to) ? params.to : today;
  const from = isIsoDate(params.from) ? params.from : shiftDate(to, -6);
  const memberId = Number(params.member) || undefined;

  const employees = listMembers().filter((m) => m.role === "employee");
  const rows = attendanceBetween(from, to, memberId);
  const failed = rows.filter((r) => !r.sheet_synced).length;
  const late = rows.filter((r) => r.status === "En retard").length;

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`First sign-in of each day. Late after ${workStartLabel()}.`}
        actions={<HrSheetLink />}
      />

      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="from" className="label">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label htmlFor="to" className="label">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className="input" />
        </div>
        <div>
          <label htmlFor="member" className="label">
            Member
          </label>
          <select id="member" name="member" defaultValue={memberId ?? ""} className="input">
            <option value="">Everyone</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          Show
        </button>
        <p className="ml-auto text-sm text-slate-500">
          {rows.length} arrivals · {late} late
        </p>
      </form>

      {sheetsConfigured() && failed > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>
            {failed} {failed === 1 ? "arrival hasn't" : "arrivals haven't"} reached the HR sheet.
          </span>
          <form action={retryAllSyncs}>
            <button type="submit" className="btn btn-secondary py-1.5">
              Retry all
            </button>
          </form>
        </div>
      )}

      <section className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No arrivals in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Member</th>
                  <th className="th">Arrival</th>
                  <th className="th">Status</th>
                  <th className="th">HR sheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td whitespace-nowrap text-slate-600">{formatShortDate(r.work_date)}</td>
                    <td className="td font-medium">{r.name}</td>
                    <td className="td tabular-nums">{hhmm(r.punch_in_time)}</td>
                    <td className="td">
                      <AttendanceBadge status={r.status} />
                    </td>
                    <td className="td">
                      {r.sheet_synced ? (
                        <Badge tone="green">Sent</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span title={r.sheet_error ?? undefined}>
                            <Badge tone={sheetsConfigured() ? "red" : "slate"}>
                              {sheetsConfigured() ? "Failed" : "Not connected"}
                            </Badge>
                          </span>
                          {sheetsConfigured() && (
                            <form action={retrySync}>
                              <input type="hidden" name="id" value={r.id} />
                              <button type="submit" className="btn btn-ghost px-2 py-1 text-xs">
                                Retry
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
