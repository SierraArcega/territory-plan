-- Track per-district vacancy scan health for cron-side filtering.
-- - vacancy_consecutive_failures resets to 0 on every successful scan,
--   increments on every failed scan.
-- - vacancy_last_failure_at is the timestamp of the most recent failure
--   (NULL if never failed or last result was success).
-- The scan-vacancies cron skips districts with consecutive_failures >= 5.

ALTER TABLE districts
  ADD COLUMN vacancy_consecutive_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN vacancy_last_failure_at TIMESTAMP(3) NULL;

CREATE INDEX districts_vacancy_consecutive_failures_idx
  ON districts (vacancy_consecutive_failures);
