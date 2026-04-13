-- Add eventId column to Comment table
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_eventId_fkey" 
  FOREIGN KEY ("eventId") REFERENCES "Event"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Make marketId optional since comments can be on events OR markets
ALTER TABLE "Comment" ALTER COLUMN "marketId" DROP NOT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS "Comment_eventId_idx" ON "Comment"("eventId");
