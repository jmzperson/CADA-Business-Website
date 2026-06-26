"use client";

import { HABIT_TYPES } from "@/lib/challenges";
import type { ChallengeFormValues } from "@/lib/challenge-form";

type Props = {
  values: ChallengeFormValues;
  onChange: (values: ChallengeFormValues) => void;
  disabled?: boolean;
  readOnlyFields?: Set<keyof ChallengeFormValues>;
};

export function ChallengeForm({ values, onChange, disabled, readOnlyFields }: Props) {
  function update<K extends keyof ChallengeFormValues>(key: K, value: ChallengeFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function fieldDisabled(key: keyof ChallengeFormValues) {
    return disabled || readOnlyFields?.has(key);
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="title">
          Challenge title
        </label>
        <input
          id="title"
          className="input"
          placeholder='e.g. "Knock out Gym at Studio Flow"'
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          disabled={fieldDisabled("title")}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          className="input min-h-[96px] resize-y"
          placeholder="Tell users what to do and what they earn..."
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          disabled={fieldDisabled("description")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="habit_type">
            Linked habit
          </label>
          <select
            id="habit_type"
            className="input"
            value={values.habit_type}
            onChange={(e) => update("habit_type", e.target.value)}
            disabled={fieldDisabled("habit_type")}
            required
          >
            {HABIT_TYPES.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label} — {h.appLabel}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            Users must complete this habit type in the CADA app.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="max_redemptions">
            Max redemptions <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="max_redemptions"
            type="number"
            min={1}
            className="input"
            placeholder="Unlimited"
            value={values.max_redemptions}
            onChange={(e) => update("max_redemptions", e.target.value)}
            disabled={fieldDisabled("max_redemptions")}
          />
        </div>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-subtle p-4">
        <h3 className="text-sm font-semibold text-ink">First-time offer</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Shown when users complete the challenge and redeem at your business.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="offer_headline">
              Offer headline
            </label>
            <input
              id="offer_headline"
              className="input"
              placeholder="e.g. First class free"
              value={values.offer_headline}
              onChange={(e) => update("offer_headline", e.target.value)}
              disabled={fieldDisabled("offer_headline")}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="offer_code">
              Promo code <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="offer_code"
              className="input"
              placeholder="e.g. CADA-FIRST"
              value={values.offer_code}
              onChange={(e) => update("offer_code", e.target.value)}
              disabled={fieldDisabled("offer_code")}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="starts_at">
            Start date
          </label>
          <input
            id="starts_at"
            type="datetime-local"
            className="input"
            value={values.starts_at}
            onChange={(e) => update("starts_at", e.target.value)}
            disabled={fieldDisabled("starts_at")}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ends_at">
            End date <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="ends_at"
            type="datetime-local"
            className="input"
            value={values.ends_at}
            onChange={(e) => update("ends_at", e.target.value)}
            disabled={fieldDisabled("ends_at")}
          />
        </div>
      </div>
    </div>
  );
}
