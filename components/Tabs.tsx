import Link from "next/link";

/** Underlined tab bar; the active tab is decided by the page, so it works with query-string tabs too. */
export default function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 whitespace-nowrap ${
            t.key === active
              ? "border-indigo-600 font-medium text-indigo-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
      <span className="text-slate-500">
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="btn btn-secondary py-1">
            Previous
          </Link>
        )}
        {page < pageCount && (
          <Link href={href(page + 1)} className="btn btn-secondary py-1">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
