import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/session";

export async function RequireAdmin({
  children,
  redirectTo = "/dashboard/challenges",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const staff = await getStaffContext();
  if (!staff || staff.role !== "admin") {
    redirect(redirectTo);
  }
  return <>{children}</>;
}
