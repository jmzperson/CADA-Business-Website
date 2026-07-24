"use client";

import {
  CHALLENGE_DURATIONS,
  CUSTOM_HABIT_VALUE,
  HABIT_CATEGORIES,
  JOIN_WINDOW_OPTIONS,
  type ChallengeDurationDays,
  type JoinWindowDays,
} from "@/lib/challenge-constants";
import { withSyncedDuration, type ChallengeFormValues } from "@/lib/challenge-form";

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

  const isCustom = values.habit_type === CUSTOM_HABIT_VALUE;

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
            onChange={(e) => {
              const next = e.target.value;
              onChange({
                ...values,
                habit_type: next,
                habit_custom_label:
                  next === CUSTOM_HABIT_VALUE ? values.habit_custom_label : "",
              });
            }}
            disabled={fieldDisabled("habit_type")}
            required
          >
            {HABIT_CATEGORIES.map((category) => (
              <optgroup key={category.id} label={category.label}>
                {category.habits.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={CUSTOM_HABIT_VALUE}>Custom — type your own</option>
          </select>
          {isCustom && (
            <div className="mt-3">
              <label className="label" htmlFor="habit_custom_label">
                Custom habit name
              </label>
              <input
                id="habit_custom_label"
                className="input"
                placeholder="e.g. Morning yoga"
                value={values.habit_custom_label}
                onChange={(e) => update("habit_custom_label", e.target.value)}
                disabled={fieldDisabled("habit_custom_label")}
                required
                maxLength={80}
              />
            </div>
          )}
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
            onChange={(e) =>
              onChange(withSyncedDuration(values, { starts_at: e.target.value }))
            }
            disabled={fieldDisabled("starts_at")}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="duration_days">
            Time period
          </label>
          <select
            id="duration_days"
            className="input"
            value={values.duration_days}
            onChange={(e) =>
              onChange(
                withSyncedDuration(values, {
                  duration_days: Number(e.target.value) as ChallengeDurationDays,
                })
              )
            }
            disabled={fieldDisabled("duration_days") || fieldDisabled("ends_at")}
            required
          >
            {CHALLENGE_DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            Challenge ends{" "}
            {values.ends_at
              ? new Date(values.ends_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
          </p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="join_window_days">
          Time to join
        </label>
        <select
          id="join_window_days"
          className="input max-w-xs"
          value={values.join_window_days}
          onChange={(e) =>
            update("join_window_days", Number(e.target.value) as JoinWindowDays)
          }
          disabled={fieldDisabled("join_window_days")}
          required
        >
          {JOIN_WINDOW_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-muted">
          How long after the start date new users can enroll in this challenge.
        </p>
      </div>
    </div>
  );
}
