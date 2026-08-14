const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

function randomString(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

export const newId = () => randomString(12)

/** Short, shareable, and readable over the phone. */
export const newTreeId = () => `${randomString(4)}-${randomString(4)}`
