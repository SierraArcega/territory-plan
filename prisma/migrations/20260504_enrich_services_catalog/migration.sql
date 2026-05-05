-- Enrich the services catalog with descriptive content sourced from
-- src/features/shared/components/views/resources/OurServiceModelPage.tsx.
-- Adds two enums, twelve new columns, and re-seeds all ten services
-- (introducing iTutor and aligning names with the customer-facing page).

-- CreateEnum (idempotent — Postgres has no CREATE TYPE IF NOT EXISTS for enums)
DO $$ BEGIN
  CREATE TYPE "instruction_type" AS ENUM ('core_credit_bearing', 'supplemental');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "teacher_of_record" AS ENUM ('required', 'optional');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "instruction_type" "instruction_type",
  ADD COLUMN IF NOT EXISTS "icon" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "delivery_types" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "challenge" TEXT,
  ADD COLUMN IF NOT EXISTS "solution" TEXT,
  ADD COLUMN IF NOT EXISTS "teacher_of_record" "teacher_of_record",
  ADD COLUMN IF NOT EXISTS "has_lms" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "has_exit_tickets" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "has_mini_lesson" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "has_swd_progress" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "gradebooks_included" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "gradebooks_note" TEXT;

-- Seed / upsert all ten services in customer-facing order (core first, then supplemental).
-- ON CONFLICT (slug) updates existing rows; renames Suspension Alternatives -> Suspension Alternative
-- and Resource Rooms -> Resource Room to match the page copy.
INSERT INTO "services" (
  "name", "slug", "color", "sort_order",
  "instruction_type", "icon", "delivery_types",
  "challenge", "solution",
  "teacher_of_record",
  "has_lms", "has_exit_tickets", "has_mini_lesson", "has_swd_progress",
  "gradebooks_included", "gradebooks_note"
) VALUES
  (
    'Homebound', 'homebound', '#6EA3BE', 1,
    'core_credit_bearing', 'House', ARRAY['1:1'],
    'Mental and physical health challenges, as well as long-term suspension, can prevent students from attending school in a traditional setting. As a result, students often fall behind and require personalized, student-centered instruction.',
    'Our educators collaborate directly with the teacher of record to deliver instruction fully aligned with the school''s curriculum, ensuring students stay on track. When needed, we also provide customized, state-standards-aligned curriculum to meet students at their current level. Our educator pool includes certified teachers experienced in supporting students with disabilities and other specialized needs.',
    'required',
    TRUE, TRUE, TRUE, TRUE,
    TRUE, NULL
  ),
  (
    'Whole Class Virtual Instruction', 'wcvi', '#8AA891', 2,
    'core_credit_bearing', 'Users', ARRAY['SG', 'WC'],
    'Staffing shortages can leave schools unable to offer certain courses or reliant on uncertified educators.',
    'Fullmind ensures every course is led by a certified educator through high-quality virtual instruction. We specialize in supporting hard-to-staff subject areas so schools can maintain full course offerings.',
    'optional',
    TRUE, TRUE, TRUE, TRUE,
    TRUE, NULL
  ),
  (
    'Credit Recovery', 'credit-recovery', '#D4A84B', 3,
    'core_credit_bearing', 'GraduationCap', ARRAY['1:1', 'SG', 'WC'],
    'Dropout rates and academic underperformance increase when students struggle with coursework, absenteeism, or behavioral challenges.',
    'Our flexible credit recovery program helps students earn missed credits and regain academic progress. Live, state-certified educators provide real-time instruction aligned with the school''s curriculum. We track attendance, participation, and progress, keeping schools informed every step of the way.',
    'required',
    TRUE, TRUE, TRUE, FALSE,
    TRUE, NULL
  ),
  (
    'Suspension Alternative', 'suspension-alt', '#F37167', 4,
    'core_credit_bearing', 'PauseCircle', ARRAY['WC', 'SG'],
    'Rising suspension rates disrupt learning, negatively impact academic progress, and raise concerns around students'' mental and emotional wellbeing.',
    'Our carefully selected educators partner with classroom teachers to ensure students remain on track academically during suspension periods. We also incorporate social-emotional learning supports to promote a smooth and successful transition back into the classroom.',
    'optional',
    TRUE, TRUE, TRUE, FALSE,
    TRUE, NULL
  ),
  (
    'Hybrid Staffing', 'hybrid-staffing', '#9B7EDE', 5,
    'core_credit_bearing', 'UsersRound', ARRAY['1:1', 'SG', 'WC'],
    'Staffing shortages can prevent schools from fully supporting specialized programs, including services for students with disabilities, resource rooms, and self-contained classrooms.',
    'Our hybrid educators collaborate closely with school leaders and in-person facilitators, integrating seamlessly into the school team. Together, we ensure students receive consistent, high-quality instruction and support.',
    'optional',
    FALSE, FALSE, FALSE, FALSE,
    FALSE, 'School''s platform'
  ),
  (
    'Tutoring', 'tutoring', '#403770', 6,
    'supplemental', 'BookOpen', ARRAY['1:1', 'SG', 'WC'],
    'Some students require additional support or acceleration beyond what classroom teachers can provide within the school day.',
    'We deliver high-dosage, K–12 tutoring through frequent, data-driven sessions led by certified educators. Programs are customized to each school''s goals and designed to accelerate student growth.',
    'optional',
    TRUE, TRUE, TRUE, FALSE,
    FALSE, NULL
  ),
  (
    'Resource Room', 'resource-rooms', '#7C6FA0', 7,
    'supplemental', 'Accessibility', ARRAY['1:1', 'SG', 'WC'],
    'Shortages of certified special-education teachers make it challenging for schools to meet IEP requirements and ensure FAPE compliance.',
    'Our educators design instruction aligned to each student''s unique IEP goals, providing required accommodations and targeted support. We share regular progress-monitoring updates to ensure transparency and alignment with school teams and families.',
    'optional',
    TRUE, TRUE, TRUE, TRUE,
    FALSE, NULL
  ),
  (
    'Test Prep', 'test-prep', '#5EADB0', 8,
    'supplemental', 'ClipboardCheck', ARRAY['1:1', 'SG', 'WC'],
    'Students may struggle on high-stakes assessments due to content gaps, limited familiarity with test structure, or testing anxiety.',
    'Our educators deliver data-driven instruction to close academic gaps, build confidence, and prepare students for success on high-stakes assessments.',
    'optional',
    TRUE, TRUE, TRUE, FALSE,
    FALSE, NULL
  ),
  (
    'Homework Help', 'homework-help', '#E8926B', 9,
    'supplemental', 'HelpCircle', ARRAY['1:1', 'SG', 'WC'],
    'Students may need additional guidance to complete assignments successfully or benefit from extra practice with a certified teacher.',
    'We provide virtual after-school homework support, where certified educators offer real-time assistance tailored to students'' immediate needs.',
    'optional',
    TRUE, TRUE, TRUE, FALSE,
    FALSE, NULL
  ),
  (
    'iTutor', 'itutor', '#C7A4E0', 10,
    'supplemental', 'Sparkles', ARRAY['1:1'],
    'Families often seek supplemental instruction to support students who need additional academic growth or enrichment.',
    'Our educators create fully customized instruction plans based on each student''s needs, helping them build skills, confidence, and measurable academic progress.',
    'optional',
    FALSE, FALSE, FALSE, FALSE,
    FALSE, NULL
  )
ON CONFLICT (slug) DO UPDATE SET
  name                 = EXCLUDED.name,
  color                = EXCLUDED.color,
  sort_order           = EXCLUDED.sort_order,
  instruction_type     = EXCLUDED.instruction_type,
  icon                 = EXCLUDED.icon,
  delivery_types       = EXCLUDED.delivery_types,
  challenge            = EXCLUDED.challenge,
  solution             = EXCLUDED.solution,
  teacher_of_record    = EXCLUDED.teacher_of_record,
  has_lms              = EXCLUDED.has_lms,
  has_exit_tickets     = EXCLUDED.has_exit_tickets,
  has_mini_lesson      = EXCLUDED.has_mini_lesson,
  has_swd_progress     = EXCLUDED.has_swd_progress,
  gradebooks_included  = EXCLUDED.gradebooks_included,
  gradebooks_note      = EXCLUDED.gradebooks_note;
