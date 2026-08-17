import { hash, verify } from "@node-rs/argon2";

/** Hash a plaintext password with argon2id (library defaults). */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** Verify a plaintext password against a stored argon2 hash. */
export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}
