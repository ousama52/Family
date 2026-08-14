import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort()

for (const file of files) {
  const path = join(dir, file)
  const img = sharp(path)
  const meta = await img.metadata()
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  let transparent = 0
  let opaque = 0
  let partial = 0
  const total = width * height
  for (let i = 3; i < data.length; i += channels) {
    const a = data[i]
    if (a === 0) transparent++
    else if (a === 255) opaque++
    else partial++
  }

  // Corner sample: a genuinely isolated asset has transparent corners.
  const px = (x, y) => {
    const o = (y * width + x) * channels
    return [data[o], data[o + 1], data[o + 2], data[o + 3]]
  }
  const corners = [px(2, 2), px(width - 3, 2), px(2, height - 3), px(width - 3, height - 3)]

  // Detect a faked checkerboard "transparency" backdrop: alternating light/dark
  // grey squares in an otherwise fully opaque image.
  let checker = false
  if (transparent === 0) {
    const a = px(4, 4)
    const b = px(4 + 16, 4)
    const isGrey = (p) => Math.abs(p[0] - p[1]) < 12 && Math.abs(p[1] - p[2]) < 12
    checker = isGrey(a) && isGrey(b) && Math.abs(a[0] - b[0]) > 14 && a[0] > 120 && b[0] > 120
  }

  console.log(
    [
      file.padEnd(42),
      `${width}x${height}`.padEnd(12),
      `ch=${meta.channels}`,
      `alpha=${meta.hasAlpha ? 'yes' : 'NO '}`,
      `clear=${((transparent / total) * 100).toFixed(1)}%`.padEnd(13),
      `soft=${((partial / total) * 100).toFixed(1)}%`.padEnd(12),
      `corners=${corners.map((c) => `a${c[3]}`).join(',')}`.padEnd(26),
      checker ? 'FAKE-CHECKERBOARD' : '',
    ].join(' '),
  )
}
