"use client";

import { useEffect, useRef, useState } from "react";
import { CompactShell } from "@/components/compact-shell";
import {
  postRedeemToken,
  RedeemErrorCard,
  RedeemProcessingCard,
  RedeemSuccessCard,
  type RedeemResponse,
} from "@/components/redeem-result";

type State = "processing" | "success" | "error";

export function RedeemLandingClient({ token }: { token: string }) {
  const [state, setState] = useState<State>("processing");
  const [result, setResult] = useState<RedeemResponse | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;

    postRedeemToken(token, "qr-url-landing")
      .then(({ ok, status, data }) => {
        if (status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(`/r/${token}`)}`;
          return;
        }
        setResult(data);
        setState(ok ? "success" : "error");
      })
      .catch(() => {
        setResult({ error: "invalid_token", message: "Network error. Try again." });
        setState("error");
      });
  }, [token]);

  function retry() {
    attempted.current = false;
    setState("processing");
    setResult(null);
    attempted.current = true;
    postRedeemToken(token, "qr-url-landing")
      .then(({ ok, status, data }) => {
        if (status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(`/r/${token}`)}`;
          return;
        }
        setResult(data);
        setState(ok ? "success" : "error");
      })
      .catch(() => {
        setResult({ error: "invalid_token", message: "Network error. Try again." });
        setState("error");
      });
  }

  return (
    <CompactShell pageTitle="Redeem" subtitle="Staff reward redemption">
        {state === "processing" && <RedeemProcessingCard />}

        {state === "success" && result && (
          <RedeemSuccessCard result={result} scanAnotherHref="/scan" />
        )}

        {state === "error" && result && (
          <RedeemErrorCard result={result} onRetry={retry} />
        )}
    </CompactShell>
  );
}
