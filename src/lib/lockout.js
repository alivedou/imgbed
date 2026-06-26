// In-memory lockout store to fully comply with Next.js Edge Runtime / Middleware constraints
if (!globalThis.__lockoutStore) {
  globalThis.__lockoutStore = new Map();
}

// Check if an IP or a username is locked out
export async function getLockoutStatus(username, clientIp) {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();

  const keys = [];
  if (username) {
    keys.push({ type: 'user', key: `lockout:user:${username.trim().toLowerCase()}` });
  }
  if (clientIp && clientIp !== 'IP not found' && clientIp !== 'unknown') {
    keys.push({ type: 'ip', key: `lockout:ip:${clientIp}` });
  }

  for (const { type, key } of keys) {
    const data = globalThis.__lockoutStore.get(key);
    if (data) {
      if (data.count >= MAX_ATTEMPTS) {
        const elapsed = now - new Date(data.lastFailedAt).getTime();
        if (elapsed < LOCKOUT_MS) {
          const remainingSeconds = Math.ceil((LOCKOUT_MS - elapsed) / 1000);
          return {
            locked: true,
            remainingSeconds,
            reason: type === 'ip' ? 'Your IP is temporarily locked due to too many failed login attempts.' : 'This account is temporarily locked due to too many failed login attempts.',
            type
          };
        }
      }
    }
  }

  return { locked: false, remainingSeconds: 0 };
}

// Record a failed attempt
export async function recordFailedAttempt(username, clientIp) {
  const now = new Date().toISOString();

  const keys = [];
  if (username) {
    keys.push(`lockout:user:${username.trim().toLowerCase()}`);
  }
  if (clientIp && clientIp !== 'IP not found' && clientIp !== 'unknown') {
    keys.push(`lockout:ip:${clientIp}`);
  }

  for (const key of keys) {
    const existing = globalThis.__lockoutStore.get(key);
    let count = 1;
    if (existing) {
      const elapsed = Date.now() - new Date(existing.lastFailedAt).getTime();
      // If the last failed attempt was more than 10 minutes ago, reset current count to 1
      if (elapsed > 10 * 60 * 1000) {
        count = 1;
      } else {
        count = existing.count + 1;
      }
    }
    globalThis.__lockoutStore.set(key, { count, lastFailedAt: now });
  }
}

// Reset attempts on successful login
export async function resetAttempts(username, clientIp) {
  const keys = [];
  if (username) {
    keys.push(`lockout:user:${username.trim().toLowerCase()}`);
  }
  if (clientIp && clientIp !== 'IP not found' && clientIp !== 'unknown') {
    keys.push(`lockout:ip:${clientIp}`);
  }

  for (const key of keys) {
    globalThis.__lockoutStore.delete(key);
  }
}
