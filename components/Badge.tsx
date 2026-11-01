import type { ReactNode } from "react";

const tones = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

export type Tone = keyof typeof tones;

export default function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function AttendanceBadge({ status }: { status?: string }) {
  if (status === "Present") return <Badge tone="green">Present</Badge>;
  if (status === "En retard") return <Badge tone="amber">En retard</Badge>;
  return <Badge tone="slate">Not checked in</Badge>;
}

export function TaskBadge({ status }: { status: string }) {
  if (status === "done") return <Badge tone="green">Done</Badge>;
  if (status === "in_progress") return <Badge tone="indigo">In progress</Badge>;
  return <Badge tone="slate">Pending</Badge>;
}
