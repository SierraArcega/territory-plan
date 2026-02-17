-- Add new sales signal columns to districts table
ALTER TABLE "districts" ADD COLUMN     "assessment_data_year" INTEGER,
ADD COLUMN     "capital_outlay_total" DECIMAL(15,2),
ADD COLUMN     "debt_outstanding" DECIMAL(15,2),
ADD COLUMN     "enrollment_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "esser_funding_total" DECIMAL(15,2),
ADD COLUMN     "esser_spending_instruction" DECIMAL(15,2),
ADD COLUMN     "esser_spending_total" DECIMAL(15,2),
ADD COLUMN     "math_proficiency_pct" DECIMAL(5,2),
ADD COLUMN     "payments_to_charter_schools" DECIMAL(15,2),
ADD COLUMN     "payments_to_private_schools" DECIMAL(15,2),
ADD COLUMN     "read_proficiency_pct" DECIMAL(5,2),
ADD COLUMN     "sped_expenditure_instruction" DECIMAL(15,2),
ADD COLUMN     "sped_expenditure_per_student" DECIMAL(12,2),
ADD COLUMN     "sped_expenditure_support" DECIMAL(15,2),
ADD COLUMN     "sped_expenditure_total" DECIMAL(15,2),
ADD COLUMN     "sped_student_teacher_ratio" DECIMAL(8,2),
ADD COLUMN     "staffing_trend_3yr" DECIMAL(8,2),
ADD COLUMN     "student_staff_ratio" DECIMAL(8,2),
ADD COLUMN     "student_teacher_ratio" DECIMAL(8,2),
ADD COLUMN     "tech_spending" DECIMAL(15,2),
ADD COLUMN     "vacancy_pressure_signal" DECIMAL(8,2);

-- CreateTable: district_data_history (historical time-series for trend analysis)
CREATE TABLE "district_data_history" (
    "id" SERIAL NOT NULL,
    "leaid" VARCHAR(7) NOT NULL,
    "year" INTEGER NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "enrollment" INTEGER,
    "teachers_fte" DECIMAL(10,2),
    "staff_total_fte" DECIMAL(10,2),
    "spec_ed_students" INTEGER,
    "total_revenue" DECIMAL(15,2),
    "total_expenditure" DECIMAL(15,2),
    "expenditure_pp" DECIMAL(12,2),
    "federal_revenue" DECIMAL(15,2),
    "state_revenue" DECIMAL(15,2),
    "local_revenue" DECIMAL(15,2),
    "sped_expenditure" DECIMAL(15,2),
    "poverty_pct" DECIMAL(5,2),
    "graduation_rate" DECIMAL(5,2),
    "math_proficiency" DECIMAL(5,2),
    "read_proficiency" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "district_data_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: district_grade_enrollment (enrollment by grade level)
CREATE TABLE "district_grade_enrollment" (
    "id" SERIAL NOT NULL,
    "leaid" VARCHAR(7) NOT NULL,
    "year" INTEGER NOT NULL,
    "grade" VARCHAR(10) NOT NULL,
    "enrollment" INTEGER,

    CONSTRAINT "district_grade_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "district_data_history_leaid_idx" ON "district_data_history"("leaid");
CREATE INDEX "district_data_history_year_idx" ON "district_data_history"("year");
CREATE INDEX "district_data_history_source_idx" ON "district_data_history"("source");
CREATE UNIQUE INDEX "district_data_history_leaid_year_source_key" ON "district_data_history"("leaid", "year", "source");

-- CreateIndex
CREATE INDEX "district_grade_enrollment_leaid_idx" ON "district_grade_enrollment"("leaid");
CREATE INDEX "district_grade_enrollment_year_idx" ON "district_grade_enrollment"("year");
CREATE UNIQUE INDEX "district_grade_enrollment_leaid_year_grade_key" ON "district_grade_enrollment"("leaid", "year", "grade");

-- CreateIndex (new district indexes for sales signal queries)
CREATE INDEX "districts_student_teacher_ratio_idx" ON "districts"("student_teacher_ratio");
CREATE INDEX "districts_vacancy_pressure_signal_idx" ON "districts"("vacancy_pressure_signal");

-- AddForeignKey
ALTER TABLE "district_data_history" ADD CONSTRAINT "district_data_history_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "district_grade_enrollment" ADD CONSTRAINT "district_grade_enrollment_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;
