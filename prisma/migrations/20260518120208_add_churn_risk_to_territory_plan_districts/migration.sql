-- AlterTable
ALTER TABLE "territory_plan_districts" ADD COLUMN "churn_risk" VARCHAR(16);

-- Constrain allowed values at the DB layer
ALTER TABLE "territory_plan_districts"
  ADD CONSTRAINT "territory_plan_districts_churn_risk_check"
  CHECK ("churn_risk" IS NULL OR "churn_risk" IN ('low','medium','high','churned'));
