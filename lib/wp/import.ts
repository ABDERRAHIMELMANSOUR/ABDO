import { getDb } from "@/lib/db";
import { defaultNewPath, type ParseResult } from "./content";
import { parseWpJson } from "./parse-json";
import { parseWpSql } from "./parse-sql";

/**
 * Parses an export and merges it into the site's URL inventory. Re-importing updates titles,
 * SEO data and forms, but keeps the new paths, form audits and check results already recorded.
 */
export function importWpExport(siteId: number, filename: string, sizeBytes: number, text: string) {
  const isSql = /\.sql$/i.test(filename) || (!/\.json$/i.test(filename) && !/^\s*[[{]/.test(text));
  const result: ParseResult = isSql ? parseWpSql(text) : parseWpJson(text);
  if (result.items.length === 0) throw new Error("The file was read, but it contains no public pages, posts or media.");

  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO wp_items (site_id, import_id, wp_id, type, status, title, slug, old_path, new_path, mime_type,
                          published_at, seo_title, seo_description, canonical, forms, word_count)
    VALUES (@siteId, @importId, @wpId, @type, @status, @title, @slug, @oldPath, @newPath, @mimeType,
            @publishedAt, @seoTitle, @seoDescription, @canonical, @forms, @wordCount)
    ON CONFLICT (site_id, old_path) DO UPDATE SET
      import_id = excluded.import_id, wp_id = excluded.wp_id, type = excluded.type, status = excluded.status,
      title = excluded.title, slug = excluded.slug, mime_type = excluded.mime_type,
      published_at = excluded.published_at, seo_title = excluded.seo_title,
      seo_description = excluded.seo_description, canonical = excluded.canonical,
      forms = excluded.forms, word_count = excluded.word_count`);

  db.transaction(() => {
    const importId = Number(
      db
        .prepare(
          "INSERT INTO wp_imports (site_id, filename, format, size_bytes, item_count, summary) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(siteId, filename, result.summary.format, sizeBytes, result.items.length, JSON.stringify(result.summary))
        .lastInsertRowid,
    );
    for (const item of result.items) {
      upsert.run({
        siteId,
        importId,
        wpId: item.wpId,
        type: item.type,
        status: item.status,
        title: item.title,
        slug: item.slug,
        oldPath: item.oldPath,
        newPath: defaultNewPath(item.oldPath),
        mimeType: item.mimeType,
        publishedAt: item.publishedAt,
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        canonical: item.canonical,
        forms: item.forms.length ? item.forms.join(", ") : null,
        wordCount: item.wordCount,
      });
    }
    if (result.summary.siteUrl) {
      db.prepare("UPDATE wp_sites SET old_base_url = ? WHERE id = ? AND (old_base_url IS NULL OR old_base_url = '')").run(
        result.summary.siteUrl,
        siteId,
      );
    }
  })();

  return result;
}
