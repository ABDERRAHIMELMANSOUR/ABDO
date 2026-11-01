import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";

export type Role = "admin" | "employee";
export type TaskStatus = "pending" | "in_progress" | "done";
export type TaskScope = "day" | "week";
export type AttendanceStatus = "Present" | "En retard";

export type User = {
  id: number;
  username: string;
  name: string;
  role: Role;
  active: number;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily tasks use their day as due_date; weekly roadmap tasks use the Monday of their week.
CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  description  TEXT,
  assignee_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date     TEXT NOT NULL,
  scope        TEXT NOT NULL DEFAULT 'day' CHECK (scope IN ('day', 'week')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_date ON tasks (assignee_id, scope, due_date);

CREATE TABLE IF NOT EXISTS attendance (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date     TEXT NOT NULL,
  punch_in_time TEXT NOT NULL,
  punch_in_at   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('Present', 'En retard')),
  sheet_synced  INTEGER NOT NULL DEFAULT 0,
  sheet_error   TEXT,
  UNIQUE (user_id, work_date)
);

-- WordPress migration & audit
CREATE TABLE IF NOT EXISTS wp_sites (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  old_base_url TEXT,
  new_base_url TEXT,
  uploads_dir  TEXT
);

CREATE TABLE IF NOT EXISTS wp_imports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES wp_sites(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  format      TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  item_count  INTEGER NOT NULL,
  summary     TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wp_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id         INTEGER NOT NULL REFERENCES wp_sites(id) ON DELETE CASCADE,
  import_id       INTEGER REFERENCES wp_imports(id) ON DELETE SET NULL,
  wp_id           INTEGER,
  type            TEXT NOT NULL,
  status          TEXT,
  title           TEXT,
  slug            TEXT,
  old_path        TEXT NOT NULL,
  new_path        TEXT NOT NULL,
  mime_type       TEXT,
  published_at    TEXT,
  seo_title       TEXT,
  seo_description TEXT,
  canonical       TEXT,
  forms           TEXT,
  form_status     TEXT NOT NULL DEFAULT 'untested' CHECK (form_status IN ('untested', 'ok', 'broken')),
  form_note       TEXT,
  word_count      INTEGER,
  local_file      INTEGER,
  check_status    TEXT CHECK (check_status IN ('ok', 'warning', 'missing', 'error')),
  check_http      INTEGER,
  check_detail    TEXT,
  checked_at      TEXT,
  UNIQUE (site_id, old_path)
);
CREATE INDEX IF NOT EXISTS idx_wp_items_site_type ON wp_items (site_id, type);

-- WhatsApp Business & Meta Ads
CREATE TABLE IF NOT EXISTS wa_templates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  brand            TEXT NOT NULL CHECK (brand IN ('ALM', 'CPA')),
  name             TEXT NOT NULL,
  language         TEXT NOT NULL DEFAULT 'fr',
  category         TEXT NOT NULL DEFAULT 'UTILITY' CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  header           TEXT,
  body             TEXT NOT NULL,
  footer           TEXT,
  buttons          TEXT NOT NULL DEFAULT '[]',
  samples          TEXT NOT NULL DEFAULT '[]',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paused')),
  meta_template_id TEXT,
  rejection_reason TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (brand, name, language)
);

CREATE TABLE IF NOT EXISTS wa_numbers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  brand             TEXT NOT NULL CHECK (brand IN ('ALM', 'CPA')),
  label             TEXT NOT NULL,
  display_phone     TEXT,
  phone_number_id   TEXT UNIQUE,
  waba_id           TEXT,
  routing           TEXT,
  last_check_at     TEXT,
  last_check_ok     INTEGER,
  last_check_detail TEXT
);

CREATE TABLE IF NOT EXISTS wa_webhook_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at     TEXT NOT NULL DEFAULT (datetime('now')),
  kind            TEXT NOT NULL,
  phone_number_id TEXT,
  display_phone   TEXT,
  contact         TEXT,
  detail          TEXT
);
CREATE INDEX IF NOT EXISTS idx_wa_events_number ON wa_webhook_events (phone_number_id, received_at);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  brand        TEXT NOT NULL CHECK (brand IN ('ALM', 'CPA')),
  platform     TEXT NOT NULL DEFAULT 'Meta' CHECK (platform IN ('Meta', 'Google')),
  name         TEXT NOT NULL,
  objective    TEXT,
  daily_budget REAL,
  start_date   TEXT,
  status       TEXT NOT NULL DEFAULT 'planning'
               CHECK (status IN ('planning', 'creatives', 'review', 'live', 'paused', 'ended')),
  owner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ad_checklist_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  title       TEXT NOT NULL,
  owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  done_at     TEXT,
  position    INTEGER NOT NULL DEFAULT 0
);
`;

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.db) globalForDb.db = open();
  return globalForDb.db;
}

function open() {
  const file = path.resolve(process.env.DATABASE_PATH || "data/app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  seed(db);
  return db;
}
