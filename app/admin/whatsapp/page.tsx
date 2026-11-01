import Link from "next/link";
import Badge from "@/components/Badge";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { metaConfigured } from "@/lib/whatsapp/graph";
import { listTemplates } from "@/lib/whatsapp/store";
import { BRANDS, BRAND_NAMES } from "@/lib/whatsapp/templates";
import { TemplateStatusBadge } from "./TemplateStatusBadge";

export default async function TemplatesPage() {
  await requireUser("admin");
  const templates = listTemplates();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Draft and preview templates here, then submit them to Meta
          {metaConfigured() ? "" : " once WHATSAPP_ACCESS_TOKEN is set"}. Status updates come from Meta or can be set by hand.
        </p>
        <Link href="/admin/whatsapp/templates/new" className="btn btn-primary">
          New template
        </Link>
      </div>

      {BRANDS.map((brand) => {
        const mine = templates.filter((t) => t.brand === brand);
        return (
          <section key={brand} className="card overflow-hidden">
            <h2 className="border-b border-slate-200 px-4 py-3 font-medium">{BRAND_NAMES[brand]}</h2>
            {mine.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">No templates yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {mine.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/whatsapp/templates/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-medium">{t.name}</p>
                        <p className="truncate text-sm text-slate-500">{t.body.split("\n")[0]}</p>
                      </div>
                      <Badge tone="slate">{t.category.toLowerCase()}</Badge>
                      <Badge tone="slate">{t.language}</Badge>
                      <TemplateStatusBadge status={t.status} />
                      <span className="w-28 text-right text-xs text-slate-400">{formatDateTime(t.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
