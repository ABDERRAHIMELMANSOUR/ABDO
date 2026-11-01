import type Database from "better-sqlite3";

export const CAMPAIGN_STATUSES = ["planning", "creatives", "review", "live", "paused", "ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planning: "Planning",
  creatives: "Creatives in progress",
  review: "In Meta review",
  live: "Live",
  paused: "Paused",
  ended: "Ended",
};

export const CHECKLIST_SECTIONS = ["Setup", "Tracking", "Creatives", "Launch"] as const;

type Owner = "admin" | "ikram" | "ayman";

/** Every new campaign starts with this checklist. Creative work goes to Ayman, the rest to the admin. */
export const DEFAULT_CHECKLIST: { section: (typeof CHECKLIST_SECTIONS)[number]; title: string; owner: Owner }[] = [
  { section: "Setup", title: "Business Manager and ad account access confirmed", owner: "admin" },
  { section: "Setup", title: "Facebook Page and Instagram account linked", owner: "admin" },
  { section: "Setup", title: "WhatsApp number connected to the Page (Click-to-WhatsApp)", owner: "admin" },
  { section: "Setup", title: "Payment method and account spending limit set", owner: "admin" },
  { section: "Tracking", title: "Meta Pixel and Conversions API installed on the site", owner: "admin" },
  { section: "Tracking", title: "Domain verified in Business Manager", owner: "admin" },
  { section: "Tracking", title: "Conversion events configured (Lead, Contact)", owner: "admin" },
  { section: "Tracking", title: "UTM parameters defined for every ad", owner: "admin" },
  { section: "Creatives", title: "Visuals exported in 1:1, 4:5 and 9:16", owner: "ayman" },
  { section: "Creatives", title: "Brand chart applied (logo, colours, typography)", owner: "ayman" },
  { section: "Creatives", title: "Primary text and headline variants written (FR)", owner: "ayman" },
  { section: "Creatives", title: "Insurance compliance check (claims, mentions légales)", owner: "admin" },
  { section: "Launch", title: "Audiences and locations defined", owner: "admin" },
  { section: "Launch", title: "Budget and schedule set", owner: "admin" },
  { section: "Launch", title: "WhatsApp welcome template approved by Meta", owner: "admin" },
  { section: "Launch", title: "Final approval by Abderrahim", owner: "admin" },
];

export function ownerId(db: Database.Database, owner: Owner): number | null {
  const row = (
    owner === "admin"
      ? db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1 ORDER BY id LIMIT 1").get()
      : db.prepare("SELECT id FROM users WHERE username = ?").get(owner)
  ) as { id: number } | undefined;
  return row?.id ?? null;
}

export function insertDefaultChecklist(db: Database.Database, campaignId: number) {
  const insert = db.prepare(
    "INSERT INTO ad_checklist_items (campaign_id, section, title, owner_id, position) VALUES (?, ?, ?, ?, ?)",
  );
  DEFAULT_CHECKLIST.forEach((item, i) =>
    insert.run(campaignId, item.section, item.title, ownerId(db, item.owner), i),
  );
}
