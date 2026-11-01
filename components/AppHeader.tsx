import { logout } from "@/app/login/actions";
import type { User } from "@/lib/db";
import Logo from "./Logo";
import NavLink from "./NavLink";

type Props = {
  user: User;
  links?: { href: string; label: string }[];
};

export default function AppHeader({ user, links }: Props) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="flex items-center gap-2 font-semibold">
          <Logo />
          ABDO
          <span className="hidden text-sm font-normal text-slate-500 sm:inline">ALM & CPA</span>
        </span>
        {links && (
          <nav className="order-last flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:w-auto">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-slate-600">{user.name}</span>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
