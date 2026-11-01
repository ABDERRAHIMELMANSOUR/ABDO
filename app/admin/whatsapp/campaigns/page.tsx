import Badge, { type Tone } from "@/components/Badge";
import { requireUser } from "@/lib/auth";
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, CHECKLIST_SECTIONS, type CampaignStatus } from "@/lib/marketing";
import { listAssignable } from "@/lib/queries";
import { formatShortDate } from "@/lib/time";
import { checklistItems, listCampaigns, type Campaign, type ChecklistItem } from "@/lib/whatsapp/store";
import { BRAND_NAMES } from "@/lib/whatsapp/templates";
import { addChecklistItem, deleteCampaign, deleteChecklistItem, setCampaignStatus, toggleChecklistItem } from "../actions";
import CampaignForm from "./CampaignForm";

const STATUS_TONES: Record<CampaignStatus, Tone> = {
  planning: "slate",
  creatives: "indigo",
  review: "amber",
  live: "green",
  paused: "amber",
  ended: "slate",
};

export default async function CampaignsPage() {
  await requireUser("admin");
  const campaigns = listCampaigns();
  const items = checklistItems();
  const members = listAssignable();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {campaigns.length === 0 && (
          <p className="card px-4 py-10 text-center text-sm text-slate-500">No campaigns yet.</p>
        )}
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} items={items.filter((i) => i.campaign_id === c.id)} members={members} />
        ))}
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <CampaignForm />
      </div>
    </div>
  );
}

function CampaignCard({
  campaign: c,
  items,
  members,
}: {
  campaign: Campaign;
  items: ChecklistItem[];
  members: { id: number; name: string }[];
}) {
  const done = items.filter((i) => i.done).length;
  const sections = [...new Set([...CHECKLIST_SECTIONS, ...items.map((i) => i.section)])];

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {BRAND_NAMES[c.brand]} · {c.platform === "Meta" ? "Meta Ads" : "Google Display"}
            </p>
            <h2 className="font-medium">{c.name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {[
                c.objective,
                c.daily_budget ? `${c.daily_budget} MAD/day` : null,
                c.start_date ? `starts ${formatShortDate(c.start_date)}` : null,
                c.owner_name ? `owner ${c.owner_name}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONES[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</Badge>
            <form action={setCampaignStatus} className="flex gap-1">
              <input type="hidden" name="id" value={c.id} />
              <select name="status" defaultValue={c.status} aria-label="Campaign status" className="input w-auto py-1 text-xs">
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CAMPAIGN_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-ghost px-2 py-1 text-xs">
                Set
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
          <span className="text-sm text-slate-500 tabular-nums">
            {done}/{items.length}
          </span>
        </div>
      </div>

      <div className="grid gap-x-6 px-5 py-2 md:grid-cols-2">
        {sections.map((section) => {
          const list = items.filter((i) => i.section === section);
          if (list.length === 0) return null;
          return (
            <div key={section} className="py-2">
              <h3 className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{section}</h3>
              <ul>
                {list.map((i) => (
                  <li key={i.id} className="group flex items-start gap-2 py-1 text-sm">
                    <form action={toggleChecklistItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="done" value={i.done ? "0" : "1"} />
                      <button
                        type="submit"
                        aria-label={i.done ? `Mark "${i.title}" as not done` : `Mark "${i.title}" as done`}
                        className={`mt-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded border text-[10px] ${
                          i.done ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white hover:border-indigo-500"
                        }`}
                      >
                        {i.done ? "✓" : ""}
                      </button>
                    </form>
                    <span className={`flex-1 ${i.done ? "text-slate-400 line-through" : ""}`}>
                      {i.title}
                      {i.owner_name && <span className="ml-1 text-xs text-slate-400">· {i.owner_name}</span>}
                    </span>
                    <form action={deleteChecklistItem} className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <input type="hidden" name="id" value={i.id} />
                      <button type="submit" aria-label={`Remove "${i.title}"`} className="text-xs text-slate-400 hover:text-red-600">
                        ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
        <form action={addChecklistItem} className="flex flex-1 flex-wrap gap-2">
          <input type="hidden" name="campaignId" value={c.id} />
          <input name="title" required placeholder="Add a checklist item" aria-label="New checklist item" className="input min-w-0 flex-1 py-1.5" />
          <select name="section" aria-label="Section" className="input w-auto py-1.5">
            {CHECKLIST_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="ownerId" aria-label="Owner" className="input w-auto py-1.5">
            <option value="">No owner</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary py-1.5">
            Add
          </button>
        </form>
        <form action={deleteCampaign}>
          <input type="hidden" name="id" value={c.id} />
          <button type="submit" className="btn btn-danger py-1.5">
            Delete campaign
          </button>
        </form>
      </div>
    </section>
  );
}
