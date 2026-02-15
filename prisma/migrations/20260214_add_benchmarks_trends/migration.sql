-- AlterTable
ALTER TABLE "district_data_history" ADD COLUMN     "chronic_absenteeism_rate" DECIMAL(5,2),
ADD COLUMN     "ell_students" INTEGER;

-- AlterTable
ALTER TABLE "districts" ADD COLUMN     "absenteeism_quartile_state" VARCHAR(15),
ADD COLUMN     "absenteeism_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "absenteeism_vs_national" DECIMAL(8,2),
ADD COLUMN     "absenteeism_vs_state" DECIMAL(8,2),
ADD COLUMN     "ell_pct" DECIMAL(5,2),
ADD COLUMN     "ell_pct_quartile_state" VARCHAR(15),
ADD COLUMN     "ell_pct_vs_national" DECIMAL(8,2),
ADD COLUMN     "ell_pct_vs_state" DECIMAL(8,2),
ADD COLUMN     "ell_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "expenditure_pp_quartile_state" VARCHAR(15),
ADD COLUMN     "expenditure_pp_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "expenditure_pp_vs_national" DECIMAL(8,2),
ADD COLUMN     "expenditure_pp_vs_state" DECIMAL(8,2),
ADD COLUMN     "graduation_quartile_state" VARCHAR(15),
ADD COLUMN     "graduation_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "graduation_vs_national" DECIMAL(8,2),
ADD COLUMN     "graduation_vs_state" DECIMAL(8,2),
ADD COLUMN     "math_proficiency_quartile_state" VARCHAR(15),
ADD COLUMN     "math_proficiency_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "math_proficiency_vs_national" DECIMAL(8,2),
ADD COLUMN     "math_proficiency_vs_state" DECIMAL(8,2),
ADD COLUMN     "read_proficiency_quartile_state" VARCHAR(15),
ADD COLUMN     "read_proficiency_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "read_proficiency_vs_national" DECIMAL(8,2),
ADD COLUMN     "read_proficiency_vs_state" DECIMAL(8,2),
ADD COLUMN     "student_teacher_ratio_quartile_state" VARCHAR(15),
ADD COLUMN     "student_teacher_ratio_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "student_teacher_ratio_vs_national" DECIMAL(8,2),
ADD COLUMN     "student_teacher_ratio_vs_state" DECIMAL(8,2),
ADD COLUMN     "swd_pct" DECIMAL(5,2),
ADD COLUMN     "swd_pct_quartile_state" VARCHAR(15),
ADD COLUMN     "swd_pct_vs_national" DECIMAL(8,2),
ADD COLUMN     "swd_pct_vs_state" DECIMAL(8,2),
ADD COLUMN     "swd_trend_3yr" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "states" ADD COLUMN     "avg_chronic_absenteeism_rate" DECIMAL(5,2),
ADD COLUMN     "avg_ell_pct" DECIMAL(5,2),
ADD COLUMN     "avg_enrollment" INTEGER,
ADD COLUMN     "avg_math_proficiency" DECIMAL(5,2),
ADD COLUMN     "avg_read_proficiency" DECIMAL(5,2),
ADD COLUMN     "avg_student_teacher_ratio" DECIMAL(8,2),
ADD COLUMN     "avg_swd_pct" DECIMAL(5,2);

-- Seed the US national row for national benchmark averages
INSERT INTO states (fips, abbrev, name, created_at, updated_at)
VALUES ('00', 'US', 'United States', NOW(), NOW())
ON CONFLICT (fips) DO NOTHING;
