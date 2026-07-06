import { redirect } from "next/navigation";
import { resolvePortalEntryPath } from "@/lib/auth/portal-entry";

export default async function HomePage() {
  redirect(await resolvePortalEntryPath());
}
