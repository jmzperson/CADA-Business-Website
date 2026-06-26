import { redirect } from "next/navigation";
import { getBrandProfile, getStaffContext } from "@/lib/auth/session";
import { ScannerClient } from "@/components/scanner-client";
import { parseTokenFromScan } from "@/lib/mobile/redeem";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ScanPage({ searchParams }: PageProps) {
  const staff = await getStaffContext();
  if (!staff) redirect("/login?next=/scan");

  if (staff.role !== "admin" && staff.role !== "scanner") {
    redirect("/dashboard");
  }

  const brand = await getBrandProfile(staff.brandId);
  const params = await searchParams;
  const rawToken = params.token?.trim();
  const initialToken = rawToken ? parseTokenFromScan(rawToken) : undefined;

  if (rawToken && initialToken) {
    return (
      <ScannerClient
        brandName={brand?.name ?? "Your business"}
        role={staff.role}
        initialToken={initialToken}
      />
    );
  }

  return (
    <ScannerClient
      brandName={brand?.name ?? "Your business"}
      role={staff.role}
    />
  );
}
