"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; match?: string };

/** Section tabs for pages that live at their own URLs. `match` marks nested pages as part of a tab. */
export default function SubNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 text-sm">
      {items.map((item) => {
        const active = pathname === item.href || (item.match ? pathname.startsWith(item.match) : false);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 whitespace-nowrap ${
              active ? "border-indigo-600 font-medium text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
