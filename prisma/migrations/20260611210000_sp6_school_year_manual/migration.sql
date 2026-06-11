-- SP6 Addendum 2: track manual school-year entry (vs the selector)
ALTER TABLE "generated_documents" ADD COLUMN "school_year_manual" BOOLEAN NOT NULL DEFAULT false;
