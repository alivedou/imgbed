// In-memory lockout store for local dev; D1-backed for Cloudflare Pages production
if (!globalThis.__lockoutStore) {
  globalThis.__lockoutStore = new Map();
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

// Ensure the failed_attempts table exists in D1
async function ensureTable(db) {
  if (!db) return;
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS failed_attempts (
      identifier TEXT PRIMARY KEY,
      count INTEGER DEFAULT 1,
      first_failed_at TEXT,
      locked_until TEXT
    )`).run();
  } catch (_) {}
}

// Check if an IP or a username is locked out
export async function getLockoutStatus(username, clientIp, db) {
  const now = Date.now();

  const keys = [];
  if (username) {
    keys.push({ type: 'user', key: `lockout:user:${username.trim().toLowerCase()}` });
  }
  if (clientIp && clientIp !== 'IP not found' && clientIp !== 'unknown') {
    keys.push({ type: 'ip', key: `lockout:ip:${clientIp}` });
  }

  // D1-backed check (Cloudflare Pages production)
  if (db) {
    await ensureTable(db);
    for (const { type, key } of keys) {
      const row = await db.prepare('SELECT count, locked_until FROM failed_attempts WHERE identifier = ?').bind(key).first();
      if (row && row.count >= MAX_ATTEMPTS && row.locked_until) {
        const lockedUntil = new Date(row.locked_until).getTime();
        if (now < lockedUntil) {
          return {
            locked: true,
            remainingSeconds: Math.ceil((lockedUntil - now) / 1000),
            reason: type === 'ip' ? 'Your IP is temporarily locked due to too many failed login attempts.' : 'This account is temporarily locked due to too many failed login attempts.',
            type
          };
        }
      }
    }
    return { locked: false, remainingSeconds: 0 };
  }

  // In-memory fallback (local dev)
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
export async function recordFailedAttempt(username, clientIp, db) {
  const now = new Date().toISOString();

  const keys = [];
  if (username) {
    keys.push(`lockout:user:${username.trim().toLowerCase()}`);
  }
  if (clientIp && clientIp !== 'IP not found' && clientIp !== 'unknown') {
    keys.push(`lockout:ip:${clientIp}`);
  }

  // D1-backed recording
  if (db) {
    await ensureTable(db);
    const LOCKOUT_DURATION = 10 * 60 * 1000;
    for (const key of keys) {
      const existing = await db.prepare('SELECT count, first_failed_at FROM failed_attempts WHERE identifier = ?').bind(key).first();
      let count = 1;
      if (existing) {
        const elapsed = Date.now() - new Date(existing.first_failed_at).getTime();
        count = elapsed > LOCKOUT_DURATION ? 1 : existing.count + 1;
      }
      const lockedUntil = count >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION).toISOString() : null;
      await db.prepare('INSERT OR REPLACE INTO failed_attempts (identifier, count, first_failed_at, locked_until) VALUES (?, ?, ?, ?)')
        .bind(key, count, existing ? existing.first_failed_at : now, lockedUntil)
        .run();
    }
    return;
  }

  // In-memory fallback
  for (const key of keys) {
    const existing = globalThis.__lockoutStore.get(key);
    let count = 1;
    if (existing) {
      const elapsed = Date.now() - new Date(existing.lastFailedAt).getTime();
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
export async function resetAttempts(username, clientIp, db) {
  const keys = [];
  if (username) {
    keys.push(`lockout:user:${username.trim().toLowerCase()}`);
  }
  if (clientIp && clientIp !== 'IP not found' && clientIp !== 'unknown') {
    keys.push(`lockout:ip:${clientIp}`);
  }

  // D1-backed reset
  if (db) {
    for (const key of keys) {
      await db.prepare('DELETE FROM failed_attempts WHERE identifier = ?').bind(key).run();
    }
    return;
  }

  // In-memory fallback
  for (const key of keys) {
    globalThis.__lockoutStore.delete(key);
  }
}
