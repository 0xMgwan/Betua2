-- AlterTable: Add earningsTzs to Partner for accrued markup earnings (withdrawable).
-- Additive, non-breaking: existing rows default to 0.
ALTER TABLE "Partner" ADD COLUMN "earningsTzs" INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Partner"."earningsTzs" IS 'Accrued partner markup earnings in TZS (100% of the partner''s configured markup on their markets).';
