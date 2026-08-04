import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './security';

test('password hashes verify only the original password', async () => {
  const hash = await hashPassword('correct horse battery staple');

  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('incorrect password', hash), false);
});

test('the same password receives a unique salt', async () => {
  const first = await hashPassword('a sufficiently long password');
  const second = await hashPassword('a sufficiently long password');

  assert.notEqual(first, second);
});

test('short passwords are rejected', async () => {
  await assert.rejects(() => hashPassword('short'));
});

test('session tokens are random and stored as fixed-length hashes', () => {
  const first = createSessionToken();
  const second = createSessionToken();

  assert.notEqual(first, second);
  assert.equal(hashSessionToken(first).length, 64);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
  assert.notEqual(hashSessionToken(first), hashSessionToken(second));
});

