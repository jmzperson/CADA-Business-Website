import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/session";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.message, err.status);
  }
  console.error(err);
  return jsonError("Internal server error", 500);
}

export const BRAND_CATEGORIES = [
  { value: "gym", label: "Gym & Fitness" },
  { value: "food", label: "Food & Beverage" },
  { value: "wellness", label: "Wellness & Spa" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
] as const;

export type BrandCategory = (typeof BRAND_CATEGORIES)[number]["value"];
