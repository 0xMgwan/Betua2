-- Per-option (per-team) image URLs, index-aligned with options
ALTER TABLE "Market" ADD COLUMN IF NOT EXISTS "optionImages" JSONB;
