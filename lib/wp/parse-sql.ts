import { detectForms, normalizePath, wordCount, type ParsedItem, type ParseResult } from "./content";

type Value = string | number | null;
type Row = Value[];

// Column order of a standard WordPress install, used when the dump has no column list.
const POST_COLUMNS = [
  "ID", "post_author", "post_date", "post_date_gmt", "post_content", "post_title", "post_excerpt",
  "post_status", "comment_status", "ping_status", "post_password", "post_name", "to_ping", "pinged",
  "post_modified", "post_modified_gmt", "post_content_filtered", "post_parent", "guid", "menu_order",
  "post_type", "post_mime_type", "comment_count",
];
const META_COLUMNS = ["meta_id", "post_id", "meta_key", "meta_value"];
const OPTION_COLUMNS = ["option_id", "option_name", "option_value", "autoload"];

const OPTIONS = new Set(["siteurl", "home", "permalink_structure", "show_on_front", "page_on_front", "blogname"]);
const META_KEYS = new Set([
  "_wp_attached_file",
  "_yoast_wpseo_title",
  "_yoast_wpseo_metadesc",
  "_yoast_wpseo_canonical",
  "rank_math_title",
  "rank_math_description",
  "rank_math_canonical_url",
  "_elementor_data",
]);
// Internal post types that never have a public URL.
const INTERNAL_TYPES = new Set([
  "revision", "nav_menu_item", "customize_changeset", "oembed_cache", "user_request", "wp_block",
  "wp_template", "wp_template_part", "wp_global_styles", "wp_navigation", "wp_font_family",
  "wp_font_face", "custom_css", "elementor_library", "elementor_snippet", "elementor_font",
  "elementor_icons", "acf-field", "acf-field-group", "acf-post-type", "acf-taxonomy",
  "wpcf7_contact_form", "wpforms", "wpforms_log", "scheduled-action", "shop_order", "shop_coupon",
  "jp_mem_plan", "feedback", "mc4wp-form", "nf_sub", "flamingo_contact", "flamingo_inbound",
]);

const ESCAPES: Record<string, string> = { "0": "\0", n: "\n", r: "\r", t: "\t", Z: "\x1a", b: "\b" };

/** Reads the "(...), (...);" value tuples of one INSERT statement, starting right after VALUES. */
function readTuples(sql: string, start: number) {
  const rows: Row[] = [];
  const n = sql.length;
  let i = start;

  while (i < n) {
    const c = sql[i];
    if (c === ";") return { rows, end: i + 1 };
    if (c !== "(") {
      i++;
      continue;
    }
    i++;
    const row: Row = [];
    while (i < n) {
      const ch = sql[i];
      if (ch === "'") {
        let value = "";
        let chunk = ++i;
        while (i < n) {
          const q = sql[i];
          if (q === "\\") {
            value += sql.slice(chunk, i) + (ESCAPES[sql[i + 1]] ?? sql[i + 1]);
            i += 2;
            chunk = i;
          } else if (q === "'") {
            if (sql[i + 1] === "'") {
              value += sql.slice(chunk, i) + "'";
              i += 2;
              chunk = i;
            } else {
              value += sql.slice(chunk, i);
              i++;
              break;
            }
          } else i++;
        }
        row.push(value);
      } else if (ch === ")") {
        i++;
        break;
      } else if (ch === "," || ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
        i++;
      } else {
        let j = i;
        while (j < n && sql[j] !== "," && sql[j] !== ")") j++;
        const token = sql.slice(i, j).trim();
        row.push(token.toUpperCase() === "NULL" ? null : token !== "" && Number.isFinite(Number(token)) ? Number(token) : token);
        i = j;
      }
    }
    rows.push(row);
  }
  return { rows, end: i };
}

function* insertRows(sql: string, table: string, defaultColumns: string[]) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const marker = new RegExp(
    "INSERT\\s+(?:IGNORE\\s+)?INTO\\s+`?" + escaped + "`?\\s*(\\([^)]*\\))?\\s*VALUES\\s*",
    "gi",
  );
  let match: RegExpExecArray | null;
  while ((match = marker.exec(sql))) {
    const columns = match[1]
      ? match[1].slice(1, -1).split(",").map((c) => c.trim().replace(/`/g, ""))
      : defaultColumns;
    const { rows, end } = readTuples(sql, marker.lastIndex);
    marker.lastIndex = end;
    for (const row of rows) {
      const obj: Record<string, Value> = {};
      columns.forEach((col, k) => (obj[col] = row[k] ?? null));
      yield obj;
    }
  }
}

type Post = {
  id: number;
  parent: number;
  type: string;
  status: string;
  slug: string;
  title: string;
  date: string;
  guid: string;
  mime: string | null;
  forms: string[];
  words: number;
};

/** Reads a mysqldump / phpMyAdmin export of a WordPress database. */
export function parseWpSql(sql: string): ParseResult {
  const prefixMatch = /INSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w*?)posts`?\s*[(V]/i.exec(sql);
  if (!prefixMatch) {
    throw new Error("No wp_posts data found. Export the database with data, not just the structure.");
  }
  const prefix = prefixMatch[1];
  const tables = [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?/gi)].map((m) => m[1]);
  const warnings: string[] = [];

  const options: Record<string, string> = {};
  for (const o of insertRows(sql, `${prefix}options`, OPTION_COLUMNS)) {
    const name = String(o.option_name ?? "");
    if (OPTIONS.has(name)) options[name] = String(o.option_value ?? "");
  }

  const meta = new Map<number, Record<string, string>>();
  for (const m of insertRows(sql, `${prefix}postmeta`, META_COLUMNS)) {
    const key = String(m.meta_key ?? "");
    if (!META_KEYS.has(key)) continue;
    const postId = Number(m.post_id);
    const entry = meta.get(postId) ?? {};
    // Elementor data can be huge; only remember whether it contains a form widget.
    entry[key] = key === "_elementor_data" ? (/"widgetType":"form"/.test(String(m.meta_value)) ? "form" : "") : String(m.meta_value ?? "");
    meta.set(postId, entry);
  }

  const posts: Post[] = [];
  let skipped = 0;
  for (const p of insertRows(sql, `${prefix}posts`, POST_COLUMNS)) {
    const type = String(p.post_type ?? "");
    const status = String(p.post_status ?? "");
    const isPublic = type === "attachment" ? status === "inherit" || status === "publish" : status === "publish";
    if (INTERNAL_TYPES.has(type) || !isPublic) {
      skipped++;
      continue;
    }
    const content = p.post_content == null ? "" : String(p.post_content);
    posts.push({
      id: Number(p.ID),
      parent: Number(p.post_parent ?? 0),
      type,
      status,
      slug: String(p.post_name ?? ""),
      title: String(p.post_title ?? ""),
      date: String(p.post_date ?? ""),
      guid: String(p.guid ?? ""),
      mime: p.post_mime_type ? String(p.post_mime_type) : null,
      forms: type === "attachment" ? [] : detectForms(content),
      words: type === "attachment" ? 0 : wordCount(content),
    });
  }

  const byId = new Map(posts.map((p) => [p.id, p]));
  const structure = options.permalink_structure ?? "";
  const frontPageId = options.show_on_front === "page" ? Number(options.page_on_front) : null;
  if (structure.includes("%category%")) {
    warnings.push(
      "Permalinks use %category%, which this import can't resolve. Post URLs contain 'category' as a placeholder; fix them in SEO & routing or import REST JSON for exact links.",
    );
  }

  const hierarchicalPath = (p: Post) => {
    const parts: string[] = [];
    const seen = new Set<number>();
    let current: Post | undefined = p;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(current.slug || String(current.id));
      const parent: Post | undefined = current.parent ? byId.get(current.parent) : undefined;
      current = parent && parent.type === p.type ? parent : undefined;
    }
    return `/${parts.join("/")}/`;
  };

  const pathFor = (p: Post): string => {
    if (p.type === "attachment") {
      const file = meta.get(p.id)?._wp_attached_file;
      return file ? `/wp-content/uploads/${file}` : normalizePath(p.guid);
    }
    if (p.id === frontPageId) return "/";
    if (p.type === "page") return structure ? hierarchicalPath(p) : `/?page_id=${p.id}`;
    if (p.type === "post") {
      if (!structure) return `/?p=${p.id}`;
      const [year = "", month = "", day = ""] = p.date.slice(0, 10).split("-");
      const path = structure
        .replace("%year%", year)
        .replace("%monthnum%", month)
        .replace("%day%", day)
        .replace(/%hour%|%minute%|%second%/g, "00")
        .replace("%postname%", p.slug || String(p.id))
        .replace("%post_id%", String(p.id))
        .replace("%category%", "category")
        .replace("%author%", "author");
      return normalizePath(path);
    }
    return `/${p.type}${hierarchicalPath(p)}`;
  };

  const counts: Record<string, number> = {};
  const items: ParsedItem[] = posts.map((p) => {
    const m = meta.get(p.id) ?? {};
    counts[p.type] = (counts[p.type] ?? 0) + 1;
    return {
      wpId: p.id,
      type: p.type,
      status: p.status,
      title: p.title || null,
      slug: p.slug || null,
      oldPath: pathFor(p),
      mimeType: p.mime,
      publishedAt: p.date || null,
      seoTitle: m._yoast_wpseo_title || m.rank_math_title || null,
      seoDescription: m._yoast_wpseo_metadesc || m.rank_math_description || null,
      canonical: m._yoast_wpseo_canonical || m.rank_math_canonical_url || null,
      forms: m._elementor_data === "form" ? [...new Set([...p.forms, "Elementor form"])] : p.forms,
      wordCount: p.type === "attachment" ? null : p.words,
    };
  });

  return {
    items,
    summary: {
      format: "sql",
      counts,
      skipped,
      tables,
      siteUrl: options.home || options.siteurl || null,
      permalinkStructure: structure || null,
      warnings,
    },
  };
}
