// Shared by the template editor (browser) and the server, so keep this file free of Node imports.

export const BRANDS = ["ALM", "CPA"] as const;
export type Brand = (typeof BRANDS)[number];
export const BRAND_NAMES: Record<Brand, string> = { ALM: "ALM Assurances", CPA: "CPA Assurances" };

export const TEMPLATE_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
export const TEMPLATE_LANGUAGES = [
  { code: "fr", label: "French" },
  { code: "ar", label: "Arabic" },
  { code: "en", label: "English" },
] as const;
export const TEMPLATE_STATUSES = ["draft", "submitted", "approved", "rejected", "paused"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
export type TemplateButton = { type: ButtonType; text: string; value?: string };

export type TemplateDraft = {
  brand: Brand;
  name: string;
  language: string;
  category: string;
  header: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
  samples: string[];
};

const VARIABLE = /\{\{\s*(\d+)\s*\}\}/g;
const HAS_VARIABLE = /\{\{\s*\d+\s*\}\}/;

/** Highest {{n}} used in the text, i.e. how many sample values Meta will ask for. */
export function variableCount(text: string) {
  let max = 0;
  for (const m of text.matchAll(VARIABLE)) max = Math.max(max, Number(m[1]));
  return max;
}

/** Mirrors Meta's template review rules closely enough to catch rejections before submitting. */
export function validateTemplate(t: TemplateDraft): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) errors.push("Name: use lowercase letters, numbers and underscores only.");
  if (!TEMPLATE_CATEGORIES.includes(t.category as (typeof TEMPLATE_CATEGORIES)[number])) errors.push("Pick a category.");
  if (!t.body.trim()) errors.push("The body is required.");
  if (t.body.length > 1024) errors.push(`The body has ${t.body.length} characters; the limit is 1024.`);
  if (t.header.length > 60) errors.push("The header is limited to 60 characters.");
  if (t.footer.length > 60) errors.push("The footer is limited to 60 characters.");
  if (HAS_VARIABLE.test(t.header) || HAS_VARIABLE.test(t.footer)) errors.push("Use variables in the body only.");

  const count = variableCount(t.body);
  const used = new Set([...t.body.matchAll(VARIABLE)].map((m) => Number(m[1])));
  for (let i = 1; i <= count; i++) {
    if (!used.has(i)) errors.push(`Number variables in order: {{${i}}} is missing.`);
  }
  const trimmed = t.body.trim();
  if (/^\{\{\s*\d+\s*\}\}/.test(trimmed) || /\{\{\s*\d+\s*\}\}$/.test(trimmed)) {
    errors.push("Meta rejects bodies that start or end with a variable.");
  }
  for (let i = 0; i < count; i++) {
    if (!t.samples[i]?.trim()) errors.push(`Add a sample value for {{${i + 1}}}.`);
  }

  if (t.buttons.length > 10) errors.push("At most 10 buttons.");
  if (t.buttons.filter((b) => b.type === "URL").length > 2) errors.push("At most 2 website buttons.");
  if (t.buttons.filter((b) => b.type === "PHONE_NUMBER").length > 1) errors.push("At most 1 call button.");
  t.buttons.forEach((b, i) => {
    if (!b.text.trim()) errors.push(`Button ${i + 1} needs a label.`);
    if (b.text.length > 25) errors.push(`Button ${i + 1}: labels are limited to 25 characters.`);
    if (b.type === "URL" && !/^https:\/\/\S+$/.test(b.value ?? "")) errors.push(`Button ${i + 1} needs an https:// link.`);
    if (b.type === "PHONE_NUMBER" && !/^\+\d{8,15}$/.test(b.value ?? "")) {
      errors.push(`Button ${i + 1} needs a phone number in international format, like +212600000000.`);
    }
  });
  return errors;
}

export function fillVariables(text: string, samples: string[]) {
  return text.replace(VARIABLE, (match, n: string) => samples[Number(n) - 1]?.trim() || match);
}

/** Request body for POST /{waba-id}/message_templates. */
export function toMetaPayload(t: TemplateDraft) {
  const components: Record<string, unknown>[] = [];
  if (t.header.trim()) components.push({ type: "HEADER", format: "TEXT", text: t.header.trim() });
  const count = variableCount(t.body);
  components.push({
    type: "BODY",
    text: t.body,
    ...(count ? { example: { body_text: [t.samples.slice(0, count)] } } : {}),
  });
  if (t.footer.trim()) components.push({ type: "FOOTER", text: t.footer.trim() });
  if (t.buttons.length) {
    components.push({
      type: "BUTTONS",
      buttons: t.buttons.map((b) =>
        b.type === "URL"
          ? { type: "URL", text: b.text, url: b.value }
          : b.type === "PHONE_NUMBER"
            ? { type: "PHONE_NUMBER", text: b.text, phone_number: b.value }
            : { type: "QUICK_REPLY", text: b.text },
      ),
    });
  }
  return { name: t.name, language: t.language, category: t.category, components };
}

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
