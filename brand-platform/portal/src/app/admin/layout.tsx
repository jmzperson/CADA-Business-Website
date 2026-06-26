import Link from "next/link";
import { CadaLogo } from "@/components/cada-logo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell min-h-screen">
      <header className="site-nav">
        <div className="mx-auto flex h-[60px] max-w-5xl items-center justify-between px-5">
          <CadaLogo href="/admin/leads" subtitle="Admin" size="sm" />
          <nav className="flex items-center gap-4 font-display text-sm font-bold">
            <Link href="/admin/leads" className="text-ink-light hover:text-teal">
              Leads
            </Link>
            <Link href="/admin/challenges" className="text-ink-light hover:text-teal">
              Challenges
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t-2 border-border bg-sky px-5 py-6 text-center text-xs text-ink-light">
        Internal CADA admin · not for brand partners
      </footer>
    </div>
  );
}
