import { redirect } from "next/navigation";
import { getBrandProfile, getStaffContext } from "@/lib/auth/session";
import { PortalShell } from "@/components/portal-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getStaffContext();
  if (!staff) redirect("/login");

  const brand = await getBrandProfile(staff.brandId);
  if (!brand) redirect("/login");

  return (
    <PortalShell brandName={brand.name} role={staff.role}>
      {children}
    </PortalShell>
  );
}
