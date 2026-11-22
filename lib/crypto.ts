import { createHash, randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** Số nguyên ngẫu nhiên an toàn trong [min, max] (bao gồm cả hai đầu). */
export function secureRandomInt(min: number, max: number): number {
  return randomInt(min, max + 1);
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
