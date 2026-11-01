"use server";

import { revalidatePath } from "next/cache";
import { gunzipSync } from "node:zlib";
import type { FormState } from "@/components/FormMessage";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { normalizePath } from "@/lib/wp/content";
import { checkItems, scanUploads } from "@/lib/wp/check";
import { importWpExport } from "@/lib/wp/import";
import { getSite, itemsToCheck } from "@/lib/wp/store";

const CHECK_BATCH = 100;

function refresh() {
  revalidatePath("/admin/migration");
}

function cleanUrl(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(/\/+$/, "");
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin + url.pathname.replace(/\/+$/, "") : undefined;
  } catch {
    return undefined;
  }
}

export async function importExport(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const site = getSite(Number(formData.get("siteId")));
  const file = formData.get("file");
  if (!site) return { error: "Unknown site." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a .sql, .sql.gz or .json export." };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = (/\.gz$/i.test(file.name) ? gunzipSync(buffer) : buffer).toString("utf8");
    const result = importWpExport(site.id, file.name.replace(/\.gz$/i, ""), file.size, text);
    refresh();
    const kinds = Object.entries(result.summary.counts)
      .map(([type, n]) => `${n} ${type}`)
      .join(", ");
    return { message: `Imported ${result.items.length} URLs from ${file.name}: ${kinds}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveSiteSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const oldBase = cleanUrl(formData.get("oldBaseUrl"));
  const newBase = cleanUrl(formData.get("newBaseUrl"));
  if (oldBase === undefined || newBase === undefined) return { error: "URLs must start with http:// or https://" };
  const uploadsDir = String(formData.get("uploadsDir") ?? "").trim() || null;

  getDb()
    .prepare("UPDATE wp_sites SET old_base_url = ?, new_base_url = ?, uploads_dir = ? WHERE id = ?")
    .run(oldBase, newBase, uploadsDir, Number(formData.get("siteId")));
  refresh();
  return { message: "Saved." };
}

export async function runChecks(formData: FormData) {
  await requireUser("admin");
  const site = getSite(Number(formData.get("siteId")));
  if (!site?.new_base_url) return;
  const scope = String(formData.get("scope") ?? "unchecked");
  await checkItems(site, itemsToCheck(site.id, scope, CHECK_BATCH));
  refresh();
}

export async function setNewPath(formData: FormData) {
  await requireUser("admin");
  const raw = String(formData.get("newPath") ?? "").trim();
  if (!raw) return;
  // A changed target invalidates the previous check result.
  getDb()
    .prepare(
      "UPDATE wp_items SET new_path = ?, check_status = NULL, check_http = NULL, check_detail = NULL, checked_at = NULL WHERE id = ?",
    )
    .run(normalizePath(raw), Number(formData.get("id")));
  refresh();
}

export async function setFormAudit(formData: FormData) {
  await requireUser("admin");
  const status = String(formData.get("formStatus"));
  if (!["untested", "ok", "broken"].includes(status)) return;
  const note = String(formData.get("formNote") ?? "").trim() || null;
  getDb()
    .prepare("UPDATE wp_items SET form_status = ?, form_note = ? WHERE id = ?")
    .run(status, note, Number(formData.get("id")));
  refresh();
}

export async function scanUploadsFolder(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const site = getSite(Number(formData.get("siteId")));
  if (!site) return { error: "Unknown site." };
  try {
    const { found, total } = scanUploads(site);
    refresh();
    return { message: `${found} of ${total} media files found locally.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
