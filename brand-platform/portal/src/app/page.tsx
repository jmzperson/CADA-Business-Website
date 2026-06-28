import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.email_verified || process.env.SKIP_EMAIL_VERIFICATION === "true"
      ? "/dashboard"
      : "/verify-email");
  }
  redirect("/login");
}
