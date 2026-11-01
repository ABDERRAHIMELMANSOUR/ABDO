import { getDb } from "@/lib/db";
import type { CampaignStatus } from "@/lib/marketing";
import type { Brand, TemplateStatus } from "./templates";

export type WaTemplate = {
  id: number;
  brand: Brand;
  name: string;
  language: string;
  category: string;
  header: string | null;
  body: string;
  footer: string | null;
  buttons: string;
  samples: string;
  status: TemplateStatus;
  meta_template_id: string | null;
  rejection_reason: string | null;
  updated_at: string;
};

export type WaNumber = {
  id: number;
  brand: Brand;
  label: string;
  display_phone: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  routing: string | null;
  last_check_at: string | null;
  last_check_ok: number | null;
  last_check_detail: string | null;
};

export type WaEvent = {
  id: number;
  received_at: string;
  kind: "verification" | "message" | "status" | "error" | "rejected" | "other";
  phone_number_id: string | null;
  display_phone: string | null;
  contact: string | null;
  detail: string | null;
};

export type Campaign = {
  id: number;
  brand: Brand;
  platform: "Meta" | "Google";
  name: string;
  objective: string | null;
  daily_budget: number | null;
  start_date: string | null;
  status: CampaignStatus;
  owner_id: number | null;
  owner_name: string | null;
};

export type ChecklistItem = {
  id: number;
  campaign_id: number;
  section: string;
  title: string;
  owner_id: number | null;
  owner_name: string | null;
  done: number;
};

export function listTemplates(): WaTemplate[] {
  return getDb().prepare("SELECT * FROM wa_templates ORDER BY brand, name, language").all() as WaTemplate[];
}

export function getTemplate(id: number): WaTemplate | undefined {
  return getDb().prepare("SELECT * FROM wa_templates WHERE id = ?").get(id) as WaTemplate | undefined;
}

export function listNumbers(): WaNumber[] {
  return getDb().prepare("SELECT * FROM wa_numbers ORDER BY brand, id").all() as WaNumber[];
}

export function getNumber(id: number): WaNumber | undefined {
  return getDb().prepare("SELECT * FROM wa_numbers WHERE id = ?").get(id) as WaNumber | undefined;
}

/** The WhatsApp Business Account that holds a brand's templates: the first of its numbers with a WABA ID. */
export function wabaForBrand(brand: string): string | null {
  const row = getDb()
    .prepare("SELECT waba_id FROM wa_numbers WHERE brand = ? AND waba_id IS NOT NULL AND waba_id != '' ORDER BY id LIMIT 1")
    .get(brand) as { waba_id: string } | undefined;
  return row?.waba_id ?? null;
}

export function recentEvents(limit = 50): WaEvent[] {
  return getDb().prepare("SELECT * FROM wa_webhook_events ORDER BY id DESC LIMIT ?").all(limit) as WaEvent[];
}

export function numberActivity() {
  const rows = getDb()
    .prepare(
      `SELECT phone_number_id, MAX(received_at) AS last, SUM(received_at >= datetime('now', '-1 day')) AS day
       FROM wa_webhook_events WHERE phone_number_id IS NOT NULL GROUP BY phone_number_id`,
    )
    .all() as { phone_number_id: string; last: string; day: number }[];
  return new Map(rows.map((r) => [r.phone_number_id, r]));
}

export function lastVerification(): string | null {
  const row = getDb()
    .prepare("SELECT received_at FROM wa_webhook_events WHERE kind = 'verification' ORDER BY id DESC LIMIT 1")
    .get() as { received_at: string } | undefined;
  return row?.received_at ?? null;
}

export function logEvent(e: Partial<Omit<WaEvent, "id" | "received_at">> & { kind: WaEvent["kind"] }) {
  const db = getDb();
  db.prepare(
    "INSERT INTO wa_webhook_events (kind, phone_number_id, display_phone, contact, detail) VALUES (?, ?, ?, ?, ?)",
  ).run(e.kind, e.phone_number_id ?? null, e.display_phone ?? null, e.contact ?? null, e.detail ?? null);
  // Keep the log small: about one in a hundred writes clears events older than 30 days.
  if (Math.random() < 0.01) db.prepare("DELETE FROM wa_webhook_events WHERE received_at < datetime('now', '-30 days')").run();
}

export function listCampaigns(): Campaign[] {
  return getDb()
    .prepare(
      `SELECT c.*, u.name AS owner_name FROM ad_campaigns c LEFT JOIN users u ON u.id = c.owner_id
       ORDER BY CASE c.status WHEN 'ended' THEN 1 ELSE 0 END, c.brand, c.id`,
    )
    .all() as Campaign[];
}

export function checklistItems(): ChecklistItem[] {
  return getDb()
    .prepare(
      `SELECT i.id, i.campaign_id, i.section, i.title, i.owner_id, u.name AS owner_name, i.done
       FROM ad_checklist_items i LEFT JOIN users u ON u.id = i.owner_id ORDER BY i.position, i.id`,
    )
    .all() as ChecklistItem[];
}
