/**
 * Portraits are stored inline on the person record as a data URL rather than in
 * Firebase Storage — it keeps provisioning to Firestore alone. To stay well
 * inside Firestore's 1 MB per-document limit, every upload is centre-cropped to
 * a square and re-encoded at portrait size before it is saved.
 */
const MAX_EDGE = 320
const QUALITY = 0.82

export async function readPortrait(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')

  const bitmap = await createImageBitmap(file)
  const edge = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(MAX_EDGE, edge)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that image.')

  ctx.drawImage(
    bitmap,
    (bitmap.width - edge) / 2,
    (bitmap.height - edge) / 2,
    edge,
    edge,
    0,
    0,
    size,
    size,
  )
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  if (dataUrl.length > 900_000) throw new Error('That photo is too large — try a smaller one.')
  return dataUrl
}
