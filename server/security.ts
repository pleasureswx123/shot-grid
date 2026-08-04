import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const HASH_BYTES = 64;

export const hashPassword = async (password: string): Promise<string> => {
  if (password.length < 10) {
    throw new Error('Password must contain at least 10 characters.');
  }
  if (password.length > 1024) {
    throw new Error('Password is too long.');
  }

  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, HASH_BYTES) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [algorithm, encodedSalt, encodedHash] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !encodedSalt || !encodedHash) return false;

  try {
    const salt = Buffer.from(encodedSalt, 'base64url');
    const expected = Buffer.from(encodedHash, 'base64url');
    const actual = await scrypt(password, salt, expected.length) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
};

export const createSessionToken = (): string => randomBytes(32).toString('base64url');

export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

