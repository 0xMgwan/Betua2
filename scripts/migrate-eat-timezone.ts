/**
 * Migration script to fix existing market resolution times
 * 
 * Before the EAT timezone fix, markets were created with times that were
 * interpreted as local time but stored as if they were UTC. This caused
 * a 3-hour discrepancy for EAT (GMT+3) users.
 * 
 * This script adds 3 hours to all existing market resolvesAt times to
 * correct them to proper EAT timezone.
 * 
 * Usage: npx tsx scripts/migrate-eat-timezone.ts
 */

import { prisma } from '../src/lib/prisma';

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

async function migrateMarketTimezones() {
  console.log('🔄 Starting EAT timezone migration...\n');

  // Get all markets
  const markets = await prisma.market.findMany({
    select: {
      id: true,
      title: true,
      resolvesAt: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Found ${markets.length} markets to migrate\n`);

  let updated = 0;
  let skipped = 0;

  for (const market of markets) {
    const oldTime = new Date(market.resolvesAt);
    const newTime = new Date(oldTime.getTime() + EAT_OFFSET_MS);

    console.log(`\n📍 Market: ${market.title.substring(0, 50)}...`);
    console.log(`   Status: ${market.status}`);
    console.log(`   Old time (UTC): ${oldTime.toISOString()}`);
    console.log(`   New time (EAT): ${newTime.toISOString()}`);
    console.log(`   Old local: ${oldTime.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`);
    console.log(`   New local: ${newTime.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`);

    try {
      await prisma.market.update({
        where: { id: market.id },
        data: { resolvesAt: newTime },
      });
      console.log(`   ✅ Updated`);
      updated++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error}`);
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✨ Migration complete!`);
  console.log(`   Updated: ${updated} markets`);
  console.log(`   Skipped: ${skipped} markets`);
  console.log(`   Total: ${markets.length} markets\n`);
}

migrateMarketTimezones()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
