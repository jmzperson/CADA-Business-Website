import { getBrandProfile, getStaffContext } from "@/lib/auth/session";
import { DashboardMetrics } from "@/components/dashboard-metrics";

export default async function DashboardPage() {
  const staff = await getStaffContext();
  const brand = staff ? await getBrandProfile(staff.brandId) : null;

  return <DashboardMetrics brandName={brand?.name ?? "your brand"} />;
}
