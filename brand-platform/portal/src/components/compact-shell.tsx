import Link from "next/link";
import { CadaLogo } from "@/components/cada-logo";

export function CompactShell({
  pageTitle,
  subtitle,
  children,
  backHref = "/dashboard",
  backLabel = "Dashboard",
}: {
  pageTitle: string;
  subtitle?: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="page-shell min-h-screen">
      <header className="site-nav">
        <div className="mx-auto flex h-[60px] max-w-lg items-center justify-between px-5">
          <CadaLogo href={backHref} subtitle="Partners" size="sm" />
          <Link
            href={backHref}
            className="font-display text-sm font-extrabold text-teal hover:underline"
          >
            {backLabel}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-5 py-6">
        <p className="font-display text-xs font-extrabold uppercase tracking-wide text-teal">
          {pageTitle}
        </p>
        {subtitle && <p className="mt-0.5 text-sm font-bold text-ink-light">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </main>
    </div>
  );
}
