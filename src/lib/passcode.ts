/**
 * Lightweight shared-secret protection for a tree's write access.
 *
 * The passcode is never stored or transmitted in plaintext: only a salted
 * SHA-256 digest is written to Firestore, and the client compares digests
 * before allowing edits. This is deliberately simple — it keeps a family tree
 * link from being casually edited by whoever it gets forwarded to. It is *not*
 * an authentication system; see the README for when to move to Firebase Auth.
 */

const SALT_PREFIX = 'family-tree-v1'

export async function hashPasscode(treeId: string, passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT_PREFIX}:${treeId}:${passcode.trim()}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPasscode(
  treeId: string,
  passcode: string,
  expectedHash: string,
): Promise<boolean> {
  if (!expectedHash) return false
  const actual = await hashPasscode(treeId, passcode)
  // Constant-time-ish compare. Both operands are fixed-length hex digests.
  if (actual.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  return diff === 0
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 — easier to read aloud

export function suggestPasscode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}
