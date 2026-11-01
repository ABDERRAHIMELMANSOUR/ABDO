import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { decodeEntities, isSeoTemplate } from "./content";
import type { WpItem, WpSite } from "./store";

type Outcome = { status: "ok" | "warning" | "missing" | "error"; http: number | null; detail: string };

const TIMEOUT_MS = 15_000;
const norm = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim().toLowerCase();
const stripSlash = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function pathOf(url: string) {
  const u = new URL(url);
  return u.pathname + u.search;
}

function metaContent(html: string, attr: "name" | "property" | "rel", value: string) {
  const tag = new RegExp(`<(?:meta|link)[^>]+${attr}=["']${value}["'][^>]*>`, "i").exec(html)?.[0];
  if (!tag) return null;
  return /(?:content|href)=["']([^"']*)["']/i.exec(tag)?.[1] ?? null;
}

/**
 * Requests an old WordPress path on the new site, the way Google will after the switch.
 * It passes when the page answers 200 directly or through permanent redirects that land on
 * the mapped new path, and keeps the same SEO title, description and indexability.
 */
export async function checkItem(site: WpSite, item: WpItem): Promise<Outcome> {
  if (!site.new_base_url) return { status: "error", http: null, detail: "Set the new site URL first" };

  let url = new URL(item.old_path, site.new_base_url).toString();
  const hops: number[] = [];
  try {
    let res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    while (res.status >= 300 && res.status < 400 && hops.length < 5) {
      const location = res.headers.get("location");
      if (!location) break;
      hops.push(res.status);
      await res.body?.cancel();
      url = new URL(location, url).toString();
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    }

    const finalPath = pathOf(url);
    const via = hops.length ? ` via ${hops.join(" → ")} to ${finalPath}` : "";

    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      return { status: "error", http: res.status, detail: "Too many redirects" };
    }
    if (res.status === 404 || res.status === 410) {
      await res.body?.cancel();
      return { status: "missing", http: res.status, detail: `Not found on the new site${via}` };
    }
    if (!res.ok) {
      await res.body?.cancel();
      return { status: "error", http: res.status, detail: `HTTP ${res.status}${via}` };
    }

    const warnings: string[] = [];
    if (hops.some((h) => h === 302 || h === 303 || h === 307)) {
      warnings.push("Uses a temporary redirect; use 301/308 to keep rankings");
    }
    if (stripSlash(finalPath) !== stripSlash(item.new_path)) {
      warnings.push(`Lands on ${finalPath}, expected ${item.new_path}`);
    }

    const isHtml = (res.headers.get("content-type") ?? "").includes("text/html");
    if (item.type !== "attachment" && isHtml) {
      const html = await res.text();
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
      const description = metaContent(html, "name", "description");
      const robots = metaContent(html, "name", "robots");

      if (!title?.trim()) warnings.push("Page has no <title>");
      else if (!isSeoTemplate(item.seo_title) && norm(title) !== norm(item.seo_title!)) {
        warnings.push(`Title changed: "${decodeEntities(title).trim()}" (was "${item.seo_title}")`);
      }
      if (!isSeoTemplate(item.seo_description) && norm(description ?? "") !== norm(item.seo_description!)) {
        warnings.push(description ? "Meta description changed" : "Meta description missing");
      }
      if (robots && /noindex/i.test(robots)) warnings.push("Page is set to noindex");
    } else {
      await res.body?.cancel();
    }

    return warnings.length
      ? { status: "warning", http: res.status, detail: warnings.join(" · ") }
      : { status: "ok", http: res.status, detail: `200 OK${via}` };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "TimeoutError" ? "Timed out" : err.message) : String(err);
    return { status: "error", http: null, detail: message };
  }
}

export async function checkItems(site: WpSite, items: WpItem[], concurrency = 6) {
  const update = getDb().prepare(
    "UPDATE wp_items SET check_status = ?, check_http = ?, check_detail = ?, checked_at = datetime('now') WHERE id = ?",
  );
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      const outcome = await checkItem(site, item);
      update.run(outcome.status, outcome.http, outcome.detail, item.id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

/** Marks each media item as found or missing in the downloaded wp-content/uploads folder. */
export function scanUploads(site: WpSite) {
  if (!site.uploads_dir) throw new Error("Set the local uploads folder first.");
  if (!fs.existsSync(site.uploads_dir)) throw new Error(`Folder not found: ${site.uploads_dir}`);

  const db = getDb();
  const media = db
    .prepare("SELECT id, old_path FROM wp_items WHERE site_id = ? AND type = 'attachment'")
    .all(site.id) as { id: number; old_path: string }[];
  const update = db.prepare("UPDATE wp_items SET local_file = ? WHERE id = ?");
  let found = 0;
  db.transaction(() => {
    for (const m of media) {
      const marker = "/wp-content/uploads/";
      const at = m.old_path.indexOf(marker);
      const relative = at >= 0 ? safeDecode(m.old_path.slice(at + marker.length)) : null;
      const exists = relative ? fs.existsSync(path.join(site.uploads_dir!, relative)) : false;
      if (exists) found++;
      update.run(exists ? 1 : 0, m.id);
    }
  })();
  return { found, total: media.length };
}
