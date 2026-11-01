import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { insertDefaultChecklist, ownerId } from "./marketing";
import { todayInTz, weekStart } from "./time";

type Db = Database.Database;
type Owner = "admin" | "ikram" | "ayman";

const EMPLOYEES = [
  { username: "ikram", name: "Ikram" },
  { username: "ayman", name: "Ayman" },
];

/** This week's master roadmap, created for the week of the first start. */
const WEEKLY_ROADMAP: { owner: Owner; title: string; description?: string }[] = [
  // Abderrahim: Admin / Tech & Performance Lead
  { owner: "admin", title: "Google Ads monitoring & daily call dispatching oversight" },
  { owner: "admin", title: "Lead the ALM & CPA branding redesign with Ayman" },
  {
    owner: "admin",
    title: "Set up Meta Ads campaigns & WhatsApp message templates",
    description: "Track in WhatsApp & Meta → Templates and Meta Ads checklist.",
  },
  {
    owner: "admin",
    title: "Configure WhatsApp Business API (Cloud API / webhooks) for existing and new CPA & ALM numbers",
    description: "Track in WhatsApp & Meta → Numbers & webhooks.",
  },
  { owner: "admin", title: "Direct the WordPress → Next.js migration architecture with Ikram" },
  // Ikram: Web & Operations Support
  { owner: "ikram", title: "Manage daily call dispatching for advisers" },
  {
    owner: "ikram",
    title: "Export the ALM & CPA WordPress databases (MySQL) and wp-content/uploads via FileZilla/FTP",
    description: "Import the .sql exports in WP Migration → Files & data.",
  },
  {
    owner: "ikram",
    title: "Analyze page structures, data schemas and content with Claude Code so no SEO ranking or media is lost",
    description: "Use WP Migration → SEO & routing to confirm every old URL maps 1-to-1.",
  },
  {
    owner: "ikram",
    title: "Audit and verify all live forms and routing links on the ALM and CPA sites",
    description: "Mark each form as OK or broken in WP Migration → Forms.",
  },
  // Ayman: Branding & Creative Design
  { owner: "ayman", title: "Develop the unified brand identity & visual chart for ALM & CPA Assurances" },
  { owner: "ayman", title: "Create high-converting ad visuals and templates for Meta Ads & Google Display" },
  { owner: "ayman", title: "Design WhatsApp campaign creative assets and message templates" },
];

export function seed(db: Db) {
  db.transaction(() => {
    seedTeam(db);
    seedSites(db);
    seedNumbers(db);
    seedTemplates(db);
    seedCampaigns(db);
  })();
}

function isEmpty(db: Db, table: string) {
  return !db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();
}

function seedTeam(db: Db) {
  if (!isEmpty(db, "users")) return;

  const adminPassword = process.env.ADMIN_PASSWORD;
  const employeePassword = process.env.EMPLOYEE_PASSWORD;
  if (!adminPassword || !employeePassword) {
    throw new Error("Set ADMIN_PASSWORD and EMPLOYEE_PASSWORD in .env.local before the first start.");
  }

  const insert = db.prepare("INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)");
  insert.run(
    process.env.ADMIN_USERNAME || "abderrahim",
    process.env.ADMIN_NAME || "Abderrahim",
    bcrypt.hashSync(adminPassword, 10),
    "admin",
  );
  const employeeHash = bcrypt.hashSync(employeePassword, 10);
  for (const e of EMPLOYEES) insert.run(e.username, e.name, employeeHash, "employee");

  const week = weekStart(todayInTz());
  const createdBy = ownerId(db, "admin");
  const insertTask = db.prepare(
    "INSERT INTO tasks (title, description, assignee_id, due_date, scope, created_by) VALUES (?, ?, ?, ?, 'week', ?)",
  );
  for (const t of WEEKLY_ROADMAP) {
    insertTask.run(t.title, t.description ?? null, ownerId(db, t.owner), week, createdBy);
  }
}

function seedSites(db: Db) {
  if (!isEmpty(db, "wp_sites")) return;
  const insert = db.prepare("INSERT INTO wp_sites (code, name, old_base_url) VALUES (?, ?, ?)");
  insert.run("ALM", "ALM Assurances", process.env.ALM_SITE_URL || null);
  insert.run("CPA", "CPA Assurances", process.env.CPA_SITE_URL || null);
}

function seedNumbers(db: Db) {
  if (!isEmpty(db, "wa_numbers")) return;
  const insert = db.prepare("INSERT INTO wa_numbers (brand, label, routing) VALUES (?, ?, ?)");
  insert.run("ALM", "ALM · existing number", "Advisers dispatch (Ikram)");
  insert.run("ALM", "ALM · new number", "Advisers dispatch (Ikram)");
  insert.run("CPA", "CPA · existing number", "Advisers dispatch (Ikram)");
  insert.run("CPA", "CPA · new number", "Advisers dispatch (Ikram)");
}

function seedTemplates(db: Db) {
  if (!isEmpty(db, "wa_templates")) return;
  const insert = db.prepare(
    `INSERT INTO wa_templates (brand, name, language, category, header, body, footer, buttons, samples)
     VALUES (?, ?, 'fr', ?, ?, ?, ?, ?, ?)`,
  );

  for (const [brand, brandName] of [
    ["ALM", "ALM Assurances"],
    ["CPA", "CPA Assurances"],
  ]) {
    insert.run(
      brand,
      "welcome_message",
      "MARKETING",
      `Bienvenue chez ${brandName}`,
      `Bonjour {{1}}, merci de nous avoir contactés ! 👋\n\nUn conseiller ${brandName} revient vers vous très rapidement au sujet de {{2}}.\n\nÀ tout de suite !`,
      brandName,
      JSON.stringify([
        { type: "QUICK_REPLY", text: "Être rappelé(e)" },
        { type: "QUICK_REPLY", text: "Voir nos offres" },
      ]),
      JSON.stringify(["Sara", "votre assurance auto"]),
    );
    insert.run(
      brand,
      "follow_up",
      "MARKETING",
      null,
      `Bonjour {{1}}, nous revenons vers vous au sujet de votre demande de devis {{2}}.\n\nAvez-vous des questions ? Nos conseillers sont disponibles du lundi au vendredi, de 9h à 18h.`,
      brandName,
      JSON.stringify([
        { type: "QUICK_REPLY", text: "Oui, rappelez-moi" },
        { type: "QUICK_REPLY", text: "Plus tard" },
      ]),
      JSON.stringify(["Sara", "assurance habitation"]),
    );
    insert.run(
      brand,
      "devis_confirmation",
      "UTILITY",
      "Demande de devis reçue",
      `Bonjour {{1}}, votre demande de devis n° {{2}} pour {{3}} a bien été enregistrée.\n\nUn conseiller ${brandName} vous contactera sous 24 h ouvrées.`,
      brandName,
      JSON.stringify([{ type: "QUICK_REPLY", text: "Parler à un conseiller" }]),
      JSON.stringify(["Sara", "D-2026-0142", "une assurance auto"]),
    );
  }
}

function seedCampaigns(db: Db) {
  if (!isEmpty(db, "ad_campaigns")) return;
  const insert = db.prepare(
    "INSERT INTO ad_campaigns (brand, name, objective, owner_id) VALUES (?, ?, 'Messages (Click-to-WhatsApp)', ?)",
  );
  for (const brand of ["ALM", "CPA"]) {
    const id = Number(insert.run(brand, `${brand} · WhatsApp lead generation`, ownerId(db, "admin")).lastInsertRowid);
    insertDefaultChecklist(db, id);
  }
}
