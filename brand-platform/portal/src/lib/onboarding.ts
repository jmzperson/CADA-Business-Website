import { getBrandById, listChallengesByBrand } from "@/lib/db";

export type OnboardingStep = {
  id: "profile" | "challenge" | "publish";
  label: string;
  done: boolean;
  href: string;
};

export type OnboardingState = {
  complete: boolean;
  steps: OnboardingStep[];
  has_challenges: boolean;
  has_published_challenge: boolean;
};

export async function getBrandOnboarding(brandId: string): Promise<OnboardingState> {
  const [brand, challengeRows] = await Promise.all([
    getBrandById(brandId),
    listChallengesByBrand(brandId),
  ]);

  const profileComplete = Boolean(brand?.logo_url || brand?.website || brand?.primary_address);

  const hasChallenges = challengeRows.length > 0;
  const hasPublished = challengeRows.some((c) => c.status === "active" || c.status === "ended");

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      label: "Complete your brand profile",
      done: profileComplete,
      href: "/dashboard/profile",
    },
    {
      id: "challenge",
      label: "Create your first challenge",
      done: hasChallenges,
      href: "/dashboard/challenges/new",
    },
    {
      id: "publish",
      label: "Get a challenge approved",
      done: hasPublished,
      href: hasChallenges
        ? `/dashboard/challenges/${challengeRows.find((c) => c.status === "draft" || c.status === "rejected")?.id ?? challengeRows[0]?.id}/edit`
        : "/dashboard/challenges/new",
    },
  ];

  return {
    complete: steps.every((s) => s.done),
    steps,
    has_challenges: hasChallenges,
    has_published_challenge: hasPublished,
  };
}
