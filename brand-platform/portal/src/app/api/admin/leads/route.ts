import { NextResponse } from "next/server";
import { listLeads, updateLead } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { requireCadaAdminAccess } from "@/lib/admin/auth";
import { verifyLeadsAdminToken } from "@/lib/leads/admin-auth";
import type { LeadStatus } from "@/lib/db/types";

async function allowLeadsAdmin(request: Request) {
  const access = await requireCadaAdminAccess(request);
  if (access.ok) return { ok: true as const };
  if (verifyLeadsAdminToken(request)) return { ok: true as const };
  return { ok: false as const, status: access.status };
}

export async function GET(request: Request) {
  try {
    const access = await allowLeadsAdmin(request);
    if (!access.ok) {
      return jsonError(
        access.status === 403 ? "CADA admin access required" : "Unauthorized",
        access.status
      );
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
    const access = await allowLeadsAdmin(request);
    if (!access.ok) {
      return jsonError(
        access.status === 403 ? "CADA admin access required" : "Unauthorized",
        access.status
      );
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
