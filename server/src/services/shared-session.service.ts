import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { runWithSessionSnapshot, type ConversationSession } from './session.service';

const TTL_SECONDS = 7200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT = "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end; redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3]); redis.call('DEL', KEYS[1]); return 1";
const RELEASE = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end; return 0";
type Command = (args: (string | number)[]) => Promise<any>;

export function sharedStorageConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
}

const storageMessages: Record<string, string> = {
  SESSION_STORAGE_CONFIG_INVALID: 'Redis configuration is invalid. Check the server HTTPS REST URL and read/write token.',
  SESSION_STORAGE_AUTH_FAILED: 'Redis authorization failed. Check the server REST token and its matching database URL.',
  SESSION_STORAGE_READ_ONLY: 'Redis denied write access. Configure the read/write REST token, not the read-only token.',
  SESSION_STORAGE_LIMIT: 'Redis usage limit was reached. Check the database limits in Upstash.',
  SESSION_STORAGE_INVALID_RESPONSE: 'Redis returned an unexpected response. Check the server HTTPS REST endpoint.',
  SESSION_STORAGE_UNAVAILABLE: 'Session storage is unavailable. Please try again.',
};
function storageFailure(code: string) {
  return Object.assign(new Error(storageMessages[code] || storageMessages.SESSION_STORAGE_UNAVAILABLE), { status: 503, code });
}
function safeStorageCode(error: unknown): string {
  const code = (error as { code?: string })?.code;
  return code && Object.hasOwn(storageMessages, code) ? code : 'SESSION_STORAGE_UNAVAILABLE';
}
async function redisCommand(args: (string | number)[]): Promise<any> {
  let status: number | undefined;
  try {
    let url: URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    try {
      url = new URL(process.env.UPSTASH_REDIS_REST_URL?.trim() || '');
      if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || !token || /[\r\n]/.test(token)) throw new Error();
    } catch { throw storageFailure('SESSION_STORAGE_CONFIG_INVALID'); }
    const response = await fetch(url, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    status = response.status;
    if (status === 401) throw storageFailure('SESSION_STORAGE_AUTH_FAILED');
    if (status === 429) throw storageFailure('SESSION_STORAGE_LIMIT');
    const body = await response.json().catch(() => { throw storageFailure('SESSION_STORAGE_INVALID_RESPONSE'); }) as { result?: unknown; error?: string };
    if (!response.ok || body.error) {
      const detail = typeof body.error === 'string' ? body.error : '';
      if (/NOPERM|READONLY|read.only|no permissions|not permitted/i.test(detail)) throw storageFailure('SESSION_STORAGE_READ_ONLY');
      if (status === 403 || /WRONGPASS|unauthori[sz]ed|invalid token|authentication/i.test(detail)) throw storageFailure('SESSION_STORAGE_AUTH_FAILED');
      if (/quota|max.*requests|request.*limit|limit.*exceeded/i.test(detail)) throw storageFailure('SESSION_STORAGE_LIMIT');
      throw storageFailure('SESSION_STORAGE_UNAVAILABLE');
    }
    if (!Object.hasOwn(body, 'result')) throw storageFailure('SESSION_STORAGE_INVALID_RESPONSE');
    return body.result;
  } catch (error) {
    const code = safeStorageCode(error);
    // Fixed categories only: never log upstream messages, URLs, tokens, keys or transcripts.
    console.error('[SessionStorage]', { code, httpStatus: status, command: String(args[0]) });
    throw storageFailure(code);
  }
}

/** Verify the same read/write/Lua capabilities used by call sessions. */
export async function probeSharedStorage(): Promise<{ connected: boolean; code?: string; message?: string }> {
  if (!sharedStorageConfigured()) return { connected: false, code: 'SESSION_STORAGE_NOT_CONFIGURED', message: 'Shared session storage is not configured.' };
  try {
    const value = crypto.randomUUID();
    const result = await redisCommand(['EVAL', "redis.call('SET', KEYS[1], ARGV[1], 'EX', 10); local value = redis.call('GET', KEYS[1]); redis.call('DEL', KEYS[1]); return value", 1, 'aria:health:' + crypto.randomUUID(), value]);
    if (result !== value) throw storageFailure('SESSION_STORAGE_INVALID_RESPONSE');
    return { connected: true };
  } catch (error) {
    const code = safeStorageCode(error);
    return { connected: false, code, message: storageMessages[code] };
  }
}

/** Buffer JSON until the shared snapshot is committed; never acknowledge an unsaved turn. */
export function withSharedSession(handler: RequestHandler, command: Command = redisCommand): RequestHandler {
  return async (req, res, next) => {
    if (!sharedStorageConfigured()) {
      if (process.env.VERCEL) {
        res.status(503).json({ success: false, error: { code: 'SESSION_STORAGE_NOT_CONFIGURED', message: 'Shared session storage must be configured on the server.' } });
        return;
      }
      return handler(req, res, next);
    }
    const id = req.params.sessionId as string | undefined;
    if (id && !UUID.test(id)) {
      res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Conversation session was not found.' } });
      return;
    }
    const token = crypto.randomUUID();
    const key = id ? `aria:session:${id}` : undefined;
    const lock = key ? `${key}:lock` : undefined;
    let acquired = false;
    const originalJson = res.json;
    try {
      if (lock) {
        acquired = await command(['SET', lock, token, 'NX', 'EX', 90]) === 'OK';
        if (!acquired) {
          res.setHeader('Retry-After', '1');
          res.status(409).json({ success: false, error: { code: 'SESSION_BUSY', message: 'This call is processing another request. Please try again shortly.' } });
          return;
        }
      }
      const snapshot = new Map<string, ConversationSession>();
      if (key) {
        const stored = await command(['GET', key]);
        if (stored) {
          const session = JSON.parse(stored) as ConversationSession;
          if (session.id !== id || !Array.isArray(session.messages)) throw new Error('Invalid session snapshot');
          snapshot.set(session.id, session);
        }
      }
      let payload: unknown;
      let answered = false;
      res.json = function (body: unknown) { payload = body; answered = true; return this; };
      await runWithSessionSnapshot(snapshot, async () => { await handler(req, res, next); });
      res.json = originalJson;
      if (!answered) throw new Error('Session handler did not return JSON');
      const session = id ? snapshot.get(id) : [...snapshot.values()][0];
      if (session) {
        if (lock) {
          const committed = await command(['EVAL', COMMIT, 2, lock, key!, token, JSON.stringify(session), TTL_SECONDS]);
          if (committed !== 1) throw new Error('Session lease expired');
          acquired = false;
        } else {
          const created = await command(['SET', `aria:session:${session.id}`, JSON.stringify(session), 'NX', 'EX', TTL_SECONDS]);
          if (created !== 'OK') throw new Error('Session creation failed');
        }
      }
      // Release even for missing sessions before responding (serverless can suspend after response).
      if (lock && acquired) { await command(['EVAL', RELEASE, 1, lock, token]); acquired = false; }
      originalJson.call(res, payload);
    } catch (error) {
      res.json = originalJson;
      const code = safeStorageCode(error);
      res.status(503).json({ success: false, error: { code, message: storageMessages[code] } });
    } finally {
      res.json = originalJson;
      if (lock && acquired) {
        try { await command(['EVAL', RELEASE, 1, lock, token]); } catch { /* Lease expires after 90 seconds. */ }
      }
    }
  };
}
