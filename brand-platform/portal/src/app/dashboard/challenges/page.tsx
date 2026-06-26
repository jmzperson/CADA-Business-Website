import { getStaffContext } from "@/lib/auth/session";
import { ChallengesList } from "@/components/challenges-list";

export default async function ChallengesPage() {
  const staff = await getStaffContext();
  const isAdmin = staff?.role === "admin";

  return <ChallengesList isAdmin={isAdmin} />;
}
