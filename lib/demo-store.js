'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const { randomBytes } = require('node:crypto');

const context = new AsyncLocalStorage();
const cookieName = 'shopledger_demo';
const maxSessions = 64;
const maxBytes = 256_000;

function createMiddleware(seed) {
  const sessions = new Map();
  return function demoSession(req, res, next) {
    const found = /(?:^|;\s*)shopledger_demo=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '');
    let id = found && found[1];
    let session = sessions.get(id);
    if (!session) {
      id = randomBytes(24).toString('hex');
      let data = structuredClone(seed);
      session = {
        read: () => structuredClone(data),
        write(nextData) {
          if (Buffer.byteLength(JSON.stringify(nextData)) > maxBytes) {
            const error = new Error('Demo data limit reached. Reset the demo to continue.');
            error.status = 413;
            throw error;
          }
          data = structuredClone(nextData);
        },
        reset: () => { data = structuredClone(seed); }
      };
      res.cookie(cookieName, id, { httpOnly: true, sameSite: 'lax', secure: Boolean(req.secure), maxAge: 3600_000 });
    } else {
      sessions.delete(id);
    }
    sessions.set(id, session);
    if (sessions.size > maxSessions) sessions.delete(sessions.keys().next().value);
    context.run(session, next);
  };
}

module.exports = { createMiddleware, current: () => context.getStore() };
