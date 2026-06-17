-- CreateTable: PartnerEarning ledger (markup earnings + payouts per partner)
CREATE TABLE "PartnerEarning" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountTzs" INTEGER NOT NULL DEFAULT 0,
    "marketId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerEarning_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerEarning_partnerId_createdAt_idx" ON "PartnerEarning"("partnerId", "createdAt");
