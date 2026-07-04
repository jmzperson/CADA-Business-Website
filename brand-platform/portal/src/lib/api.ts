import { NextResponse } from "next/server";
import { AuthError } from "@/lib/errors";

export { BRAND_CATEGORIES, type BrandCategory } from "@/lib/brand-categories";

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

