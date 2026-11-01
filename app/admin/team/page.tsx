import Badge from "@/components/Badge";
import PageHeader from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { listMembers } from "@/lib/queries";
import { setMemberActive } from "../actions";
import { MemberForm, ResetPasswordForm } from "./MemberForms";

export default async function TeamPage() {
  const admin = await requireUser("admin");
  const members = listMembers();

  return (
    <>
      <PageHeader title="Team" subtitle="Who can sign in, and with which role." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Password</th>
                  <th className="th">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={m.id} className={m.active ? "" : "bg-slate-50/60"}>
                    <td className="td">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-slate-500">{m.username}</p>
                    </td>
                    <td className="td">
                      {m.role === "admin" ? <Badge tone="indigo">Admin</Badge> : <Badge tone="slate">Employee</Badge>}
                    </td>
                    <td className="td">
                      {m.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}
                    </td>
                    <td className="td">
                      <ResetPasswordForm userId={m.id} />
                    </td>
                    <td className="td text-right">
                      {m.id !== admin.id && (
                        <form action={setMemberActive}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="active" value={m.active ? "0" : "1"} />
                          <button type="submit" className={`btn py-1.5 ${m.active ? "btn-danger" : "btn-secondary"}`}>
                            {m.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <MemberForm />
        </div>
      </div>
    </>
  );
}
