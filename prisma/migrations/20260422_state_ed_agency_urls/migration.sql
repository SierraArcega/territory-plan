-- Add external-reference URL columns to states:
--   board_of_ed_url  -> State Board of Education homepage (governance body)
--   dept_of_ed_url   -> State Education Agency / Dept of Ed homepage (operational agency)
-- Populated via scripts/seed-state-ed-urls.ts.

ALTER TABLE "states" ADD COLUMN IF NOT EXISTS "board_of_ed_url" VARCHAR(500);
ALTER TABLE "states" ADD COLUMN IF NOT EXISTS "dept_of_ed_url"  VARCHAR(500);
