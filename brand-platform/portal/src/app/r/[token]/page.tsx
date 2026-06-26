import { RedeemLandingClient } from "@/components/redeem-landing-client";

type PageProps = { params: Promise<{ token: string }> };

export default async function RedeemLandingPage({ params }: PageProps) {
  const { token } = await params;
  return <RedeemLandingClient token={decodeURIComponent(token)} />;
}
