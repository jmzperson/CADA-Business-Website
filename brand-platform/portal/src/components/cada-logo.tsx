import Image from "next/image";
import Link from "next/link";

const HEIGHTS = {
  sm: 32,
  md: 40,
  lg: 56,
} as const;

/** Source asset is ~1024×327 */
const LOGO_ASPECT = 1024 / 327;

export function CadaLogo({
  href = "/dashboard",
  subtitle,
  size = "md",
}: {
  href?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}) {
  const height = HEIGHTS[size];
  const width = Math.round(height * LOGO_ASPECT);

  return (
    <Link href={href} className="inline-flex flex-col items-center text-center leading-none">
      <Image
        src="/cada-logo.png"
        alt="CADA"
        width={width}
        height={height}
        className="block h-auto w-auto shrink-0"
        style={{ maxHeight: height }}
        priority={size === "lg"}
      />
      {subtitle && (
        <span className="mt-1 block text-center font-display text-[10px] font-extrabold uppercase text-ink-light">
          {subtitle}
        </span>
      )}
    </Link>
  );
}
