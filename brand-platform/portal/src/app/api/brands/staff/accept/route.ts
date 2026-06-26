import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, jsonError } from "@/lib/api";

type AcceptBody = {
  token?: string;
  password?: string;
  name?: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) return jsonError("token is required");

    const admin = createAdminClient();
    const { data: invite } = await admin
      .from("brand_staff")
      .select("id, email, role, brand_id, invite_expires_at, accepted_at, brands(name)")
      .eq("invite_token", token)
      .maybeSingle();

    if (!invite) return jsonError("Invalid invite", 404);
    if (invite.accepted_at) return jsonError("Invite already accepted", 409);
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      return jsonError("Invite has expired", 410);
    }

    const brandName =
      invite.brands && typeof invite.brands === "object" && "name" in invite.brands
        ? (invite.brands as { name: string }).name
        : "Brand";

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      brand_name: brandName,
      expires_at: invite.invite_expires_at,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AcceptBody;
    const token = body.token?.trim();
    const password = body.password;

    if (!token || !password) {
      return jsonError("token and password are required");
    }

    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters");
    }

    const admin = createAdminClient();
    const { data: invite } = await admin
      .from("brand_staff")
      .select("id, email, role, brand_id, invite_expires_at, accepted_at")
      .eq("invite_token", token)
      .maybeSingle();

    if (!invite) return jsonError("Invalid invite", 404);
    if (invite.accepted_at) return jsonError("Invite already accepted", 409);
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      return jsonError("Invite has expired", 410);
    }

    const email = invite.email;
    let userId: string;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const alreadyRegistered =
        createError.message.toLowerCase().includes("already") ||
        createError.message.toLowerCase().includes("registered");

      if (!alreadyRegistered) {
        return jsonError(createError.message, 500);
      }

      const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existingUser = listed?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existingUser) {
        return jsonError("Account exists but could not be linked. Contact support.", 500);
      }

      userId = existingUser.id;
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
      if (updateError) return jsonError(updateError.message, 500);
    } else {
      if (!created.user) return jsonError("Failed to create account", 500);
      userId = created.user.id;
    }

    const { error: updateError } = await admin
      .from("brand_staff")
      .update({
        auth_user_id: userId,
        accepted_at: new Date().toISOString(),
        invite_token: null,
        invite_expires_at: null,
      })
      .eq("id", invite.id);

    if (updateError) return jsonError(updateError.message, 500);

    const supabase = await createClient();
    await supabase.auth.signInWithPassword({ email, password });

    return NextResponse.json({
      message: "Invite accepted. Welcome to the team.",
      staff: {
        id: invite.id,
        brand_id: invite.brand_id,
        role: invite.role,
        email,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
