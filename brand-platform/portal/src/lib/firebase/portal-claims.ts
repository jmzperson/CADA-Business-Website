import { adminAuth } from "@/lib/firebase/admin";

export type PortalStaffClaims = {
  portalStaff: true;
  brandId: string;
  staffRole: "admin" | "scanner";
};

export type CadaAdminClaims = {
  cadaAdmin: true;
};

export async function setPortalStaffClaims(
  authUserId: string,
  claims: { brandId: string; staffRole: "admin" | "scanner" }
) {
  const user = await adminAuth().getUser(authUserId);
  const existing = user.customClaims ?? {};
  await adminAuth().setCustomUserClaims(authUserId, {
    ...existing,
    portalStaff: true,
    brandId: claims.brandId,
    staffRole: claims.staffRole,
  });
}

/** Grant or revoke platform admin (challenge approval queue, etc.). */
export async function setCadaAdminClaim(authUserId: string, enabled: boolean) {
  const user = await adminAuth().getUser(authUserId);
  const existing = { ...(user.customClaims ?? {}) };
  if (enabled) {
    existing.cadaAdmin = true;
  } else {
    delete existing.cadaAdmin;
  }
  await adminAuth().setCustomUserClaims(authUserId, existing);
}

export function hasPortalStaffClaims(
  claims: Record<string, unknown> | undefined
): claims is PortalStaffClaims {
  return claims?.portalStaff === true && typeof claims.brandId === "string";
}

export function hasCadaAdminClaim(
  claims: Record<string, unknown> | undefined
): claims is CadaAdminClaims {
  return claims?.cadaAdmin === true;
}
