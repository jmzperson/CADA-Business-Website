/** Client-safe brand category options (no server deps). */
export const BRAND_CATEGORIES = [
  { value: "gym", label: "Gym & Fitness" },
  { value: "food", label: "Food & Beverage" },
  { value: "wellness", label: "Wellness & Spa" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
] as const;

export type BrandCategory = (typeof BRAND_CATEGORIES)[number]["value"];
