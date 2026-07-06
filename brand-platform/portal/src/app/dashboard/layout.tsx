import { redirect } from "next/navigation";
import { getBrandProfile, getStaffContext } from "@/lib/auth/session";
import { PortalShell } from "@/components/portal-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getStaffContext();
  if (!staff) redirect("/signup/business");

  const brand = await getBrandProfile(staff.brandId);
  if (!brand) redirect("/signup/business");

  return (
    <PortalShell brandName={brand.name} role={staff.role}>
      {children}
    </PortalShell>
  );
}
