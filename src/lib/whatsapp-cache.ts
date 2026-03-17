// In-memory cache for WhatsApp bot to reduce database queries

interface CachedUser {
  id: string;
  phone: string;
  ntzsUserId: string | null;
  username: string;
  timestamp: number;
}

// Cache user data for 5 minutes
const USER_CACHE_TTL = 5 * 60 * 1000;
const userCache = new Map<string, CachedUser>();

// Cache balance for 30 seconds
const BALANCE_CACHE_TTL = 30 * 1000;
const balanceCache = new Map<string, { balance: number; timestamp: number }>();

export function getCachedUser(phone: string): CachedUser | null {
  const cached = userCache.get(phone);
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() - cached.timestamp > USER_CACHE_TTL) {
    userCache.delete(phone);
    return null;
  }
  
  return cached;
}

export function setCachedUser(phone: string, user: Omit<CachedUser, 'timestamp'>): void {
  userCache.set(phone, {
    ...user,
    timestamp: Date.now(),
  });
}

export function invalidateUserCache(phone: string): void {
  userCache.delete(phone);
  balanceCache.delete(phone);
}

export function getCachedBalance(phone: string): number | null {
  const cached = balanceCache.get(phone);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > BALANCE_CACHE_TTL) {
    balanceCache.delete(phone);
    return null;
  }
  
  return cached.balance;
}

export function setCachedBalance(phone: string, balance: number): void {
  balanceCache.set(phone, {
    balance,
    timestamp: Date.now(),
  });
}

export function invalidateBalanceCache(phone: string): void {
  balanceCache.delete(phone);
}
