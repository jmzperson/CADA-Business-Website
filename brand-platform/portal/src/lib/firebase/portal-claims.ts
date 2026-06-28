import { adminAuth } from "@/lib/firebase/admin";

export type PortalStaffClaims = {
  portalStaff: true;
  brandId: string;
  staffRole: "admin" | "scanner";
};

export async function setPortalStaffClaims(
  authUserId: string,
  claims: { brandId: string; staffRole: "admin" | "scanner" }
) {
  await adminAuth().setCustomUserClaims(authUserId, {
    portalStaff: true,
    brandId: claims.brandId,
    staffRole: claims.staffRole,
  } satisfies PortalStaffClaims);
}

export function hasPortalStaffClaims(
  claims: Record<string, unknown> | undefined
): claims is PortalStaffClaims {
  return claims?.portalStaff === true && typeof claims.brandId === "string";
}
