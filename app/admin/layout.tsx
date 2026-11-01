import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import { requireUser } from "@/lib/auth";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/migration", label: "WP Migration" },
  { href: "/admin/whatsapp", label: "WhatsApp & Meta" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("admin");

  return (
    <>
      <AppHeader user={user} links={links} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
