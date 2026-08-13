import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { getCadaAdminFromSession } from "@/lib/admin/auth";
import { getPortalSessionUser } from "@/lib/firebase/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCadaAdminFromSession();
  if (!admin) {
    const user = await getPortalSessionUser();
    redirect(user ? "/" : "/login?next=/admin/challenges");
  }

  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
