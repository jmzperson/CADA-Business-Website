/** CADA internal admin token (challenge approval, etc.) */
export function verifyCadaAdminToken(request: Request): boolean {
  const expected = process.env.CADA_ADMIN_TOKEN;
  if (!expected) return false;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7) === expected) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get("token") === expected;
}
