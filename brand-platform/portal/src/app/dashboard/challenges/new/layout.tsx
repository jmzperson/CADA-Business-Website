import { RequireAdmin } from "@/components/require-admin";

export default function NewChallengeLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
