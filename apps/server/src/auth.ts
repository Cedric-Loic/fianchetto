import { randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CredentialsSchema } from '@sq/shared';
import type { GameStore, UserRow } from './persistence/db.js';

export const SESSION_COOKIE = 'sq_session';
const SESSION_DAYS = 30;

/** Utilisateur de la session (cookie httpOnly), ou `undefined`. */
export function currentUser(store: GameStore, request: FastifyRequest): UserRow | undefined {
  const token = request.cookies[SESSION_COOKIE];
  return token ? store.sessionUser(token) : undefined;
}

function openSession(store: GameStore, reply: FastifyReply, userId: string): void {
  const token = randomBytes(32).toString('hex');
  const maxAge = SESSION_DAYS * 24 * 3600;
  store.createSession(token, userId, Date.now() + maxAge * 1000);
  void reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge,
  });
}

/** Routes de comptes locaux : inscription, connexion, déconnexion, utilisateur courant. */
export function registerAuthRoutes(app: FastifyInstance, store: GameStore) {
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = CredentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const id = randomUUID();
    const created = store.createUser({
      id,
      username: parsed.data.username,
      passwordHash: await hash(parsed.data.password),
    });
    if (!created) return reply.code(409).send({ error: 'USERNAME_TAKEN' });
    openSession(store, reply, id);
    const user = store.findUser(id);
    return user ? store.publicUser(user) : reply.code(500).send({ error: 'ERROR' });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = CredentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    const user = store.findUserByName(parsed.data.username);
    // Message identique que le pseudo existe ou non.
    if (!user || !(await verify(user.passwordHash, parsed.data.password))) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }
    openSession(store, reply, user.id);
    return store.publicUser(user);
  });

  app.post('/api/auth/logout', (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) store.deleteSession(token);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', (request, reply) => {
    const user = currentUser(store, request);
    return user ? store.publicUser(user) : reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
  });
}
