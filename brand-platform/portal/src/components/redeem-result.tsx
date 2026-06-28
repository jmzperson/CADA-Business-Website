import Link from "next/link";

export type RedeemResponse = {
  status?: string;
  message?: string;
  error?: string;
  challenge_title?: string;
  redeemed_at?: string;
};

export const REDEEM_ERROR_UI: Record<string, { title: string; detail: string }> = {
  invalid_token: {
    title: "QR not recognized",
    detail: "Ask the customer to refresh their reward screen.",
  },
  expired: {
    title: "Reward expired",
    detail: "This offer is past its validity window.",
  },
  already_redeemed: {
    title: "Already used",
    detail: "This reward was redeemed previously.",
  },
  wrong_brand: {
    title: "Wrong business",
    detail: "This QR is not valid at your location.",
  },
  revoked: {
    title: "No longer valid",
    detail: "Contact CADA support if this seems wrong.",
  },
  redemption_cap_reached: {
    title: "Offer limit reached",
    detail: "This challenge has hit its maximum redemptions.",
  },
  unauthorized: {
    title: "Not signed in",
    detail: "Sign in as brand staff to scan.",
  },
};

export async function postRedeemToken(
  token: string,
  scanSource: string
): Promise<{ ok: boolean; status: number; data: RedeemResponse }> {
  const res = await fetch("/api/redeem", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-scan-source": scanSource,
    },
    body: JSON.stringify({ token }),
  });
  const data = (await res.json()) as RedeemResponse;
  return { ok: res.ok && data.status === "redeemed", status: res.status, data };
}

export function RedeemProcessingCard() {
  return (
    <div className="card text-center">
      <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-teal-light shadow-card" />
      <p className="mt-4 font-display text-lg font-extrabold text-ink">Redeeming reward…</p>
      <p className="mt-1 text-sm font-medium text-ink-light">Please wait a moment.</p>
    </div>
  );
}

export function RedeemSuccessCard({
  result,
  onScanAnother,
  scanAnotherHref = "/scan",
}: {
  result: RedeemResponse;
  onScanAnother?: () => void;
  scanAnotherHref?: string;
}) {
  return (
    <div className="card border-teal/30 bg-teal-light/50 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal font-display text-2xl font-extrabold text-white shadow-btn-primary">
        ✓
      </div>
      <h1 className="mt-4 font-display text-xl font-extrabold text-teal-dark">
        {result.message ?? "Reward redeemed"}
      </h1>
      {result.challenge_title && (
        <p className="mt-2 text-sm font-medium text-ink">{result.challenge_title}</p>
      )}
      <p className="mt-1 text-xs font-medium text-ink-light">
        {result.redeemed_at
          ? new Date(result.redeemed_at).toLocaleString()
          : "Just now"}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {onScanAnother ? (
          <button type="button" className="btn-primary w-full" onClick={onScanAnother}>
            Scan another
          </button>
        ) : (
          <Link href={scanAnotherHref} className="btn-primary w-full">
            Scan another
          </Link>
        )}
        <Link href="/dashboard" className="btn-secondary w-full">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export function RedeemErrorCard({
  result,
  onRetry,
  retryHref,
}: {
  result: RedeemResponse;
  onRetry?: () => void;
  retryHref?: string;
}) {
  const errorKey = result.error ?? "invalid_token";
  const errorUi = REDEEM_ERROR_UI[errorKey] ?? {
    title: result.message ?? "Error",
    detail: "Something went wrong.",
  };

  return (
    <div className="card border-coral/30 bg-coral-light/60 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral font-display text-2xl font-extrabold text-white shadow-btn-primary">
        !
      </div>
      <h1 className="mt-4 font-display text-xl font-extrabold text-coral-dark">
        {errorUi.title}
      </h1>
      <p className="mt-2 text-sm font-medium text-ink">{result.message ?? errorUi.detail}</p>
      {result.error === "already_redeemed" && result.redeemed_at && (
        <p className="mt-1 text-xs font-medium text-ink-light">
          Redeemed {new Date(result.redeemed_at).toLocaleString()}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-2">
        {onRetry ? (
          <button type="button" className="btn-primary w-full" onClick={onRetry}>
            Try again
          </button>
        ) : retryHref ? (
          <Link href={retryHref} className="btn-primary w-full">
            Try again
          </Link>
        ) : null}
        <Link href="/dashboard" className="btn-secondary w-full">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
