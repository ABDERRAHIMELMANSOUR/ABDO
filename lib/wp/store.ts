import { getDb } from "@/lib/db";

export type WpSite = {
  id: number;
  code: string;
  name: string;
  old_base_url: string | null;
  new_base_url: string | null;
  uploads_dir: string | null;
};

export type WpItem = {
  id: number;
  site_id: number;
  wp_id: number | null;
  type: string;
  status: string | null;
  title: string | null;
  slug: string | null;
  old_path: string;
  new_path: string;
  mime_type: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical: string | null;
  forms: string | null;
  form_status: "untested" | "ok" | "broken";
  form_note: string | null;
  word_count: number | null;
  local_file: number | null;
  check_status: "ok" | "warning" | "missing" | "error" | null;
  check_http: number | null;
  check_detail: string | null;
  checked_at: string | null;
};

export type WpImport = {
  id: number;
  filename: string;
  format: string;
  size_bytes: number;
  item_count: number;
  summary: string;
  imported_at: string;
};

export function listSites(): WpSite[] {
  return getDb().prepare("SELECT * FROM wp_sites ORDER BY code").all() as WpSite[];
}

export function getSite(id: number): WpSite | undefined {
  return getDb().prepare("SELECT * FROM wp_sites WHERE id = ?").get(id) as WpSite | undefined;
}

export function listImports(siteId: number): WpImport[] {
  return getDb()
    .prepare("SELECT * FROM wp_imports WHERE site_id = ? ORDER BY id DESC LIMIT 20")
    .all(siteId) as WpImport[];
}

export function siteStats(siteId: number) {
  const db = getDb();
  const byType = db
    .prepare("SELECT type, COUNT(*) AS n FROM wp_items WHERE site_id = ? GROUP BY type ORDER BY n DESC")
    .all(siteId) as { type: string; n: number }[];
  const checks = db
    .prepare("SELECT COALESCE(check_status, 'unchecked') AS status, COUNT(*) AS n FROM wp_items WHERE site_id = ? GROUP BY 1")
    .all(siteId) as { status: string; n: number }[];
  const forms = db
    .prepare("SELECT form_status AS status, COUNT(*) AS n FROM wp_items WHERE site_id = ? AND forms IS NOT NULL GROUP BY 1")
    .all(siteId) as { status: string; n: number }[];
  const media = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(local_file = 1) AS found, SUM(local_file = 0) AS missing
       FROM wp_items WHERE site_id = ? AND type = 'attachment'`,
    )
    .get(siteId) as { total: number; found: number | null; missing: number | null };
  const seo = db
    .prepare(
      `SELECT SUM(seo_title IS NOT NULL) AS titles, SUM(seo_description IS NOT NULL) AS descriptions
       FROM wp_items WHERE site_id = ? AND type != 'attachment'`,
    )
    .get(siteId) as { titles: number | null; descriptions: number | null };

  const toMap = (rows: { status: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r.status, r.n]));
  const total = byType.reduce((sum, r) => sum + r.n, 0);
  return { total, byType, checks: toMap(checks), forms: toMap(forms), media, seo };
}

export type ItemFilter = {
  type?: string;
  q?: string;
  check?: string;
  formsOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export function listItems(siteId: number, filter: ItemFilter = {}) {
  const where = ["site_id = ?"];
  const params: (string | number)[] = [siteId];
  if (filter.type) {
    where.push("type = ?");
    params.push(filter.type);
  }
  if (filter.q) {
    where.push("(old_path LIKE ? OR title LIKE ?)");
    params.push(`%${filter.q}%`, `%${filter.q}%`);
  }
  if (filter.check === "unchecked") where.push("check_status IS NULL");
  else if (filter.check === "problems") where.push("check_status IN ('warning', 'missing', 'error')");
  else if (filter.check) {
    where.push("check_status = ?");
    params.push(filter.check);
  }
  if (filter.formsOnly) where.push("forms IS NOT NULL");

  const pageSize = filter.pageSize ?? 50;
  const page = Math.max(1, filter.page ?? 1);
  const db = getDb();
  const sqlWhere = where.join(" AND ");
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM wp_items WHERE ${sqlWhere}`).get(...params) as { n: number };
  const rows = db
    .prepare(
      `SELECT * FROM wp_items WHERE ${sqlWhere}
       ORDER BY CASE type WHEN 'page' THEN 0 WHEN 'post' THEN 1 WHEN 'attachment' THEN 3 ELSE 2 END, old_path
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as WpItem[];
  return { rows, total: n, page, pageCount: Math.max(1, Math.ceil(n / pageSize)) };
}

/** Items to check next: never-checked first, then problems, then the oldest checks. */
export function itemsToCheck(siteId: number, scope: string, limit: number): WpItem[] {
  const filter =
    scope === "unchecked"
      ? "AND check_status IS NULL"
      : scope === "problems"
        ? "AND check_status IN ('warning', 'missing', 'error')"
        : "";
  return getDb()
    .prepare(`SELECT * FROM wp_items WHERE site_id = ? ${filter} ORDER BY checked_at IS NOT NULL, checked_at LIMIT ?`)
    .all(siteId, limit) as WpItem[];
}

export function allItems(siteId: number): WpItem[] {
  return getDb().prepare("SELECT * FROM wp_items WHERE site_id = ? ORDER BY old_path").all(siteId) as WpItem[];
}
