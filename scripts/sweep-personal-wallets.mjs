// Sweep leftover/legacy nTZS from users' personal wallets back into the platform
// (settlement pool) wallet. Real money only leaves users' personal wallets INTO
// the pool that already backs their DB balance — DB balances are NOT changed, so
// no user is harmed (their withdrawable balance is unaffected).
//
// SAFETY: dry-run by default. It only prints the plan. To actually move funds:
//   LIVE=1 node scripts/sweep-personal-wallets.mjs
//
// Excludes the platform/settlement-fee/creation-fee house wallets and admin
// accounts. TZS only — small USDC balances are reported for manual handling.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const LIVE = process.env.LIVE === '1';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const BASE = (process.env.NTZS_BASE_URL || process.env.NTZS_API_BASE_URL || 'https://www.ntzs.co.tz').replace(/^["']|["']$/g, '');
const KEY = (process.env.NTZS_API_KEY || '').replace(/^["']|["']$/g, '');
const PLATFORM = process.env.PLATFORM_NTZS_USER_ID;

if (!PLATFORM) { console.error('PLATFORM_NTZS_USER_ID not set — aborting.'); process.exit(1); }

const HOUSE = new Set([
  process.env.PLATFORM_NTZS_USER_ID,
  process.env.SETTLEMENT_FEE_NTZS_USER_ID,
  process.env.CREATION_FEE_NTZS_USER_ID,
].filter(Boolean));
const ADMIN_IDS = new Set([
  'cmmjemfo900046e3pyoegxsni',
  '2e7ea0a6-472c-44b9-8a61-b6e2865fe558',
  'c458cdc9-db89-408e-a077-dacb72af789d',
  ...(process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean),
]);

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body = {}; try { body = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 120)}`);
  return body;
}
const getBalance = async (id) => { const u = await api(`/users/${id}`); return { tzs: Number(u.balanceTzs || 0), usdc: Number(u.balanceUsdc || 0) }; };
const transfer = (fromUserId, amountTzs) => api('/transfers', { method: 'POST', body: JSON.stringify({ fromUserId, toUserId: PLATFORM, amountTzs }) });

const legacy = (await prisma.user.findMany({
  where: { ntzsUserId: { not: null } },
  select: { id: true, username: true, ntzsUserId: true, balanceTzs: true },
})).filter(u => !HOUSE.has(u.ntzsUserId) && !ADMIN_IDS.has(u.id));

console.log(`\n${LIVE ? '🔴 LIVE' : '🟡 DRY-RUN'} — sweeping personal wallets → platform (${PLATFORM})`);
console.log(`Legacy user wallets to inspect: ${legacy.length}\n`);

let sweptTzs = 0, movedTzs = 0, usdcLeft = 0, ok = 0, skipped = 0, failed = 0;
const usdcUsers = [];

for (const u of legacy) {
  let bal;
  try { bal = await getBalance(u.ntzsUserId); }
  catch (e) { console.log(`  ✗ ${u.username}: balance read failed (${e.message})`); failed++; continue; }

  if (bal.usdc > 0) { usdcLeft += bal.usdc; usdcUsers.push(`${u.username}=${bal.usdc}`); }

  if (bal.tzs <= 0) { skipped++; continue; }
  sweptTzs += bal.tzs;

  if (!LIVE) {
    console.log(`  → ${u.username.padEnd(18)} would move ${bal.tzs.toLocaleString().padStart(9)} TZS  (db=${(u.balanceTzs || 0).toLocaleString()})`);
    continue;
  }
  try {
    await transfer(u.ntzsUserId, bal.tzs);
    movedTzs += bal.tzs;
    ok++;
    console.log(`  ✓ ${u.username.padEnd(18)} moved ${bal.tzs.toLocaleString().padStart(9)} TZS`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${u.username.padEnd(18)} transfer failed: ${e.message}`);
  }
}

console.log('\n=== SUMMARY ===');
console.log(`  ${LIVE ? 'moved' : 'would move'}: ${(LIVE ? movedTzs : sweptTzs).toLocaleString()} TZS across ${LIVE ? ok : (legacy.length - skipped - failed)} wallets`);
if (LIVE) console.log(`  succeeded: ${ok} | failed: ${failed} | skipped (empty): ${skipped}`);
if (usdcLeft > 0) console.log(`  USDC NOT swept (handle manually): ${usdcLeft.toFixed(2)} USDC → ${usdcUsers.join(', ')}`);
if (!LIVE) console.log('\n  Nothing moved. Re-run with LIVE=1 to execute.');

await prisma.$disconnect();
