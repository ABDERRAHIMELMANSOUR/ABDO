export type ParsedItem = {
  wpId: number | null;
  type: string;
  status: string | null;
  title: string | null;
  slug: string | null;
  oldPath: string;
  mimeType: string | null;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  forms: string[];
  wordCount: number | null;
};

export type ImportSummary = {
  format: "sql" | "json";
  counts: Record<string, number>;
  skipped: number;
  tables?: string[];
  siteUrl?: string | null;
  permalinkStructure?: string | null;
  warnings: string[];
};

export type ParseResult = { items: ParsedItem[]; summary: ImportSummary };

const FORM_PATTERNS: [string, RegExp][] = [
  ["Contact Form 7", /\[contact-form-7\b|wp:contact-form-7/i],
  ["WPForms", /\[wpforms\b|wp:wpforms/i],
  ["Gravity Forms", /\[gravityforms?\b|wp:gravityforms/i],
  ["Ninja Forms", /\[ninja_form/i],
  ["Fluent Forms", /\[fluentform/i],
  ["Elementor form", /"widgetType":"form"|elementor-form/i],
  ["Jetpack form", /wp:jetpack\/contact-form|\[contact-form\]/i],
  ["HTML form", /<form\b/i],
];

/** Names of the form plugins whose shortcodes, blocks or markup appear in the given content. */
export function detectForms(...texts: (string | null | undefined)[]) {
  const all = texts.filter(Boolean).join("\n");
  if (!all) return [];
  return FORM_PATTERNS.filter(([, re]) => re.test(all)).map(([name]) => name);
}

export function wordCount(html: string | null | undefined) {
  if (!html) return 0;
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ocirc: "ô",
  ucirc: "û",
  icirc: "î",
  euro: "€",
};

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// WordPress "plain" permalinks put the ID in the query string, so keep those queries.
const KEPT_QUERY = /^\?(p|page_id|attachment_id|cat|tag)=\d+$/;

/** Turns a full URL or path into the path we track: always starts with "/", no host, no hash. */
export function normalizePath(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim(), "http://placeholder.local");
  } catch {
    return input.startsWith("/") ? input : `/${input}`;
  }
  const query = KEPT_QUERY.test(url.search) ? url.search : "";
  return (url.pathname || "/") + query;
}

/** Next.js serves pages without a trailing slash by default; files and plain permalinks stay as they are. */
export function defaultNewPath(oldPath: string) {
  if (oldPath.includes("?") || oldPath === "/") return oldPath;
  return oldPath.endsWith("/") ? oldPath.slice(0, -1) : oldPath;
}

/** SEO plugins store templates such as "%%title%% %%sep%% %%sitename%%" that can't be compared literally. */
export function isSeoTemplate(value: string | null | undefined) {
  return !value || value.includes("%");
}
