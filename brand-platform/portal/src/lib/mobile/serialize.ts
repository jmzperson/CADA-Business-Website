import type { HabitType } from "@/lib/challenges";

export type AvailableChallenge = {
  id: string;
  title: string;
  description: string;
  habit_type: HabitType;
  offer_headline: string;
  offer_code: string | null;
  starts_at: string;
  ends_at: string | null;
  /** Null when the challenge has no redemption cap. */
  spots_remaining: number | null;
  brand: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    category: string;
  };
};

export type EnrollmentSummary = {
  enrollment_id: string;
  challenge_id: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  completion_count: number;
  challenge: {
    title: string;
    habit_type: HabitType;
    offer_headline: string;
    offer_code: string | null;
    status: string;
  };
  brand: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  progress: {
    rule: string;
    required: number;
    current: number;
    completed: boolean;
  };
  reward: {
    issued: boolean;
    reward_id: string | null;
  };
};

export type RewardApiShape = {
  id: string;
  qr_url: string;
  expires_at: string;
  status: string;
  enrollment_id: string;
};

export function formatRewardForApi(reward: {
  id: string;
  qr_url: string;
  expires_at: string;
  status: string;
  enrollment_id: string;
}): RewardApiShape {
  return {
    id: reward.id,
    qr_url: reward.qr_url,
    expires_at: reward.expires_at,
    status: reward.status,
    enrollment_id: reward.enrollment_id,
  };
}

export function serializeAvailableChallenge(
  row: {
    id: string;
    title: string;
    description: string;
    habit_type: string;
    offer_headline: string;
    offer_code: string | null;
    starts_at: string;
    ends_at: string | null;
    max_redemptions?: number | null;
    brands: {
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      category: string;
    };
  },
  spotsRemaining: number | null = null
): AvailableChallenge {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    habit_type: row.habit_type as HabitType,
    offer_headline: row.offer_headline,
    offer_code: row.offer_code,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    spots_remaining: spotsRemaining,
    brand: {
      id: row.brands.id,
      name: row.brands.name,
      slug: row.brands.slug,
      logo_url: row.brands.logo_url,
      category: row.brands.category,
    },
  };
}

export function completionRequired(rule: string): number {
  return rule === "single_completion" ? 1 : 1;
}
