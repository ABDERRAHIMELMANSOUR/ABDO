import Badge, { type Tone } from "@/components/Badge";

const tones: Record<string, Tone> = {
  draft: "slate",
  submitted: "indigo",
  approved: "green",
  rejected: "red",
  paused: "amber",
};

const labels: Record<string, string> = {
  draft: "Draft",
  submitted: "In review",
  approved: "Approved",
  rejected: "Rejected",
  paused: "Paused",
};

export function TemplateStatusBadge({ status }: { status: string }) {
  return <Badge tone={tones[status] ?? "slate"}>{labels[status] ?? status}</Badge>;
}
