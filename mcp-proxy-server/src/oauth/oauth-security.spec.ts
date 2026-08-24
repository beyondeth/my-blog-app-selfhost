import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import { createAuthorizationRouter, isValidPkceRequest, verifyMcpOAuthGrant } from './authorization.js';
import { createClientRegistrationRouter } from './client-registration.js';
import { OAuthStorage } from './storage.js';
import type { McpOAuthGrantClaims, OAuthSession, StoredClient } from './types.js';

const SECRET = 'test-mcp-shared-secret-with-enough-entropy';
const ISSUER = 'http://localhost:3000/api/v1/auth/oauth/mcp';
const AUDIENCE = 'http://localhost:3002';
const CALLBACK = `${AUDIENCE}/oauth/callback`;
const NOW = 1_800_000_000;

function signGrant(overrides: Partial<McpOAuthGrantClaims> = {}): string {
  const claims: McpOAuthGrantClaims = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: '11111111-1111-4111-8111-111111111111',
    state: 'expected-state',
    callback: CALLBACK,
    jti: '22222222-2222-4222-8222-222222222222',
    iat: NOW,
    exp: NOW + 60,
    ...overrides,
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const expectedGrant = (state = 'expected-state') => ({
  issuer: ISSUER,
  audience: AUDIENCE,
  callback: CALLBACK,
  state,
  now: NOW,
});

test('accepts only an intact, bound, 60-second Backend grant', () => {
  const claims = verifyMcpOAuthGrant(signGrant(), SECRET, expectedGrant());
  assert.equal(claims.sub, '11111111-1111-4111-8111-111111111111');

  const forgedParts = signGrant().split('.');
  const forgedClaims = JSON.parse(Buffer.from(forgedParts[1], 'base64url').toString('utf8'));
  forgedClaims.sub = 'victim-user-id';
  forgedParts[1] = Buffer.from(JSON.stringify(forgedClaims)).toString('base64url');
  assert.throws(
    () => verifyMcpOAuthGrant(forgedParts.join('.'), SECRET, expectedGrant()),
    /signature/,
  );
  assert.throws(
    () => verifyMcpOAuthGrant(signGrant({ exp: NOW }), SECRET, expectedGrant()),
    /expired|lifetime/,
  );
  assert.throws(
    () => verifyMcpOAuthGrant(signGrant(), SECRET, expectedGrant('other-state')),
    /binding mismatch/,
  );
  assert.throws(
    () => verifyMcpOAuthGrant(signGrant(), SECRET, { ...expectedGrant(), callback: `${AUDIENCE}/other` }),
    /binding mismatch/,
  );
});

test('authorization requests require PKCE S256', () => {
  assert.equal(isValidPkceRequest('challenge', 'S256'), true);
  assert.equal(isValidPkceRequest('challenge', 'plain'), false);
  assert.equal(isValidPkceRequest(undefined, 'S256'), false);
});

test('grant jti consumption is atomic and rejects replay', async () => {
  const values = new Set<string>();
  const redis = {
    async set(key: string, _value: string, _ex: string, _ttl: number, mode: string) {
      if (mode === 'NX' && values.has(key)) return null;
      values.add(key);
      return 'OK';
    },
  };
  const storage = new OAuthStorage(redis as never);

  assert.equal(await storage.consumeGrantJti('one-time-jti', Math.floor(Date.now() / 1000) + 60), true);
  assert.equal(await storage.consumeGrantJti('one-time-jti', Math.floor(Date.now() / 1000) + 60), false);
});

let server: Server;
let baseUrl: string;
let authorizationCodesSaved = 0;
const consumedJtis = new Set<string>();

before(async () => {
  const session: OAuthSession = {
    state: 'expected-state',
    clientId: 'mcp_test',
    redirectUri: 'http://127.0.0.1/callback',
    scope: 'mcp:tools',
    codeChallenge: 'challenge',
    codeChallengeMethod: 'S256',
    resource: AUDIENCE,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  };
  let sessionAvailable = true;
  const authorizationStorage = {
    async consumeGrantJti(jti: string) {
      if (consumedJtis.has(jti)) return false;
      consumedJtis.add(jti);
      return true;
    },
    async consumeSession(state: string) {
      if (!sessionAvailable || state !== session.state) return null;
      sessionAvailable = false;
      return session;
    },
    generateToken() {
      return 'authorization-code';
    },
    async saveAuthorizationCode() {
      authorizationCodesSaved += 1;
    },
  };

  const existingClient: StoredClient = {
    clientId: 'mcp_existing',
    clientSecret: 'must-never-be-returned',
    clientIdIssuedAt: 1,
    redirectUris: ['http://127.0.0.1/callback'],
    scope: 'mcp:tools',
    tokenEndpointAuthMethod: 'client_secret_post',
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const registrationStorage = {
    async findClientByRedirectUri() {
      return existingClient;
    },
    async deleteClient() {},
    generateClientId() { return 'mcp_new_id'; },
    generateClientSecret() { return 'new_secret'; },
    async saveClient() {},
  };

  const app = express();
  app.use(express.json());
  app.use(createAuthorizationRouter(authorizationStorage as unknown as OAuthStorage));
  app.use(createClientRegistrationRouter(registrationStorage as unknown as OAuthStorage));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('raw or forged user_id cannot issue an authorization code', async () => {
  const response = await fetch(`${baseUrl}/callback?state=expected-state&user_id=victim-user-id`);
  assert.equal(response.status, 400);
  assert.equal(authorizationCodesSaved, 0);
});

test('a signed grant issues one code and the same grant cannot be replayed', async () => {
  const originalNow = Date.now;
  Date.now = () => NOW * 1000;
  try {
    const query = new URLSearchParams({ state: 'expected-state', grant: signGrant() });
    const first = await fetch(`${baseUrl}/callback?${query}`, { redirect: 'manual' });
    assert.equal(first.status, 302);
    assert.equal(authorizationCodesSaved, 1);

    const replay = await fetch(`${baseUrl}/callback?${query}`, { redirect: 'manual' });
    assert.equal(replay.status, 400);
    assert.equal(authorizationCodesSaved, 1);
  } finally {
    Date.now = originalNow;
  }
});

test('duplicate DCR is overwritten without returning the existing secret', async () => {
  const response = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: ['http://127.0.0.1/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 201);
  assert.equal(body.includes('must-never-be-returned'), false);
});
