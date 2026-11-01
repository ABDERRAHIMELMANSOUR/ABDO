import { getDb, type AttendanceStatus, type TaskScope, type TaskStatus, type User } from "./db";

export type Task = {
  id: number;
  title: string;
  description: string | null;
  assignee_id: number;
  assignee_name: string;
  due_date: string;
  scope: TaskScope;
  status: TaskStatus;
  completed_at: string | null;
};

export type AttendanceRow = {
  id: number;
  user_id: number;
  name: string;
  username: string;
  work_date: string;
  punch_in_time: string;
  punch_in_at: string;
  status: AttendanceStatus;
  sheet_synced: number;
  sheet_error: string | null;
};

const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.assignee_id, u.name AS assignee_name,
         t.due_date, t.scope, t.status, t.completed_at
  FROM tasks t JOIN users u ON u.id = t.assignee_id`;

const STATUS_ORDER = "CASE t.status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END";

const ATTENDANCE_SELECT = `
  SELECT a.id, a.user_id, u.name, u.username, a.work_date, a.punch_in_time,
         a.punch_in_at, a.status, a.sheet_synced, a.sheet_error
  FROM attendance a JOIN users u ON u.id = a.user_id`;

export function listMembers(): User[] {
  return getDb()
    .prepare("SELECT id, username, name, role, active FROM users ORDER BY role, active DESC, name")
    .all() as User[];
}

export function listEmployees(): User[] {
  return getDb()
    .prepare(
      "SELECT id, username, name, role, active FROM users WHERE role = 'employee' AND active = 1 ORDER BY name",
    )
    .all() as User[];
}

/** Everyone who can receive tasks: active admins first, then employees. */
export function listAssignable(): User[] {
  return getDb()
    .prepare("SELECT id, username, name, role, active FROM users WHERE active = 1 ORDER BY role, name")
    .all() as User[];
}

export function tasksForDate(date: string): Task[] {
  return getDb()
    .prepare(`${TASK_SELECT} WHERE t.scope = 'day' AND t.due_date = ? ORDER BY u.name, ${STATUS_ORDER}, t.id`)
    .all(date) as Task[];
}

export function weeklyTasks(weekStart: string): Task[] {
  return getDb()
    .prepare(`${TASK_SELECT} WHERE t.scope = 'week' AND t.due_date = ? ORDER BY t.id`)
    .all(weekStart) as Task[];
}

export function tasksForUser(userId: number, date: string): Task[] {
  return getDb()
    .prepare(
      `${TASK_SELECT} WHERE t.scope = 'day' AND t.assignee_id = ? AND t.due_date = ? ORDER BY ${STATUS_ORDER}, t.id`,
    )
    .all(userId, date) as Task[];
}

export function weeklyTasksForUser(userId: number, weekStart: string): Task[] {
  return getDb()
    .prepare(`${TASK_SELECT} WHERE t.scope = 'week' AND t.assignee_id = ? AND t.due_date = ? ORDER BY t.id`)
    .all(userId, weekStart) as Task[];
}

/** Unfinished daily tasks from earlier days that the person still has to close. */
export function overdueTasksForUser(userId: number, beforeDate: string): Task[] {
  return getDb()
    .prepare(
      `${TASK_SELECT} WHERE t.scope = 'day' AND t.assignee_id = ? AND t.due_date < ? AND t.status != 'done'
       ORDER BY t.due_date, t.id`,
    )
    .all(userId, beforeDate) as Task[];
}

export function attendanceForDate(date: string): AttendanceRow[] {
  return getDb()
    .prepare(`${ATTENDANCE_SELECT} WHERE a.work_date = ? ORDER BY a.punch_in_time`)
    .all(date) as AttendanceRow[];
}

export function attendanceFor(userId: number, date: string): AttendanceRow | undefined {
  return getDb()
    .prepare(`${ATTENDANCE_SELECT} WHERE a.user_id = ? AND a.work_date = ?`)
    .get(userId, date) as AttendanceRow | undefined;
}

export function attendanceBetween(from: string, to: string, userId?: number): AttendanceRow[] {
  const db = getDb();
  if (userId) {
    return db
      .prepare(
        `${ATTENDANCE_SELECT} WHERE a.work_date BETWEEN ? AND ? AND a.user_id = ? ORDER BY a.work_date DESC, a.punch_in_time`,
      )
      .all(from, to, userId) as AttendanceRow[];
  }
  return db
    .prepare(
      `${ATTENDANCE_SELECT} WHERE a.work_date BETWEEN ? AND ? ORDER BY a.work_date DESC, a.punch_in_time`,
    )
    .all(from, to) as AttendanceRow[];
}

export function unsyncedAttendanceIds(): number[] {
  return (
    getDb().prepare("SELECT id FROM attendance WHERE sheet_synced = 0 ORDER BY id").all() as {
      id: number;
    }[]
  ).map((r) => r.id);
}
