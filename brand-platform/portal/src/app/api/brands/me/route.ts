import { NextResponse } from "next/server";
import {
  getBrandProfile,
  getSessionUser,
  getStaffContext,
  requireAdmin,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_CATEGORIES, handleApiError, jsonError } from "@/lib/api";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);

    const staff = await getStaffContext();
    if (!staff) return jsonError("No brand staff record found", 403);

    const brand = await getBrandProfile(staff.brandId);
    if (!brand) return jsonError("Brand not found", 404);

    return NextResponse.json({
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logo_url: brand.logo_url,
        category: brand.category,
        website: brand.website,
        offer_default_copy: brand.offer_default_copy,
        primary_address: brand.primary_address,
        status: brand.status,
      },
      staff: {
        id: staff.staffId,
        email: staff.email,
        role: staff.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

type PatchBody = {
  name?: string;
  website?: string;
  category?: string;
  logo_url?: string;
  offer_default_copy?: string;
  primary_address?: string;
};

export async function PATCH(request: Request) {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    requireAdmin(staff);

    const body = (await request.json()) as PatchBody;
    const updates: Record<string, string | null> = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return jsonError("name cannot be empty");
      updates.name = name;
    }
    if (body.website !== undefined) updates.website = body.website.trim() || null;
    if (body.logo_url !== undefined) updates.logo_url = body.logo_url.trim() || null;
    if (body.offer_default_copy !== undefined) {
      updates.offer_default_copy = body.offer_default_copy.trim() || null;
    }
    if (body.primary_address !== undefined) {
      updates.primary_address = body.primary_address.trim() || null;
    }
    if (body.category !== undefined) {
      if (!BRAND_CATEGORIES.some((c) => c.value === body.category)) {
        return jsonError("Invalid category");
      }
      updates.category = body.category;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError("No valid fields to update");
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("brands")
      .update(updates)
      .eq("id", staff.brandId)
      .select("*")
      .single();

    if (error || !data) return jsonError(error?.message || "Update failed", 500);

    return NextResponse.json({
      brand: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        logo_url: data.logo_url,
        category: data.category,
        website: data.website,
        offer_default_copy: data.offer_default_copy,
        primary_address: data.primary_address,
        status: data.status,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
