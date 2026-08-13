import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { parseAdminEmails, requireCadaAdminAccess } from "@/lib/admin/auth";
import { grantCadaAdmin, revokeCadaAdmin } from "@/lib/admin/grant";
import { listCadaAdmins } from "@/lib/db/admins";

function serializeAdmin(row: {
  email: string;
  auth_user_id: string | null;
  granted_by: string | null;
  granted_at: string | null;
  disabled: boolean;
  source: "roster" | "env";
}) {
  return {
    email: row.email,
    auth_user_id: row.auth_user_id,
    granted_by: row.granted_by,
    granted_at: row.granted_at,
    disabled: row.disabled,
    source: row.source,
    status: row.disabled ? "revoked" : "active",
  };
}

export async function GET(request: Request) {
  try {
    const access = await requireCadaAdminAccess(request);
    if (!access.ok) {
      return jsonError(
        access.status === 403 ? "CADA admin access required" : "Unauthorized",
        access.status
      );
    }

    const roster = await listCadaAdmins();
    const seen = new Set(roster.map((row) => row.email));
    const admins = roster.map((row) =>
      serializeAdmin({
        email: row.email,
        auth_user_id: row.auth_user_id,
        granted_by: row.granted_by,
        granted_at: row.granted_at,
        disabled: row.disabled,
        source: "roster",
      })
    );

    for (const email of parseAdminEmails()) {
      if (seen.has(email)) continue;
      admins.push(
        serializeAdmin({
          email,
          auth_user_id: null,
          granted_by: "CADA_ADMIN_EMAILS",
          granted_at: null,
          disabled: false,
          source: "env",
        })
      );
    }

    admins.sort((a, b) => a.email.localeCompare(b.email));
    return NextResponse.json({ admins });
  } catch (err) {
    return handleApiError(err);
  }
}

type Body = { email?: string };

export async function POST(request: Request) {
  try {
    const access = await requireCadaAdminAccess(request);
    if (!access.ok) {
      return jsonError(
        access.status === 403 ? "CADA admin access required" : "Unauthorized",
        access.status
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return jsonError("email is required");
    }

    const result = await grantCadaAdmin({
      email,
      grantedBy: access.admin.email,
    });

    return NextResponse.json(
      {
        admin: {
          email: result.email,
          auth_user_id: result.auth_user_id,
          created_user: result.created_user,
          email_sent: result.email_sent,
          email_error: result.email_error,
          status: "active",
        },
        message: result.created_user
          ? "Admin added. They’ll get an email to set a password and sign in."
          : "Admin added. They can sign in at /login and will land on the review queue.",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await requireCadaAdminAccess(request);
    if (!access.ok) {
      return jsonError(
        access.status === 403 ? "CADA admin access required" : "Unauthorized",
        access.status
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return jsonError("email is required");
    }

    try {
      const result = await revokeCadaAdmin({
        email,
        actorEmail: access.admin.email,
      });
      return NextResponse.json({
        admin: { email: result.email, status: "revoked" },
        message: "Admin access revoked.",
      });
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
      if (status) {
        return jsonError(err instanceof Error ? err.message : "Revoke failed", status);
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
