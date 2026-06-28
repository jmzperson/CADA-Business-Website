import { NextResponse } from "next/server";
import { listLeads, updateLead } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { verifyLeadsAdminToken } from "@/lib/leads/admin-auth";
import type { LeadStatus } from "@/lib/db/types";

export async function GET(request: Request) {
  try {
    if (!verifyLeadsAdminToken(request)) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const leads = await listLeads(
      status && ["new", "contacted", "signed_up"].includes(status)
        ? (status as LeadStatus)
        : undefined,
      200
    );

    return NextResponse.json({ leads });
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

    const data = await updateLead(body.id, { status: body.status });
    if (!data) return jsonError("Update failed", 500);

    return NextResponse.json({ lead: data });
  } catch (err) {
    return handleApiError(err);
  }
}
