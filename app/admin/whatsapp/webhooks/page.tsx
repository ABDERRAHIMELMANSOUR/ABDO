import Badge, { type Tone } from "@/components/Badge";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { metaConfigured } from "@/lib/whatsapp/graph";
import { lastVerification, listNumbers, numberActivity, recentEvents, type WaNumber } from "@/lib/whatsapp/store";
import { BRAND_NAMES } from "@/lib/whatsapp/templates";
import { checkNumber, deleteNumber } from "../actions";
import NumberForm from "./NumberForm";

const EVENT_TONES: Record<string, Tone> = {
  verification: "green",
  message: "indigo",
  status: "slate",
  error: "red",
  rejected: "red",
  other: "slate",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function WebhooksPage() {
  await requireUser("admin");
  const numbers = listNumbers();
  const activity = numberActivity();
  const verifiedAt = lastVerification();
  const events = recentEvents(50);
  const labelFor = new Map(numbers.filter((n) => n.phone_number_id).map((n) => [n.phone_number_id!, n.label]));
  const callbackUrl = `${(process.env.APP_URL || "https://YOUR-DOMAIN").replace(/\/$/, "")}/api/whatsapp/webhook`;

  const config = [
    { label: "Access token (WHATSAPP_ACCESS_TOKEN)", ok: metaConfigured() },
    { label: "Verify token (WHATSAPP_VERIFY_TOKEN)", ok: Boolean(process.env.WHATSAPP_VERIFY_TOKEN) },
    { label: "App secret for signatures (META_APP_SECRET)", ok: Boolean(process.env.META_APP_SECRET) },
    { label: "Public URL (APP_URL)", ok: Boolean(process.env.APP_URL) },
  ];

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="text-sm">
            <h2 className="mb-2 font-medium">Webhook endpoint</h2>
            <p className="text-slate-600">
              In the Meta app dashboard (WhatsApp → Configuration), set the callback URL below, use the same verify
              token as <code>WHATSAPP_VERIFY_TOKEN</code>, and subscribe to the <b>messages</b> field.
            </p>
            <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs break-all">{callbackUrl}</p>
            <p className="mt-2 text-slate-600">
              Last verified by Meta:{" "}
              {verifiedAt ? <b className="text-emerald-700">{formatDateTime(verifiedAt)}</b> : <b className="text-slate-500">never</b>}
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {config.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <StatusDot ok={c.ok} />
                <span className={c.ok ? "" : "text-slate-500"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {numbers.map((n) => (
          <NumberCard key={n.id} number={n} activity={n.phone_number_id ? activity.get(n.phone_number_id) : undefined} verified={Boolean(verifiedAt)} />
        ))}
      </div>

      <details className="card p-5">
        <summary className="cursor-pointer font-medium">Add a number</summary>
        <div className="mt-4">
          <NumberForm />
        </div>
      </details>

      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 font-medium">Webhook log · last 50 events</h2>
        {events.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No events yet. They appear here as soon as Meta calls the endpoint.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Received</th>
                  <th className="th">Event</th>
                  <th className="th">Number</th>
                  <th className="th">Contact</th>
                  <th className="th">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="td whitespace-nowrap text-slate-600">{formatDateTime(e.received_at)}</td>
                    <td className="td">
                      <Badge tone={EVENT_TONES[e.kind] ?? "slate"}>{e.kind}</Badge>
                    </td>
                    <td className="td text-slate-600">
                      {(e.phone_number_id && labelFor.get(e.phone_number_id)) || e.display_phone || "—"}
                    </td>
                    <td className="td text-slate-600 tabular-nums">{e.contact ?? "—"}</td>
                    <td className="td text-slate-600">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function NumberCard({
  number: n,
  activity,
  verified,
}: {
  number: WaNumber;
  activity?: { last: string; day: number };
  verified: boolean;
}) {
  const recent = activity ? Date.now() - new Date(`${activity.last.replace(" ", "T")}Z`).getTime() < WEEK_MS : false;
  const steps = [
    { label: "Phone number ID and WABA ID saved", ok: Boolean(n.phone_number_id && n.waba_id) },
    { label: "Cloud API connection checked", ok: n.last_check_ok === 1 },
    { label: "Webhook verified by Meta", ok: verified },
    { label: "Events received in the last 7 days", ok: recent },
    { label: "Routing defined", ok: Boolean(n.routing) },
  ];
  const done = steps.filter((s) => s.ok).length;
  const tone: Tone = done === steps.length ? "green" : done >= 3 ? "amber" : "slate";

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{BRAND_NAMES[n.brand]}</p>
          <h3 className="font-medium">{n.label}</h3>
          <p className="text-sm text-slate-600 tabular-nums">{n.display_phone || "No phone number yet"}</p>
        </div>
        <Badge tone={tone}>
          {done}/{steps.length} ready
        </Badge>
      </div>

      <ul className="space-y-1.5 text-sm">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <StatusDot ok={s.ok} />
            <span className={s.ok ? "" : "text-slate-500"}>{s.label}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div>
          <dt>Last event</dt>
          <dd className="text-slate-700">{formatDateTime(activity?.last)}</dd>
        </div>
        <div>
          <dt>Events (24 h)</dt>
          <dd className="text-slate-700 tabular-nums">{activity?.day ?? 0}</dd>
        </div>
        {n.routing && (
          <div className="col-span-2">
            <dt>Routing</dt>
            <dd className="text-slate-700">{n.routing}</dd>
          </div>
        )}
        {n.last_check_at && (
          <div className="col-span-2">
            <dt>Last API check · {formatDateTime(n.last_check_at)}</dt>
            <dd className={n.last_check_ok ? "text-emerald-700" : "text-red-700"}>{n.last_check_detail}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={checkNumber}>
          <input type="hidden" name="id" value={n.id} />
          <button type="submit" className="btn btn-secondary py-1.5">
            Check connection
          </button>
        </form>
        <form action={deleteNumber}>
          <input type="hidden" name="id" value={n.id} />
          <button type="submit" className="btn btn-danger py-1.5">
            Remove
          </button>
        </form>
      </div>

      <details className="mt-3 border-t border-slate-200 pt-3">
        <summary className="cursor-pointer text-sm text-slate-600">Edit details</summary>
        <div className="mt-3">
          <NumberForm number={n} />
        </div>
      </details>
    </section>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-label={ok ? "Done" : "Not done"}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-white ${ok ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      {ok ? "✓" : ""}
    </span>
  );
}
