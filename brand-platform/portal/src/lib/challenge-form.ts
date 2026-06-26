import { HABIT_TYPES } from "@/lib/challenges";

export type ChallengeFormValues = {
  title: string;
  description: string;
  habit_type: string;
  offer_headline: string;
  offer_code: string;
  starts_at: string;
  ends_at: string;
  max_redemptions: string;
};

export const emptyChallengeForm = (): ChallengeFormValues => ({
  title: "",
  description: "",
  habit_type: "gym",
  offer_headline: "",
  offer_code: "",
  starts_at: toDatetimeLocal(new Date()),
  ends_at: "",
  max_redemptions: "",
});

export function toDatetimeLocal(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function habitLabel(value: string) {
  return HABIT_TYPES.find((h) => h.value === value)?.label ?? value;
}
