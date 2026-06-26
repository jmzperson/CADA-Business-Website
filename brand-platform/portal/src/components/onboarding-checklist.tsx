"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OnboardingState } from "@/lib/onboarding";

export function OnboardingChecklist({ welcome }: { welcome?: boolean }) {
  const [state, setState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    fetch("/api/brands/onboarding")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState(null));
  }, []);

  if (!state || state.complete) return null;

  const nextStep = state.steps.find((s) => !s.done);

  return (
    <div className="card border-teal/25 bg-teal-light/30">
      {welcome && (
        <p className="mb-3 font-display text-sm font-extrabold text-teal-dark">
          Welcome to CADA Partners! Complete these steps to go live.
        </p>
      )}
      <h2 className="font-display text-lg font-extrabold text-ink">Getting started</h2>
      <ol className="mt-4 space-y-3">
        {state.steps.map((step, i) => (
          <li key={step.id} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-extrabold shadow-btn-primary ${
                step.done
                  ? "bg-teal text-white"
                  : "border-2 border-border bg-white text-ink-light"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <div className="flex-1 pt-0.5">
              {step.done ? (
                <span className="font-medium text-ink-light line-through">{step.label}</span>
              ) : (
                <Link
                  href={step.href}
                  className="font-display font-extrabold text-teal hover:underline"
                >
                  {step.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
      {nextStep && (
        <Link href={nextStep.href} className="btn-primary mt-5 inline-block">
          {nextStep.id === "challenge" ? "Create your first challenge" : "Continue setup"}
        </Link>
      )}
    </div>
  );
}

export function EmptyMetricsState({
  hasChallenges,
  hasPublished,
}: {
  hasChallenges: boolean;
  hasPublished?: boolean;
}) {
  if (hasPublished) return null;

  return (
    <div className="card mt-8 border-dashed border-teal/30 bg-white/80 text-center">
      <span className="sym sym-lg text-teal">insights</span>
      <h2 className="mt-2 font-display text-lg font-extrabold text-ink">No metrics yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-ink-light">
        {hasChallenges
          ? "Submit your challenge for CADA approval. Metrics will appear after it's live and users enroll."
          : "Metrics appear after CADA approves a challenge and users start enrolling."}
      </p>
      <Link
        href={hasChallenges ? "/dashboard/challenges" : "/dashboard/challenges/new"}
        className="btn-primary mt-5 inline-block"
      >
        {hasChallenges ? "Manage challenges" : "Create your first challenge"}
      </Link>
    </div>
  );
}
