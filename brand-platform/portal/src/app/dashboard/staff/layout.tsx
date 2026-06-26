import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/session";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffContext();
  if (!staff) redirect("/login");
  if (staff.role !== "admin") redirect("/dashboard");
  return children;
}
