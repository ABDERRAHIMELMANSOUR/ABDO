"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/FormMessage";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CAMPAIGN_STATUSES, insertDefaultChecklist } from "@/lib/marketing";
import { createTemplate, findTemplate, getPhoneNumber, getSubscribedApps } from "@/lib/whatsapp/graph";
import { getNumber, getTemplate, wabaForBrand } from "@/lib/whatsapp/store";
import {
  BRANDS,
  TEMPLATE_STATUSES,
  parseJsonArray,
  toMetaPayload,
  validateTemplate,
  type TemplateButton,
  type TemplateDraft,
} from "@/lib/whatsapp/templates";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const brandOf = (value: string) => BRANDS.find((b) => b === value) ?? null;
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function refresh() {
  revalidatePath("/admin/whatsapp", "layout");
}

// ---- Templates ----

function draftFrom(formData: FormData): TemplateDraft {
  return {
    brand: brandOf(text(formData, "brand")) ?? "ALM",
    name: text(formData, "name"),
    language: text(formData, "language") || "fr",
    category: text(formData, "category"),
    header: text(formData, "header"),
    body: String(formData.get("body") ?? "").trim(),
    footer: text(formData, "footer"),
    buttons: parseJsonArray<TemplateButton>(String(formData.get("buttons") ?? "[]")),
    samples: parseJsonArray<string>(String(formData.get("samples") ?? "[]")),
  };
}

export async function saveTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const draft = draftFrom(formData);
  const errors = validateTemplate(draft);
  if (errors.length) return { error: errors[0] };

  const id = Number(formData.get("id")) || null;
  const requestedStatus = text(formData, "status");
  const status = TEMPLATE_STATUSES.find((s) => s === requestedStatus) ?? "draft";
  const rejection = text(formData, "rejectionReason") || null;
  const db = getDb();

  const duplicate = db
    .prepare("SELECT id FROM wa_templates WHERE brand = ? AND name = ? AND language = ? AND id != ?")
    .get(draft.brand, draft.name, draft.language, id ?? 0);
  if (duplicate) return { error: `${draft.brand} already has a "${draft.name}" template in this language.` };

  const values = [
    draft.brand,
    draft.name,
    draft.language,
    draft.category,
    draft.header || null,
    draft.body,
    draft.footer || null,
    JSON.stringify(draft.buttons),
    JSON.stringify(draft.samples),
    status,
    rejection,
  ];
  let savedId = id;
  if (id) {
    db.prepare(
      `UPDATE wa_templates SET brand = ?, name = ?, language = ?, category = ?, header = ?, body = ?, footer = ?,
       buttons = ?, samples = ?, status = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(...values, id);
  } else {
    savedId = Number(
      db
        .prepare(
          `INSERT INTO wa_templates (brand, name, language, category, header, body, footer, buttons, samples, status, rejection_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...values).lastInsertRowid,
    );
  }
  refresh();
  if (!id) redirect(`/admin/whatsapp/templates/${savedId}`);
  return { message: "Template saved." };
}

export async function deleteTemplate(formData: FormData) {
  await requireUser("admin");
  getDb().prepare("DELETE FROM wa_templates WHERE id = ?").run(Number(formData.get("id")));
  refresh();
  redirect("/admin/whatsapp");
}

export async function submitTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const t = getTemplate(Number(formData.get("id")));
  if (!t) return { error: "Template not found." };
  const waba = wabaForBrand(t.brand);
  if (!waba) return { error: `Add the WhatsApp Business Account ID of a ${t.brand} number first (Numbers & webhooks).` };

  const draft: TemplateDraft = {
    brand: t.brand,
    name: t.name,
    language: t.language,
    category: t.category,
    header: t.header ?? "",
    body: t.body,
    footer: t.footer ?? "",
    buttons: parseJsonArray<TemplateButton>(t.buttons),
    samples: parseJsonArray<string>(t.samples),
  };
  const errors = validateTemplate(draft);
  if (errors.length) return { error: errors[0] };

  try {
    const res = await createTemplate(waba, toMetaPayload(draft));
    const status = res.status === "APPROVED" ? "approved" : res.status === "REJECTED" ? "rejected" : "submitted";
    getDb()
      .prepare("UPDATE wa_templates SET meta_template_id = ?, status = ?, rejection_reason = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(res.id, status, t.id);
    refresh();
    return { message: `Submitted to Meta (status: ${res.status ?? "PENDING"}).` };
  } catch (err) {
    return { error: message(err) };
  }
}

export async function refreshTemplateStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const t = getTemplate(Number(formData.get("id")));
  if (!t) return { error: "Template not found." };
  const waba = wabaForBrand(t.brand);
  if (!waba) return { error: `Add the WhatsApp Business Account ID of a ${t.brand} number first.` };

  try {
    const remote = await findTemplate(waba, t.name, t.language);
    if (!remote) return { error: "Meta has no template with this name and language yet." };
    const map: Record<string, string> = { APPROVED: "approved", REJECTED: "rejected", PAUSED: "paused", DISABLED: "paused" };
    const status = map[remote.status] ?? "submitted";
    getDb()
      .prepare("UPDATE wa_templates SET meta_template_id = ?, status = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?")
      .run(remote.id, status, remote.rejected_reason && remote.rejected_reason !== "NONE" ? remote.rejected_reason : null, t.id);
    refresh();
    return { message: `Meta status: ${remote.status}.` };
  } catch (err) {
    return { error: message(err) };
  }
}

// ---- Numbers ----

export async function saveNumber(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const brand = brandOf(text(formData, "brand"));
  const label = text(formData, "label");
  if (!brand) return { error: "Pick ALM or CPA." };
  if (!label) return { error: "Give the number a label." };
  const phoneNumberId = text(formData, "phoneNumberId") || null;
  const wabaId = text(formData, "wabaId") || null;
  if (phoneNumberId && !/^\d+$/.test(phoneNumberId)) return { error: "The phone number ID is the numeric ID from Meta, not the phone number." };
  if (wabaId && !/^\d+$/.test(wabaId)) return { error: "The WhatsApp Business Account ID is numeric." };

  const id = Number(formData.get("id")) || null;
  const db = getDb();
  if (phoneNumberId && db.prepare("SELECT 1 FROM wa_numbers WHERE phone_number_id = ? AND id != ?").get(phoneNumberId, id ?? 0)) {
    return { error: "Another number already uses this phone number ID." };
  }
  const values = [brand, label, text(formData, "displayPhone") || null, phoneNumberId, wabaId, text(formData, "routing") || null];
  if (id) {
    db.prepare(
      "UPDATE wa_numbers SET brand = ?, label = ?, display_phone = ?, phone_number_id = ?, waba_id = ?, routing = ? WHERE id = ?",
    ).run(...values, id);
  } else {
    db.prepare(
      "INSERT INTO wa_numbers (brand, label, display_phone, phone_number_id, waba_id, routing) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(...values);
  }
  refresh();
  return { message: id ? "Saved." : "Number added." };
}

export async function deleteNumber(formData: FormData) {
  await requireUser("admin");
  getDb().prepare("DELETE FROM wa_numbers WHERE id = ?").run(Number(formData.get("id")));
  refresh();
}

/** Asks Meta for the number's status and whether the app is subscribed to its webhooks. */
export async function checkNumber(formData: FormData) {
  await requireUser("admin");
  const n = getNumber(Number(formData.get("id")));
  if (!n) return;
  const save = (ok: boolean, detail: string) =>
    getDb()
      .prepare("UPDATE wa_numbers SET last_check_at = datetime('now'), last_check_ok = ?, last_check_detail = ? WHERE id = ?")
      .run(ok ? 1 : 0, detail, n.id);

  if (!n.phone_number_id) {
    save(false, "Add the phone number ID from Meta first");
  } else {
    try {
      const info = await getPhoneNumber(n.phone_number_id);
      const parts = [info.verified_name, info.display_phone_number, info.quality_rating && `quality ${info.quality_rating}`];
      if (info.name_status && info.name_status !== "APPROVED") parts.push(`display name ${info.name_status.toLowerCase()}`);
      let ok = true;
      if (n.waba_id) {
        const apps = await getSubscribedApps(n.waba_id);
        if (apps === 0) {
          ok = false;
          parts.push("no app subscribed to this account's webhooks");
        }
      }
      save(ok, parts.filter(Boolean).join(" · "));
      if (!n.display_phone && info.display_phone_number) {
        getDb().prepare("UPDATE wa_numbers SET display_phone = ? WHERE id = ?").run(info.display_phone_number, n.id);
      }
    } catch (err) {
      save(false, message(err));
    }
  }
  refresh();
}

// ---- Campaigns ----

export async function createCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const brand = brandOf(text(formData, "brand"));
  const name = text(formData, "name");
  if (!brand) return { error: "Pick ALM or CPA." };
  if (!name) return { error: "Name the campaign." };
  const platform = text(formData, "platform") === "Google" ? "Google" : "Meta";
  const budget = Number(text(formData, "dailyBudget")) || null;
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(text(formData, "startDate")) ? text(formData, "startDate") : null;

  const db = getDb();
  db.transaction(() => {
    const id = Number(
      db
        .prepare(
          "INSERT INTO ad_campaigns (brand, platform, name, objective, daily_budget, start_date, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(brand, platform, name, text(formData, "objective") || null, budget, startDate, admin.id).lastInsertRowid,
    );
    insertDefaultChecklist(db, id);
  })();
  refresh();
  return { message: "Campaign created with the default checklist." };
}

export async function setCampaignStatus(formData: FormData) {
  await requireUser("admin");
  const requested = text(formData, "status");
  const status = CAMPAIGN_STATUSES.find((s) => s === requested);
  if (!status) return;
  getDb().prepare("UPDATE ad_campaigns SET status = ? WHERE id = ?").run(status, Number(formData.get("id")));
  refresh();
}

export async function deleteCampaign(formData: FormData) {
  await requireUser("admin");
  getDb().prepare("DELETE FROM ad_campaigns WHERE id = ?").run(Number(formData.get("id")));
  refresh();
}

export async function toggleChecklistItem(formData: FormData) {
  await requireUser("admin");
  const done = formData.get("done") === "1";
  getDb()
    .prepare("UPDATE ad_checklist_items SET done = ?, done_at = CASE WHEN ? THEN datetime('now') ELSE NULL END WHERE id = ?")
    .run(done ? 1 : 0, done ? 1 : 0, Number(formData.get("id")));
  refresh();
}

export async function addChecklistItem(formData: FormData) {
  await requireUser("admin");
  const title = text(formData, "title");
  if (!title) return;
  const campaignId = Number(formData.get("campaignId"));
  const db = getDb();
  const { pos } = db
    .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM ad_checklist_items WHERE campaign_id = ?")
    .get(campaignId) as { pos: number };
  db.prepare("INSERT INTO ad_checklist_items (campaign_id, section, title, owner_id, position) VALUES (?, ?, ?, ?, ?)").run(
    campaignId,
    text(formData, "section") || "Setup",
    title,
    Number(formData.get("ownerId")) || null,
    pos,
  );
  refresh();
}

export async function deleteChecklistItem(formData: FormData) {
  await requireUser("admin");
  getDb().prepare("DELETE FROM ad_checklist_items WHERE id = ?").run(Number(formData.get("id")));
  refresh();
}
