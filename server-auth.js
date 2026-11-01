import express from 'express';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { mkdir, readFile, chmod } from 'node:fs/promises';
import path from 'node:path';

const scrypt = promisify(scryptCallback);
const sessionCookieName = 'gh_session';
const sessionLifetimeSeconds = 7 * 24 * 60 * 60;
const passwordBytes = 64;
const saltBytes = 16;
const scryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const requestWindowMs = 15 * 60 * 1000;
const requestLimit = 10;
const supportedGames = new Set([
  'pixel-patrol',
  'neon-kart',
  'orbital-puzzles',
  'skyline-showdown',
  'redemption-run'
]);

function getClientKey(request) {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function setSessionCookie(response, value, secure) {
  response.cookie(sessionCookieName, value, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionLifetimeSeconds * 1000
  });
}

function clearSessionCookie(response, secure) {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/'
  });
}

function getSessionToken(request) {
  const value = request.get('cookie') || '';
  const cookie = value.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  return cookie ? cookie.slice(sessionCookieName.length + 1) : '';
}

function publicUser(account) {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role || 'member',
    membershipPlan: account.membershipPlan || null
  };
}

function isSameOrigin(request, allowedOrigins) {
  const origin = request.get('origin');
  if (!origin) {
    const requestedWith = request.get('x-requested-with');
    return requestedWith === 'GamingHub';
  }
  try {
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

function checkJsonRequest(allowedOrigins) {
  return function (request, response, next) {
    if (!isSameOrigin(request, allowedOrigins)) {
      response.status(403).json({ error: 'This request is not allowed.' });
      return;
    }
    if (!request.is('application/json')) {
      response.status(415).json({ error: 'Send account details as JSON.' });
      return;
    }
    next();
  };
}

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeAccount(account) {
  if (!account || typeof account !== 'object' ||
      typeof account.id !== 'string' ||
      typeof account.email !== 'string' ||
      typeof account.displayName !== 'string' ||
      typeof account.passwordSalt !== 'string' ||
      typeof account.passwordHash !== 'string') {
    throw new Error('The server account store contains an invalid record.');
  }
  if (account.role !== undefined && !['member', 'owner'].includes(account.role)) {
    throw new Error('The server account store contains an invalid role.');
  }
  account.role = account.role || 'member';
  return account;
}

export async function createAuthService(options) {
  const directory = options.dataDirectory;
  const cloudDatabase = options.cloudDatabase || null;
  const legacyStorePath = path.join(directory, 'accounts.json');
  const databasePath = path.join(directory, 'gaming-hub.sqlite');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);

  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'owner'))
    );
    CREATE TABLE IF NOT EXISTS game_progress (
      user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      game_key TEXT NOT NULL CHECK (game_key IN (
        'pixel-patrol', 'neon-kart', 'orbital-puzzles', 'skyline-showdown', 'redemption-run'
      )),
      best_score INTEGER NOT NULL CHECK (best_score BETWEEN 0 AND 10000000),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, game_key)
    );
  `);
  const accountColumns = database.prepare('PRAGMA table_info(accounts)').all();
  if (!accountColumns.some((column) => column.name === 'role')) {
    database.exec("ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'owner'))");
  }
  await chmod(databasePath, 0o600);

  const accountByEmail = database.prepare(`
    SELECT id, email, display_name, password_salt, password_hash, created_at, role
    FROM accounts WHERE email = ?
  `);
  function sqliteAccount(row) {
    return row && normalizeAccount({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      passwordSalt: row.password_salt,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
      role: row.role
    });
  }

  async function getAccountByEmail(email) {
    if (cloudDatabase) {
      const { data, error } = await cloudDatabase.from('gaming_hub_accounts')
        .select('id, email, display_name, password_salt, password_hash, created_at, role')
        .eq('email', email)
        .maybeSingle();
      if (error) throw error;
      return data ? cloudAccount(data) : null;
    }
    const row = accountByEmail.get(email);
    return sqliteAccount(row);
  }

  async function getAccountById(id) {
    const { data, error } = await cloudDatabase.from('gaming_hub_accounts')
      .select('id, email, display_name, password_salt, password_hash, created_at, role')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? cloudAccount(data) : null;
  }

  function cloudAccount(data) {
    return normalizeAccount({
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      passwordSalt: data.password_salt,
      passwordHash: data.password_hash,
      createdAt: data.created_at,
      role: data.role
    });
  }

  async function insertAccount(account) {
    if (cloudDatabase) {
      const { error } = await cloudDatabase.from('gaming_hub_accounts').insert({
        id: account.id,
        email: account.email,
        display_name: account.displayName,
        password_salt: account.passwordSalt,
        password_hash: account.passwordHash,
        created_at: account.createdAt,
        role: account.role || 'member'
      });
      if (error) throw error;
      return;
    }
    database.prepare(`
      INSERT INTO accounts (id, email, display_name, password_salt, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(account.id, account.email, account.displayName, account.passwordSalt, account.passwordHash, account.createdAt);
  }

  try {
    const stored = JSON.parse(await readFile(legacyStorePath, 'utf8'));
    if (stored.version !== 1 || !Array.isArray(stored.accounts)) {
      throw new Error('The server account store has an unsupported format.');
    }
    const insertLegacyAccount = database.prepare(`
      INSERT OR IGNORE INTO accounts (id, email, display_name, password_salt, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const account of stored.accounts.map(normalizeAccount)) {
      insertLegacyAccount.run(
        account.id,
        account.email,
        account.displayName,
        account.passwordSalt,
        account.passwordHash,
        account.createdAt || new Date().toISOString()
      );
    }
    await chmod(legacyStorePath, 0o600);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  database.prepare("UPDATE accounts SET role = 'owner' WHERE lower(email) = ?")
    .run('adamvalani72@gmail.com');

  if (cloudDatabase) {
    const { error: connectionError } = await cloudDatabase.from('gaming_hub_accounts').select('id').limit(1);
    if (connectionError) throw new Error(`Supabase account database is unavailable: ${connectionError.message}`);

    const localAccounts = database.prepare(`
      SELECT id, email, display_name, password_salt, password_hash, created_at, role FROM accounts
    `).all();
    if (localAccounts.length) {
      const { error } = await cloudDatabase.from('gaming_hub_accounts').upsert(localAccounts, {
        onConflict: 'email',
        ignoreDuplicates: true
      });
      if (error) throw new Error(`Could not migrate local accounts to Supabase: ${error.message}`);

      const { data: cloudAccounts, error: lookupError } = await cloudDatabase.from('gaming_hub_accounts')
        .select('id, email')
        .in('email', localAccounts.map((account) => account.email));
      if (lookupError) throw new Error(`Could not verify migrated accounts: ${lookupError.message}`);
      const cloudIdsByEmail = new Map(cloudAccounts.map((account) => [account.email, account.id]));
      const localProgress = database.prepare(`
        SELECT user_id, game_key, best_score FROM game_progress
      `).all();
      for (const progress of localProgress) {
        const localAccount = localAccounts.find((account) => account.id === progress.user_id);
        const cloudUserId = localAccount && cloudIdsByEmail.get(localAccount.email);
        if (!cloudUserId) continue;
        const { error: progressError } = await cloudDatabase.rpc('save_gaming_hub_game_progress', {
          p_user_id: cloudUserId,
          p_game_key: progress.game_key,
          p_score: progress.best_score
        });
        if (progressError) throw new Error(`Could not migrate local game progress: ${progressError.message}`);
      }
    }
  }

  const sessions = new Map();
  const requestTimes = new Map();
  const pendingEmails = new Set();
  const authRouter = express.Router();
  const allowedOrigins = new Set([
    options.allowedOrigin,
    ...(options.additionalAllowedOrigins || [])
  ].filter(Boolean));
  const requireSameOriginJson = checkJsonRequest(allowedOrigins);

  function rateLimit(request, response, email) {
    const now = Date.now();
    const keys = [`ip:${getClientKey(request)}`, `email:${email}`];
    let allowed = true;
    const recentByKey = new Map();

    for (const key of keys) {
      const recent = (requestTimes.get(key) || []).filter((time) => now - time < requestWindowMs);
      recentByKey.set(key, recent);
      if (recent.length >= requestLimit) allowed = false;
    }
    for (const [key, recent] of recentByKey) requestTimes.set(key, recent);
    if (!allowed) {
      response.set('Retry-After', String(Math.ceil(requestWindowMs / 1000)));
      response.status(429).json({ error: 'Too many account attempts. Please try again in 15 minutes.' });
      return false;
    }
    for (const [key, recent] of recentByKey) {
      recent.push(now);
      requestTimes.set(key, recent);
    }
    if (requestTimes.size > 5000) {
      for (const [key, recent] of requestTimes) {
        const active = recent.filter((time) => now - time < requestWindowMs);
        if (active.length) requestTimes.set(key, active);
        else requestTimes.delete(key);
      }
    }
    return true;
  }

  async function findSession(request) {
    const token = getSessionToken(request);
    if (!token) return null;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (cloudDatabase) {
      const { data, error } = await cloudDatabase.from('gaming_hub_sessions')
        .select('user_id')
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      return data ? { tokenHash, account: await getAccountById(data.user_id) } : null;
    }
    const session = sessions.get(tokenHash);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      sessions.delete(tokenHash);
      return null;
    }
    return { tokenHash, account: session.account };
  }

  async function requireApiAuth(request, response, next) {
    let session;
    try {
      session = await findSession(request);
    } catch (error) {
      console.error('API session lookup failed:', error.message);
      response.status(503).json({ error: 'Account sessions are temporarily unavailable.' });
      return;
    }
    if (!session?.account) {
      response.status(401).json({ error: 'Sign in to use this feature.' });
      return;
    }
    request.authUser = publicUser(session.account);
    next();
  }

  async function optionalApiAuth(request, response, next) {
    try {
      const session = await findSession(request);
      if (session?.account) request.authUser = publicUser(session.account);
      next();
    } catch (error) {
      console.error('Optional API session lookup failed:', error.message);
      response.status(503).json({ error: 'Account sessions are temporarily unavailable.' });
    }
  }

  async function requireOwner(request, response, next) {
    let session;
    try {
      session = await findSession(request);
    } catch (error) {
      console.error('Admin session lookup failed:', error.message);
      response.status(503).json({ error: 'Account sessions are temporarily unavailable.' });
      return;
    }
    if (!session?.account) {
      response.status(401).json({ error: 'Sign in with an owner account to manage Gaming Hub data.' });
      return;
    }
    const user = publicUser(session.account);
    if (user.role !== 'owner') {
      response.status(403).json({ error: 'Owner access is required to manage Gaming Hub data.' });
      return;
    }
    request.authUser = user;
    response.set('Cache-Control', 'no-store');
    next();
  }

  async function createSession(account, response) {
    const now = Date.now();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(now + sessionLifetimeSeconds * 1000).toISOString();
    if (cloudDatabase) {
      const { error: cleanupError } = await cloudDatabase.from('gaming_hub_sessions')
        .delete()
        .lt('expires_at', new Date(now).toISOString());
      if (cleanupError) throw cleanupError;
      const { error } = await cloudDatabase.from('gaming_hub_sessions').insert({
        token_hash: tokenHash,
        user_id: account.id,
        expires_at: expiresAt
      });
      if (error) throw error;
    } else {
      for (const [existingTokenHash, session] of sessions) {
        if (session.expiresAt <= now) sessions.delete(existingTokenHash);
      }
      sessions.set(tokenHash, { account, expiresAt: now + sessionLifetimeSeconds * 1000 });
    }
    setSessionCookie(response, token, options.secureCookies);
    response.set('Cache-Control', 'no-store');
    response.json({ user: publicUser(account) });
  }

  async function hashPassword(password, salt) {
    return scrypt(password, salt, passwordBytes, scryptOptions);
  }

  const dummySalt = randomBytes(saltBytes);
  const dummyHash = await hashPassword('dummy-password-not-used-for-login', dummySalt);

  authRouter.get('/session', async (request, response) => {
    try {
      const session = await findSession(request);
      response.set('Cache-Control', 'no-store');
      response.json({ user: session?.account ? publicUser(session.account) : null });
    } catch (error) {
      console.error('Session lookup failed:', error.message);
      response.status(503).json({ error: 'Account sessions are temporarily unavailable.' });
    }
  });

  authRouter.get('/progress', requireApiAuth, async (request, response) => {
    try {
      let progress;
      if (cloudDatabase) {
        const { data, error } = await cloudDatabase.from('gaming_hub_game_progress')
          .select('game_key, best_score, updated_at')
          .eq('user_id', request.authUser.id)
          .order('game_key');
        if (error) throw error;
        progress = data.map((item) => ({
          gameKey: item.game_key,
          bestScore: item.best_score,
          updatedAt: item.updated_at
        }));
      } else {
        progress = database.prepare(`
          SELECT game_key AS gameKey, best_score AS bestScore, updated_at AS updatedAt
          FROM game_progress WHERE user_id = ? ORDER BY game_key
        `).all(request.authUser.id);
      }
      response.set('Cache-Control', 'no-store');
      response.json({ progress });
    } catch (error) {
      console.error('Game progress lookup failed:', error.message);
      response.status(503).json({ error: 'Game progress is temporarily unavailable.' });
    }
  });

  authRouter.post('/progress', requireSameOriginJson, requireApiAuth, async (request, response) => {
    const gameKey = request.body?.gameKey;
    const score = request.body?.score;
    if (!supportedGames.has(gameKey) || !Number.isSafeInteger(score) || score < 0 || score > 10000000) {
      response.status(400).json({ error: 'Enter a valid game and score.' });
      return;
    }

    try {
      if (cloudDatabase) {
        const { data, error } = await cloudDatabase.rpc('save_gaming_hub_game_progress', {
          p_user_id: request.authUser.id,
          p_game_key: gameKey,
          p_score: score
        });
        if (error) throw error;
        const saved = Array.isArray(data) ? data[0] : data;
        response.set('Cache-Control', 'no-store');
        response.json({
          progress: { gameKey, bestScore: saved.best_score, updatedAt: saved.updated_at },
          personalBest: saved.personal_best
        });
        return;
      }

      const previous = database.prepare(`
        SELECT best_score AS bestScore, updated_at AS updatedAt
        FROM game_progress WHERE user_id = ? AND game_key = ?
      `).get(request.authUser.id, gameKey);
      const updatedAt = new Date().toISOString();
      database.prepare(`
        INSERT INTO game_progress (user_id, game_key, best_score, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (user_id, game_key) DO UPDATE SET
          best_score = max(game_progress.best_score, excluded.best_score),
          updated_at = CASE
            WHEN excluded.best_score > game_progress.best_score THEN excluded.updated_at
            ELSE game_progress.updated_at
          END
      `).run(request.authUser.id, gameKey, score, updatedAt);
      const bestScore = Math.max(previous?.bestScore || 0, score);
      response.set('Cache-Control', 'no-store');
      response.json({
        progress: { gameKey, bestScore, updatedAt: score > (previous?.bestScore ?? -1) ? updatedAt : previous.updatedAt },
        personalBest: score > (previous?.bestScore ?? -1)
      });
    } catch (error) {
      console.error('Game progress save failed:', error.message);
      response.status(503).json({ error: 'Game progress could not be saved. Please try again.' });
    }
  });

  authRouter.post('/register', requireSameOriginJson, async (request, response) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const displayName = typeof request.body?.displayName === 'string' ? request.body.displayName.trim() : '';
    const password = request.body?.password;
    if (!isValidEmail(email) || displayName.length < 1 || displayName.length > 80 ||
        typeof password !== 'string' || password.length < 8 || password.length > 128) {
      response.status(400).json({ error: 'Enter a valid email, a display name under 80 characters, and a password between 8 and 128 characters.' });
      return;
    }
    if (!rateLimit(request, response, email)) return;
    if (pendingEmails.has(email)) {
      response.status(400).json({ error: 'Unable to create an account with those details. Check them or try signing in.' });
      return;
    }

    pendingEmails.add(email);
    try {
      if (await getAccountByEmail(email)) {
        pendingEmails.delete(email);
        response.status(400).json({ error: 'Unable to create an account with those details. Check them or try signing in.' });
        return;
      }
      const salt = randomBytes(saltBytes);
      const passwordHash = await hashPassword(password, salt);
      const account = {
        id: randomBytes(16).toString('hex'),
        email,
        displayName,
        passwordSalt: salt.toString('base64'),
        passwordHash: passwordHash.toString('base64'),
        createdAt: new Date().toISOString(),
        role: 'member'
      };
      await insertAccount(account);
      pendingEmails.delete(email);
      await createSession(account, response);
    } catch (error) {
      pendingEmails.delete(email);
      console.error('Account registration failed:', error.message);
      response.status(503).json({ error: 'The account could not be saved. Please try again.' });
    }
  });

  authRouter.post('/login', requireSameOriginJson, async (request, response) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = request.body?.password;
    if (!isValidEmail(email) || typeof password !== 'string' || password.length > 128) {
      response.status(400).json({ error: 'Enter a valid email address and password.' });
      return;
    }
    if (!rateLimit(request, response, email)) return;

    try {
      const account = await getAccountByEmail(email);
      const salt = account ? Buffer.from(account.passwordSalt, 'base64') : dummySalt;
      const expectedHash = account ? Buffer.from(account.passwordHash, 'base64') : dummyHash;
      const actualHash = await hashPassword(password || '', salt);
      const isValid = actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
      if (!account || !isValid) {
        response.status(401).json({ error: 'Email or password is incorrect.' });
        return;
      }
      await createSession(account, response);
    } catch (error) {
      console.error('Account login failed:', error.message);
      response.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again.' });
    }
  });

  authRouter.post('/logout', requireSameOriginJson, async (request, response) => {
    const token = getSessionToken(request);
    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      if (cloudDatabase) {
        const { error } = await cloudDatabase.from('gaming_hub_sessions').delete().eq('token_hash', tokenHash);
        if (error) {
          response.status(503).json({ error: 'Sign-out is temporarily unavailable. Please try again.' });
          return;
        }
      } else {
        sessions.delete(tokenHash);
      }
    }
    clearSessionCookie(response, options.secureCookies);
    response.set('Cache-Control', 'no-store');
    response.json({ signedOut: true });
  });

  return { router: authRouter, requireApiAuth, optionalApiAuth, requireOwner, requireSameOriginJson };
}
