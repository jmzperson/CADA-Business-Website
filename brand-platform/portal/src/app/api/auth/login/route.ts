import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return jsonError("email and password are required");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return jsonError("Invalid email or password", 401);
    }

    const staff = await getStaffContext();

    if (!staff) {
      await supabase.auth.signOut();
      return jsonError(
        "No brand account found. Accept your staff invite or register a new brand.",
        403
      );
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        email_verified: Boolean(data.user.email_confirmed_at),
      },
      staff: {
        id: staff.staffId,
        brand_id: staff.brandId,
        role: staff.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
