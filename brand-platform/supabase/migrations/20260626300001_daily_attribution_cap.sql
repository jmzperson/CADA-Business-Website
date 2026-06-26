-- Phase 4: one brand-attributed completion per enrollment per UTC day
CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_completion_daily_per_enrollment
  ON habit_completion_events (
    enrollment_id,
    ((completed_at AT TIME ZONE 'UTC')::date)
  )
  WHERE enrollment_id IS NOT NULL;

COMMENT ON INDEX idx_habit_completion_daily_per_enrollment IS
  'At most one attributed habit completion per enrollment per UTC calendar day.';
