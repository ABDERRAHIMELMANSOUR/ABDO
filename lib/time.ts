const TIMEZONE = process.env.TIMEZONE || "Africa/Casablanca";

/** Current date (YYYY-MM-DD) and time (HH:MM:SS) in the company timezone. */
export function nowInTz(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
    iso: at.toISOString(),
  };
}

export function todayInTz() {
  return nowInTz().date;
}

function workStart() {
  const [h, m] = (process.env.WORK_START_TIME || "09:00").split(":").map(Number);
  return { minutes: h * 60 + m, grace: Number(process.env.LATE_GRACE_MINUTES || 0) };
}

/** True when an HH:MM:SS arrival is after the start time plus the grace period. */
export function isLate(time: string) {
  const [h, m, s] = time.split(":").map(Number);
  const { minutes, grace } = workStart();
  return h * 60 + m + s / 60 > minutes + grace;
}

export function workStartLabel() {
  const start = process.env.WORK_START_TIME || "09:00";
  const { grace } = workStart();
  return grace > 0 ? `${start} (${grace} min grace)` : start;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Monday of the week that contains `date`. */
export function weekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}

export function formatWeek(start: string) {
  return `Week of ${formatShortDate(start)} – ${formatShortDate(shiftDate(start, 4))}`;
}

/** SQLite datetime('now') values are UTC "YYYY-MM-DD HH:MM:SS"; show them in the company timezone. */
export function formatDateTime(utc: string | null | undefined) {
  if (!utc) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(`${utc.replace(" ", "T")}Z`));
}

/** "08:55:12" -> "08:55" */
export function hhmm(time: string) {
  return time.slice(0, 5);
}
