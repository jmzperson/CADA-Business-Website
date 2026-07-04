/** Client-safe QR scan helpers (no server / DB deps). */

export type RedeemErrorCode =
  | "invalid_token"
  | "expired"
  | "already_redeemed"
  | "wrong_brand"
  | "revoked"
  | "redemption_cap_reached"
  | "unauthorized";

const ERROR_MESSAGES: Record<RedeemErrorCode, string> = {
  invalid_token: "QR not recognized",
  expired: "This reward has expired",
  already_redeemed: "Already used",
  wrong_brand: "Not valid at this business",
  revoked: "This reward is no longer valid",
  redemption_cap_reached: "This offer has reached its redemption limit",
  unauthorized: "Sign in as brand staff to scan",
};

export function redeemErrorMessage(code: RedeemErrorCode): string {
  return ERROR_MESSAGES[code];
}

/** Extract raw token from scanned URL or pasted value. */
export function parseTokenFromScan(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const rIndex = parts.indexOf("r");
      if (rIndex >= 0 && parts[rIndex + 1]) {
        return parts[rIndex + 1];
      }
      return parts[parts.length - 1] ?? trimmed;
    }
  } catch {
    // not a URL — use as raw token
  }

  return trimmed;
}
