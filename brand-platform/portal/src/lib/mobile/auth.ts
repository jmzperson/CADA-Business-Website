import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { AuthError } from "@/lib/auth/session";

export async function getAppUserFromRequest(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function requireAppUser(request: Request): Promise<User> {
  const user = await getAppUserFromRequest(request);
  if (!user) {
    throw new AuthError("Unauthorized — valid Bearer token required", 401);
  }
  return user;
}
