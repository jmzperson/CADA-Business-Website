import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { verifyLeadsAdminToken } from "@/lib/leads/admin-auth";

export async function GET(request: Request) {
  try {
    if (!verifyLeadsAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const admin = createAdminClient();
    let query = admin
      .from("partnership_leads")
      .select("id, company_name, email, message, status, brand_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (status && ["new", "contacted", "signed_up"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

type PatchBody = {
  id?: string;
  status?: "new" | "contacted" | "signed_up";
};

export async function PATCH(request: Request) {
  try {
    if (!verifyLeadsAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const body = (await request.json()) as PatchBody;
    if (!body.id || !body.status) {
      return jsonError("id and status are required");
    }

    if (!["new", "contacted", "signed_up"].includes(body.status)) {
      return jsonError("Invalid status");
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partnership_leads")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select("id, company_name, email, message, status, brand_id, created_at, updated_at")
      .single();

    if (error || !data) return jsonError(error?.message || "Update failed", 500);

    return NextResponse.json({ lead: data });
  } catch (err) {
    return handleApiError(err);
  }
}
