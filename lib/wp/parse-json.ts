import { decodeEntities, detectForms, normalizePath, wordCount, type ParsedItem, type ParseResult } from "./content";

type Json = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const rendered = (v: unknown) => str(v) ?? (v && typeof v === "object" ? str((v as Json).rendered) : null);

// Keys of an export object hint at the type of the records they hold.
const HINTS: Record<string, string> = { posts: "post", pages: "page", media: "attachment", attachments: "attachment" };

/**
 * Reads WordPress REST API exports (/wp-json/wp/v2/posts, pages, media), either as one array
 * or as an object of arrays like { "posts": [...], "pages": [...] }. Plain records with
 * url/title/type fields work too.
 */
export function parseWpJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }

  const records: { record: Json; hint?: string }[] = [];
  const collect = (value: unknown, hint?: string) => {
    if (!Array.isArray(value)) return;
    for (const r of value) if (r && typeof r === "object" && !Array.isArray(r)) records.push({ record: r as Json, hint });
  };
  if (Array.isArray(data)) collect(data);
  else if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data as Json)) collect(value, HINTS[key] ?? key.replace(/s$/, ""));
  }
  if (records.length === 0) {
    throw new Error("No WordPress records found. Upload an array of posts, pages or media, or an object of such arrays.");
  }

  const items: ParsedItem[] = [];
  const counts: Record<string, number> = {};
  let skipped = 0;

  for (const { record: r, hint } of records) {
    const isMedia = r.type === "attachment" || hint === "attachment" || Boolean(r.source_url) || Boolean(r.mime_type);
    const type = str(r.type) ?? hint ?? (isMedia ? "attachment" : "page");
    // For media the file URL matters for SEO (image search, embeds), not the attachment page.
    const url = (isMedia ? str(r.source_url) : null) ?? str(r.link) ?? str(r.url) ?? str(r.old_url);
    if (!url) {
      skipped++;
      continue;
    }

    const yoast = (r.yoast_head_json ?? {}) as Json;
    const content = rendered(r.content);
    const title = rendered(r.title);
    items.push({
      wpId: typeof r.id === "number" ? r.id : null,
      type,
      status: str(r.status),
      title: title ? decodeEntities(title) : null,
      slug: str(r.slug),
      oldPath: normalizePath(url),
      mimeType: str(r.mime_type),
      publishedAt: str(r.date),
      seoTitle: str(yoast.title) ?? str(r.seo_title),
      seoDescription: str(yoast.description) ?? str(r.seo_description),
      canonical: str(yoast.canonical) ?? str(r.canonical),
      forms: detectForms(content),
      wordCount: content ? wordCount(content) : null,
    });
    counts[type] = (counts[type] ?? 0) + 1;
  }

  return { items, summary: { format: "json", counts, skipped, warnings: [] } };
}
