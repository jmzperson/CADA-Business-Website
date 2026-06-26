import Link from "next/link";
import { CadaLogo } from "@/components/cada-logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="page-shell flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="mb-8 flex justify-center">
        <CadaLogo href="/login" subtitle="Partners" size="lg" />
      </div>
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="font-display text-xl font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm font-medium text-ink-light">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className="mt-6 text-center text-sm font-medium text-ink-light">{footer}</div>
        )}
      </div>
      <p className="mt-10 text-center text-xs text-ink-light">
        © {new Date().getFullYear()} CADA
      </p>
    </div>
  );
}

export function Alert({
  type,
  children,
}: {
  type: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "alert-error",
    success: "alert-success",
    info: "alert-info",
  };
  return <div className={`mb-4 ${styles[type]}`}>{children}</div>;
}
