import type { ReactNode } from "react";
import Badge, { type Tone } from "@/components/Badge";
import PageHeader from "@/components/PageHeader";
import Tabs, { Pagination } from "@/components/Tabs";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import type { ImportSummary } from "@/lib/wp/content";
import { listImports, listItems, listSites, siteStats, type WpItem, type WpSite } from "@/lib/wp/store";
import { runChecks, setFormAudit, setNewPath } from "./actions";
import { ImportForm, ScanUploadsButton, SiteSettingsForm } from "./SiteForms";

type Params = { site?: string; tab?: string; type?: string; q?: string; check?: string; page?: string };

const TABS = [
  { key: "files", label: "Files & data" },
  { key: "seo", label: "SEO & routing" },
  { key: "forms", label: "Forms" },
];

const CHECK_TONES: Record<string, Tone> = { ok: "green", warning: "amber", missing: "red", error: "red" };
const CHECK_LABELS: Record<string, string> = { ok: "OK", warning: "Warning", missing: "Missing", error: "Error" };

export default async function MigrationPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser("admin");
  const params = await searchParams;
  const sites = listSites();
  const site = sites.find((s) => s.code === params.site) ?? sites[0];
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "files";
  if (!site) return <p>No sites configured.</p>;

  const link = (overrides: Partial<Params>) => {
    const merged: Params = { site: site.code, tab, ...overrides };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]);
    return `/admin/migration?${qs}`;
  };

  return (
    <>
      <PageHeader
        title="WordPress Migration & Audit"
        subtitle="Inventory every WordPress URL, form and media file, then prove each one survives the move to Next.js."
        actions={
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            {sites.map((s) => (
              <a
                key={s.id}
                href={`/admin/migration?site=${s.code}&tab=${tab}`}
                className={`rounded-md px-3 py-1.5 ${s.id === site.id ? "bg-indigo-600 font-medium text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                {s.name}
              </a>
            ))}
          </div>
        }
      />
      <Tabs active={tab} tabs={TABS.map((t) => ({ ...t, href: link({ tab: t.key, type: undefined, q: undefined, check: undefined, page: undefined }) }))} />
      {tab === "files" && <FilesTab site={site} params={params} link={link} />}
      {tab === "seo" && <SeoTab site={site} params={params} link={link} />}
      {tab === "forms" && <FormsTab site={site} params={params} link={link} />}
    </>
  );
}

type TabProps = { site: WpSite; params: Params; link: (o: Partial<Params>) => string };

function FilesTab({ site, params, link }: TabProps) {
  const stats = siteStats(site.id);
  const imports = listImports(site.id);
  const latest = imports[0] ? (JSON.parse(imports[0].summary) as ImportSummary) : null;
  const items = listItems(site.id, { type: params.type, q: params.q, page: Number(params.page) || 1 });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="URLs tracked" value={stats.total} />
          {stats.byType.slice(0, 3).map((t) => (
            <Stat key={t.type} label={typeLabel(t.type)} value={t.n} />
          ))}
        </div>

        {latest && (
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-medium">Latest import · {imports[0].filename}</h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Info label="Imported">{formatDateTime(imports[0].imported_at)}</Info>
              <Info label="Format">{latest.format.toUpperCase()}</Info>
              {latest.siteUrl && <Info label="WordPress home">{latest.siteUrl}</Info>}
              {latest.format === "sql" && <Info label="Permalinks">{latest.permalinkStructure || "Plain (?p=123)"}</Info>}
              <Info label="Skipped">{latest.skipped} drafts, revisions and internal records</Info>
              <Info label="SEO data">
                {stats.seo.titles ?? 0} custom titles · {stats.seo.descriptions ?? 0} descriptions
              </Info>
              {stats.media.total > 0 && (
                <Info label="Media on disk">
                  {stats.media.found == null && stats.media.missing == null
                    ? "Not scanned yet"
                    : `${stats.media.found ?? 0} found · ${stats.media.missing ?? 0} missing`}
                </Info>
              )}
            </dl>
            {latest.tables && latest.tables.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-slate-600">{latest.tables.length} tables in the dump</summary>
                <p className="mt-2 font-mono text-xs leading-relaxed text-slate-500">{latest.tables.join(" · ")}</p>
              </details>
            )}
            {latest.warnings.map((w) => (
              <p key={w} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                {w}
              </p>
            ))}
          </section>
        )}

        <section className="card overflow-hidden">
          <form className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
            <input type="hidden" name="site" value={site.code} />
            <input type="hidden" name="tab" value="files" />
            <input name="q" defaultValue={params.q} placeholder="Search path or title" className="input w-56" />
            <select name="type" defaultValue={params.type ?? ""} className="input w-auto">
              <option value="">All types</option>
              {stats.byType.map((t) => (
                <option key={t.type} value={t.type}>
                  {typeLabel(t.type)} ({t.n})
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary">
              Filter
            </button>
            <span className="ml-auto text-sm text-slate-500">{items.total} items</span>
          </form>
          {items.total === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Nothing imported yet. Upload the {site.code} database export to build the inventory.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Old URL</th>
                    <th className="th">Type</th>
                    <th className="th">SEO title / description</th>
                    <th className="th">Content</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.rows.map((i) => (
                    <tr key={i.id} className="align-top">
                      <td className="td max-w-xs">
                        <OldLink site={site} item={i} />
                        {i.title && <p className="truncate text-slate-500">{i.title}</p>}
                      </td>
                      <td className="td">
                        <Badge tone="slate">{typeLabel(i.type)}</Badge>
                      </td>
                      <td className="td max-w-sm text-slate-600">
                        {i.seo_title || i.seo_description ? (
                          <>
                            <p className="truncate">{i.seo_title ?? "—"}</p>
                            <p className="truncate text-xs text-slate-400">{i.seo_description ?? ""}</p>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="td text-slate-600">
                        {i.type === "attachment" ? (
                          <span>
                            {i.mime_type ?? "file"}
                            {i.local_file === 1 && <span className="ml-2 text-emerald-700">on disk</span>}
                            {i.local_file === 0 && <span className="ml-2 text-red-600">not in uploads</span>}
                          </span>
                        ) : (
                          <span>
                            {i.word_count ?? 0} words{i.forms && <span className="ml-2 text-indigo-700">· form</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={items.page} pageCount={items.pageCount} href={(page) => link({ type: params.type, q: params.q, page: String(page) })} />
        </section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <ImportForm site={site} />
        <SiteSettingsForm site={site} />
        {site.uploads_dir && (
          <div className="card p-5">
            <ScanUploadsButton site={site} />
          </div>
        )}
        {imports.length > 1 && (
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-medium">Import history</h2>
            <ul className="space-y-1 text-slate-600">
              {imports.map((im) => (
                <li key={im.id} className="flex justify-between gap-2">
                  <span className="truncate">{im.filename}</span>
                  <span className="shrink-0 text-slate-400">{formatDateTime(im.imported_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function SeoTab({ site, params, link }: TabProps) {
  const stats = siteStats(site.id);
  const items = listItems(site.id, { type: params.type, q: params.q, check: params.check, page: Number(params.page) || 1 });
  const c = stats.checks;
  const checked = stats.total - (c.unchecked ?? 0);

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl text-sm text-slate-600">
            <h2 className="mb-1 font-medium text-slate-900">How the check works</h2>
            Each old WordPress path is requested on the new site, as Google will after the switch. It passes when it
            answers <b>200</b>, directly or through permanent <b>301/308</b> redirects that land on the mapped new path,
            with the same SEO title and meta description and no <code>noindex</code>. Checks run {100} URLs at a time.
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/migration/export?site=${site.code}&format=redirects`} className="btn btn-secondary">
              Export Next.js redirects
            </a>
            <a href={`/admin/migration/export?site=${site.code}&format=csv`} className="btn btn-secondary">
              Export CSV
            </a>
          </div>
        </div>
        {!site.new_base_url ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Set the new Next.js site URL in Files & data → Site settings to run checks.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm text-slate-500">
              Testing against <b className="text-slate-700">{site.new_base_url}</b>
            </span>
            {[
              { scope: "unchecked", label: "Check unchecked URLs", primary: true },
              { scope: "problems", label: "Re-check problems" },
              { scope: "all", label: "Re-check oldest" },
            ].map((b) => (
              <form key={b.scope} action={runChecks}>
                <input type="hidden" name="siteId" value={site.id} />
                <input type="hidden" name="scope" value={b.scope} />
                <button type="submit" className={`btn ${b.primary ? "btn-primary" : "btn-secondary"}`}>
                  {b.label}
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Checked" value={`${checked} / ${stats.total}`} />
        <Stat label="OK" value={c.ok ?? 0} tone="text-emerald-700" />
        <Stat label="Warnings" value={c.warning ?? 0} tone="text-amber-700" />
        <Stat label="Missing (404)" value={c.missing ?? 0} tone="text-red-700" />
        <Stat label="Errors" value={c.error ?? 0} tone="text-red-700" />
      </div>

      <section className="card overflow-hidden">
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <input type="hidden" name="site" value={site.code} />
          <input type="hidden" name="tab" value="seo" />
          <input name="q" defaultValue={params.q} placeholder="Search path or title" className="input w-56" />
          <select name="check" defaultValue={params.check ?? ""} className="input w-auto">
            <option value="">All results</option>
            <option value="problems">Problems only</option>
            <option value="unchecked">Unchecked</option>
            <option value="ok">OK</option>
            <option value="warning">Warnings</option>
            <option value="missing">Missing</option>
            <option value="error">Errors</option>
          </select>
          <select name="type" defaultValue={params.type ?? ""} className="input w-auto">
            <option value="">All types</option>
            {stats.byType.map((t) => (
              <option key={t.type} value={t.type}>
                {typeLabel(t.type)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">
            Filter
          </button>
          <span className="ml-auto text-sm text-slate-500">{items.total} URLs</span>
        </form>
        {items.total === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No URLs match. Import an export in Files & data first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Old WordPress URL</th>
                  <th className="th">New Next.js path</th>
                  <th className="th">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.rows.map((i) => (
                  <tr key={i.id} className="align-top">
                    <td className="td max-w-xs">
                      <OldLink site={site} item={i} />
                      <p className="text-xs text-slate-400">{typeLabel(i.type)}</p>
                    </td>
                    <td className="td">
                      <form action={setNewPath} className="flex gap-2">
                        <input type="hidden" name="id" value={i.id} />
                        <input name="newPath" defaultValue={i.new_path} aria-label="New path" className="input w-64 py-1.5 font-mono text-xs" />
                        <button type="submit" className="btn btn-ghost px-2 py-1 text-xs">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="td max-w-sm">
                      {i.check_status ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Badge tone={CHECK_TONES[i.check_status]}>{CHECK_LABELS[i.check_status]}</Badge>
                            {i.check_http && <span className="text-xs text-slate-400 tabular-nums">{i.check_http}</span>}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{i.check_detail}</p>
                        </>
                      ) : (
                        <span className="text-slate-400">Not checked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={items.page}
          pageCount={items.pageCount}
          href={(page) => link({ type: params.type, q: params.q, check: params.check, page: String(page) })}
        />
      </section>
    </div>
  );
}

function FormsTab({ site, params, link }: TabProps) {
  const stats = siteStats(site.id);
  const items = listItems(site.id, { formsOnly: true, page: Number(params.page) || 1 });
  const f = stats.forms;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Not tested" value={f.untested ?? 0} />
        <Stat label="Working" value={f.ok ?? 0} tone="text-emerald-700" />
        <Stat label="Broken" value={f.broken ?? 0} tone="text-red-700" />
      </div>
      <section className="card overflow-hidden">
        <p className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          Pages where a form was detected (Contact Form 7, WPForms, Gravity Forms, Elementor and others). Send a test
          submission on the live site, check it reaches the right inbox or adviser, then record the result.
        </p>
        {items.total === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No forms found yet. Import an export first.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.rows.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-4 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.title || i.old_path}</p>
                  <OldLink site={site} item={i} />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {i.forms!.split(", ").map((name) => (
                      <Badge key={name} tone="indigo">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <form action={setFormAudit} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={i.id} />
                  <select name="formStatus" defaultValue={i.form_status} aria-label="Form status" className="input w-auto py-1.5">
                    <option value="untested">Not tested</option>
                    <option value="ok">Working</option>
                    <option value="broken">Broken</option>
                  </select>
                  <input name="formNote" defaultValue={i.form_note ?? ""} placeholder="Note (recipient, issue…)" className="input w-56 py-1.5" />
                  <button type="submit" className="btn btn-secondary py-1.5">
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={items.page} pageCount={items.pageCount} href={(page) => link({ page: String(page) })} />
      </section>
    </div>
  );
}

function OldLink({ site, item }: { site: WpSite; item: WpItem }) {
  const href = site.old_base_url ? new URL(item.old_path, site.old_base_url).toString() : null;
  const text = <span className="font-mono text-xs break-all">{item.old_path}</span>;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
      {text}
    </a>
  ) : (
    text
  );
}

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function typeLabel(type: string) {
  return { page: "Pages", post: "Posts", attachment: "Media" }[type] ?? type;
}
