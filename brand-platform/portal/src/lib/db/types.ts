export type BrandCategory = "gym" | "food" | "wellness" | "retail" | "other";
export type BrandStatus = "pending" | "active" | "suspended";
export type StaffRole = "admin" | "scanner";
export type ChallengeStatus =
  | "draft"
  | "pending_review"
  | "rejected"
  | "active"
  | "ended";
export type EnrollmentStatus = "active" | "completed" | "dropped";
export type QrRewardStatus = "issued" | "redeemed" | "expired" | "revoked";
export type LeadStatus = "new" | "contacted" | "signed_up";

export type BrandDoc = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: BrandCategory;
  website: string | null;
  offer_default_copy: string | null;
  primary_address: string | null;
  status: BrandStatus;
  created_at: string;
  updated_at: string;
};

export type BrandStaffDoc = {
  id: string;
  brand_id: string;
  email: string;
  role: StaffRole;
  auth_user_id: string | null;
  invited_at: string;
  accepted_at: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  created_at: string;
};

export type ChallengeDoc = {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  habit_type: string;
  offer_headline: string;
  offer_code: string | null;
  status: ChallengeStatus;
  starts_at: string;
  ends_at: string | null;
  completion_rule: string;
  max_redemptions: number | null;
  published_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CadaUserDoc = {
  id: string;
  auth_user_id: string;
  display_label: string | null;
  created_at: string;
};

export type EnrollmentDoc = {
  id: string;
  challenge_id: string;
  user_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
  completion_count: number;
};

export type QrRewardDoc = {
  id: string;
  enrollment_id: string;
  brand_id: string;
  user_id: string;
  challenge_id: string;
  token_hash: string;
  token_ciphertext: string | null;
  status: QrRewardStatus;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
};

export type RedemptionDoc = {
  id: string;
  qr_reward_id: string;
  brand_id: string;
  challenge_id: string;
  staff_id: string;
  location_id: string | null;
  redeemed_at: string;
  metadata: Record<string, unknown>;
};

export type RedemptionAttemptDoc = {
  id: string;
  token_hash: string;
  brand_id: string;
  staff_id: string;
  outcome: string;
  created_at: string;
};

export type HabitCompletionEventDoc = {
  id: string;
  user_id: string;
  habit_type: string;
  completed_at: string;
  source_event_id: string;
  enrollment_id: string | null;
};

export type PartnershipLeadDoc = {
  id: string;
  company_name: string;
  email: string;
  message: string | null;
  status: LeadStatus;
  brand_id: string | null;
  created_at: string;
  updated_at: string;
};

export const COLLECTIONS = {
  brands: "brands",
  brandStaff: "brand_staff",
  staffByAuth: "brand_staff_by_auth",
  staffByInvite: "brand_staff_by_invite",
  brandsBySlug: "brands_by_slug",
  challenges: "challenges",
  challengesByBrand: "challenges_by_brand",
  cadaUsers: "cada_users",
  cadaUsersByAuth: "cada_users_by_auth",
  enrollments: "user_challenge_enrollments",
  enrollmentsByUser: "enrollments_by_user",
  enrollmentsByChallenge: "enrollments_by_challenge",
  habitEvents: "habit_completion_events",
  habitEventsBySource: "habit_events_by_source",
  qrRewards: "qr_rewards",
  qrRewardsByEnrollment: "qr_rewards_by_enrollment",
  qrRewardsByTokenHash: "qr_rewards_by_token_hash",
  redemptions: "redemptions",
  redemptionsByBrand: "redemptions_by_brand",
  redemptionAttempts: "redemption_attempts",
  leads: "partnership_leads",
} as const;
