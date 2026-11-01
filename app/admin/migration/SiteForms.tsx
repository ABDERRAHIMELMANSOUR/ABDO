"use client";

import { useActionState } from "react";
import FormMessage from "@/components/FormMessage";
import type { WpSite } from "@/lib/wp/store";
import { importExport, saveSiteSettings, scanUploadsFolder } from "./actions";

export function ImportForm({ site }: { site: WpSite }) {
  const [state, formAction, pending] = useActionState(importExport, null);

  return (
    <form action={formAction} className="card space-y-3 p-5">
      <input type="hidden" name="siteId" value={site.id} />
      <div>
        <h2 className="font-medium">Import an export</h2>
        <p className="mt-1 text-sm text-slate-500">
          A MySQL dump (<code>.sql</code> or <code>.sql.gz</code>) or REST API JSON. Importing again updates the
          inventory and keeps your mappings and audits.
        </p>
      </div>
      <input
        name="file"
        type="file"
        required
        accept=".sql,.gz,.json,application/json,application/sql"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
      />
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Reading file…" : "Import"}
      </button>
    </form>
  );
}

export function SiteSettingsForm({ site }: { site: WpSite }) {
  const [state, formAction, pending] = useActionState(saveSiteSettings, null);

  return (
    <form action={formAction} className="card space-y-3 p-5">
      <input type="hidden" name="siteId" value={site.id} />
      <h2 className="font-medium">Site settings</h2>
      <div>
        <label htmlFor={`old-${site.id}`} className="label">
          Live WordPress URL
        </label>
        <input id={`old-${site.id}`} name="oldBaseUrl" defaultValue={site.old_base_url ?? ""} placeholder="https://www.example.ma" className="input" />
      </div>
      <div>
        <label htmlFor={`new-${site.id}`} className="label">
          New Next.js site URL <span className="font-normal text-slate-400">(staging or local)</span>
        </label>
        <input id={`new-${site.id}`} name="newBaseUrl" defaultValue={site.new_base_url ?? ""} placeholder="http://localhost:3001" className="input" />
      </div>
      <div>
        <label htmlFor={`uploads-${site.id}`} className="label">
          Downloaded <code>wp-content/uploads</code> folder
        </label>
        <input
          id={`uploads-${site.id}`}
          name="uploadsDir"
          defaultValue={site.uploads_dir ?? ""}
          placeholder="C:\exports\alm\wp-content\uploads"
          className="input"
        />
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-secondary w-full">
        Save settings
      </button>
    </form>
  );
}

export function ScanUploadsButton({ site }: { site: WpSite }) {
  const [state, formAction, pending] = useActionState(scanUploadsFolder, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="siteId" value={site.id} />
      <button type="submit" disabled={pending || !site.uploads_dir} className="btn btn-secondary">
        {pending ? "Scanning…" : "Scan uploads folder"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
