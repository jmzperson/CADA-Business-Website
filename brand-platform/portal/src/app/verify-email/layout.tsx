import { redirect } from "next/navigation";
import { getStaffByAuthUserId } from "@/lib/db";
import { getPortalSessionUser } from "@/lib/firebase/session";

export default async function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  const user = await getPortalSessionUser();
  if (!user) redirect("/login");

  const staff = await getStaffByAuthUserId(user.uid);
  if (!staff?.accepted_at) redirect("/signup/business");

  return children;
}
