export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = slugify(base) || "brand";
  let suffix = 0;

  while (await exists(suffix === 0 ? slug : `${slug}-${suffix}`)) {
    suffix += 1;
  }

  return suffix === 0 ? slug : `${slug}-${suffix}`;
}

export function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}
