-- CreateTable
CREATE TABLE "vendor_financials" (
    "id" SERIAL NOT NULL,
    "leaid" VARCHAR(7) NOT NULL,
    "vendor" VARCHAR(20) NOT NULL,
    "fiscal_year" VARCHAR(4) NOT NULL,
    "open_pipeline" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "closed_won_bookings" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "invoicing" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "scheduled_revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "delivered_revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deferred_revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "delivered_take" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "scheduled_take" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "all_take" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_financials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_financials_leaid_vendor_fiscal_year_key" ON "vendor_financials"("leaid", "vendor", "fiscal_year");

-- CreateIndex
CREATE INDEX "vendor_financials_leaid_idx" ON "vendor_financials"("leaid");

-- CreateIndex
CREATE INDEX "vendor_financials_vendor_fiscal_year_idx" ON "vendor_financials"("vendor", "fiscal_year");

-- AddForeignKey
ALTER TABLE "vendor_financials" ADD CONSTRAINT "vendor_financials_leaid_fkey" FOREIGN KEY ("leaid") REFERENCES "districts"("leaid") ON DELETE RESTRICT ON UPDATE CASCADE;
