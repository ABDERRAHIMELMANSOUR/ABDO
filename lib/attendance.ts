import { getDb, type User } from "./db";
import { attendanceFor, type AttendanceRow } from "./queries";
import { sendToSheet } from "./sheets";
import { isLate, nowInTz } from "./time";

/**
 * Records a team member's first connection of the day (admins included) and pushes it to the HR sheet.
 * Safe to call on every login and page visit: later calls the same day do nothing.
 */
export async function recordPunchIn(user: User) {
  const now = nowInTz();
  const status = isLate(now.time) ? "En retard" : "Present";
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO attendance (user_id, work_date, punch_in_time, punch_in_at, status)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(user.id, now.date, now.time, now.iso, status);

  if (result.changes > 0) await syncAttendance(Number(result.lastInsertRowid));
}

export async function syncAttendance(id: number) {
  const db = getDb();
  const row = db
    .prepare("SELECT user_id, work_date FROM attendance WHERE id = ?")
    .get(id) as Pick<AttendanceRow, "user_id" | "work_date"> | undefined;
  if (!row) return;
  const entry = attendanceFor(row.user_id, row.work_date)!;

  const result = await sendToSheet({
    date: entry.work_date,
    time: entry.punch_in_time,
    timestamp: entry.punch_in_at,
    name: entry.name,
    username: entry.username,
    status: entry.status,
  });

  db.prepare("UPDATE attendance SET sheet_synced = ?, sheet_error = ? WHERE id = ?").run(
    result.ok ? 1 : 0,
    result.ok ? null : result.error,
    id,
  );
}
