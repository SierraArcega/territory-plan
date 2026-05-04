-- CreateEnum
CREATE TYPE "vacancy_failure_reason" AS ENUM ('http_4xx', 'http_5xx', 'network_timeout', 'scan_timeout', 'parser_empty', 'claude_fallback_failed', 'statewide_unattributable', 'enrollment_ratio_skip', 'no_job_board_url', 'unknown_error');

-- AlterTable
ALTER TABLE "vacancy_scans" ADD COLUMN "failure_reason" "vacancy_failure_reason";
