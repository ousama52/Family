import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
const files = readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort()

for (const file of files) {
  const { data, info } = await sharp(join(dir, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const buckets = new Array(16).fill(0)
  let n = 0
  for (let i = 3; i < data.length; i += info.channels) {
    buckets[Math.min(15, data[i] >> 4)]++
    n++
  }
  const pct = buckets.map((b) => ((b / n) * 100).toFixed(1).padStart(5))
  console.log(file.padEnd(40), pct.join(' '))
}
console.log('\nbuckets = alpha 0-15,16-31,...,240-255 (percent of pixels)')
