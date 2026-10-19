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

async function redisCommand(args: (string | number)[]): Promise<any> {
  try {
    const url = new URL(process.env.UPSTASH_REDIS_REST_URL!);
    if (url.protocol !== 'https:') throw new Error();
    const response = await fetch(url, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    const body = await response.json() as { result?: unknown; error?: string };
    if (!response.ok || body.error) throw new Error();
    return body.result;
  } catch {
    // Do not expose upstream responses, tokens, connection URLs or transcripts.
    throw Object.assign(new Error('Session storage is unavailable. Please try again.'), { status: 503, code: 'SESSION_STORAGE_UNAVAILABLE' });
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
    } catch {
      res.json = originalJson;
      res.status(503).json({ success: false, error: { code: 'SESSION_STORAGE_UNAVAILABLE', message: 'Could not save or load the call. Please try again.' } });
    } finally {
      res.json = originalJson;
      if (lock && acquired) {
        try { await command(['EVAL', RELEASE, 1, lock, token]); } catch { /* Lease expires after 90 seconds. */ }
      }
    }
  };
}
