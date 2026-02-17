-- CreateTable: state_assessments (reference table for state testing programs)
CREATE TABLE "state_assessments" (
    "id" SERIAL NOT NULL,
    "state_fips" VARCHAR(2) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subjects" VARCHAR(255) NOT NULL,
    "grades" VARCHAR(100) NOT NULL,
    "testing_window" VARCHAR(255) NOT NULL,
    "vendor" VARCHAR(150),
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "state_assessments_state_fips_idx" ON "state_assessments"("state_fips");

-- CreateIndex
CREATE UNIQUE INDEX "state_assessments_state_fips_name_key" ON "state_assessments"("state_fips", "name");

-- AddForeignKey
ALTER TABLE "state_assessments" ADD CONSTRAINT "state_assessments_state_fips_fkey" FOREIGN KEY ("state_fips") REFERENCES "states"("fips") ON DELETE RESTRICT ON UPDATE CASCADE;
