-- AlterTable: Add amountUsdc column to Transaction table
-- This migration safely adds USDC support without data loss
ALTER TABLE "Transaction" ADD COLUMN "amountUsdc" INTEGER NOT NULL DEFAULT 0;

-- Add comment explaining the field
COMMENT ON COLUMN "Transaction"."amountUsdc" IS 'Amount in micro-USDC (6 decimals, so 1 USDC = 1,000,000 micro-USDC)';
