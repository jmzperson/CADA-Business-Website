"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CadaLogo } from "@/components/cada-logo";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/redemptions", label: "Redemptions", icon: "receipt_long" },
  { href: "/scan", label: "Scan", icon: "qr_code_scanner" },
  { href: "/dashboard/challenges", label: "Challenges", icon: "emoji_events" },
  { href: "/dashboard/profile", label: "Profile", icon: "storefront" },
  { href: "/dashboard/staff", label: "Team", icon: "group", adminOnly: true },
];

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/challenges") return pathname.startsWith("/dashboard/challenges");
  if (href === "/dashboard/redemptions") return pathname.startsWith("/dashboard/redemptions");
  if (href === "/scan") return pathname.startsWith("/scan");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalShell({
  children,
  brandName,
  role,
}: {
  children: React.ReactNode;
  brandName: string;
  role: "admin" | "scanner";
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = NAV.filter((item) => !item.adminOnly || role === "admin");

  return (
    <div className="page-shell min-h-screen">
      <header className="site-nav">
        <div className="mx-auto flex h-[60px] max-w-5xl items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-5">
            <CadaLogo href="/dashboard" subtitle="Partners" size="sm" />
            <nav className="hidden gap-0.5 md:flex">
              {links.map((item) => {
                const active = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link inline-flex items-center gap-1.5 ${active ? "nav-link-active" : ""}`}
                  >
                    <span className="sym sym-sm hidden lg:inline">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="font-display text-sm font-extrabold text-ink">{brandName}</p>
              <p className="text-xs font-bold capitalize text-ink-light">{role}</p>
            </div>
            <button type="button" onClick={logout} className="btn-secondary px-3 py-2 text-xs">
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t-2 border-border px-4 py-2 md:hidden">
          {links.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link shrink-0 px-3 py-1.5 text-xs ${active ? "nav-link-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="portal-main">{children}</main>
      <footer className="border-t-2 border-border bg-sky px-5 py-6 text-center">
        <CadaLogo href="/dashboard" size="sm" />
        <p className="mt-2 text-xs text-ink-light">© {new Date().getFullYear()} CADA Partners</p>
      </footer>
    </div>
  );
}
