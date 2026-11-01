import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { allItems, listSites } from "@/lib/wp/store";

export const dynamic = "force-dynamic";

const stripSlash = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);
// Characters with a special meaning in Next.js path patterns.
const escapeSource = (p: string) => p.replace(/[():*+?{}]/g, "\\$&");

/** Downloads the URL map as next.config redirects or as a CSV for the team. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Unauthorized", { status: 401 });

  const code = req.nextUrl.searchParams.get("site");
  const site = listSites().find((s) => s.code === code);
  if (!site) return new Response("Unknown site", { status: 404 });
  const items = allItems(site.id);
  const stamp = new Date().toISOString().slice(0, 10);

  if (req.nextUrl.searchParams.get("format") === "csv") {
    const header = ["old_url", "new_path", "type", "title", "seo_title", "check_status", "http", "check_detail", "forms", "form_status"];
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = items.map((i) =>
      [
        site.old_base_url ? new URL(i.old_path, site.old_base_url).toString() : i.old_path,
        i.new_path,
        i.type,
        i.title,
        i.seo_title,
        i.check_status,
        i.check_http,
        i.check_detail,
        i.forms,
        i.forms ? i.form_status : "",
      ]
        .map(cell)
        .join(","),
    );
    return new Response("﻿" + [header.join(","), ...rows].join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${site.code.toLowerCase()}-url-map-${stamp}.csv"`,
      },
    });
  }

  // Only paths that really change need a redirect; Next.js already handles trailing slashes.
  const redirects = items
    .filter((i) => stripSlash(i.old_path) !== stripSlash(i.new_path))
    .map((i) => {
      const [path, query] = i.old_path.split("?");
      if (query) {
        // Plain permalinks such as /?p=123 are matched on the query string.
        const [key, value] = query.split("=");
        return { source: escapeSource(path || "/"), has: [{ type: "query", key, value }], destination: i.new_path, permanent: true };
      }
      return { source: escapeSource(stripSlash(path)), destination: i.new_path, permanent: true };
    });

  return new Response(JSON.stringify(redirects, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${site.code.toLowerCase()}-redirects-${stamp}.json"`,
    },
  });
}
