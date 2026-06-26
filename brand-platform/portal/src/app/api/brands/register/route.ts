import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BRAND_CATEGORIES, handleApiError, jsonError } from "@/lib/api";
import { uniqueSlug } from "@/lib/utils";
import { markLeadSignedUp } from "@/lib/leads/mark-signed-up";

type RegisterBody = {
  business_name?: string;
  email?: string;
  password?: string;
  website?: string;
  category?: string;
  logo_url?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody;
    const businessName = body.business_name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const website = body.website?.trim() || null;
    const category = body.category || "other";
    const logoUrl = body.logo_url?.trim() || null;

    if (!businessName || !email || !password) {
      return jsonError("business_name, email, and password are required");
    }

    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters");
    }

    if (!BRAND_CATEGORIES.some((c) => c.value === category)) {
      return jsonError("Invalid category");
    }

    const admin = createAdminClient();
    const slug = await uniqueSlug(businessName, async (candidate) => {
      const { data } = await admin.from("brands").select("id").eq("slug", candidate).maybeSingle();
      return Boolean(data);
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { business_name: businessName },
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes("already")) {
        return jsonError("An account with this email already exists", 409);
      }
      return jsonError(authError?.message || "Failed to create account", 400);
    }

    const userId = authData.user.id;

    const { data: brand, error: brandError } = await admin
      .from("brands")
      .insert({
        name: businessName,
        slug,
        category,
        website,
        logo_url: logoUrl,
        status: "active",
      })
      .select("id, name, slug, status")
      .single();

    if (brandError || !brand) {
      await admin.auth.admin.deleteUser(userId);
      return jsonError(brandError?.message || "Failed to create brand", 500);
    }

    const { error: staffError } = await admin.from("brand_staff").insert({
      brand_id: brand.id,
      email,
      role: "admin",
      auth_user_id: userId,
      accepted_at: new Date().toISOString(),
    });

    if (staffError) {
      await admin.from("brands").delete().eq("id", brand.id);
      await admin.auth.admin.deleteUser(userId);
      return jsonError(staffError.message, 500);
    }

    await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { redirectTo: `${appUrl}/verify-email` },
    });

    const supabase = await createClient();
    await supabase.auth.signInWithPassword({ email, password });

    await markLeadSignedUp(admin, email, brand.id);

    const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === "true";

    return NextResponse.json(
      {
        brand: {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          status: brand.status,
        },
        message: skipVerification
          ? "Account created."
          : "Account created. Please verify your email before using the dashboard.",
        email_verification_required: !skipVerification,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
