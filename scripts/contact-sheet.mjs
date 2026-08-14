import sharp from 'sharp'
import { readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = join(root, 'src', 'assets', 'themes')
const theme = process.argv[2]
const out = process.argv[3]
const dir = join(base, theme)
if (!existsSync(dir)) throw new Error(`no such theme dir: ${dir}`)

const files = readdirSync(dir).filter((f) => /\.(png|jpg)$/i.test(f)).sort()
const CELL = 190
const COLS = 6
const rows = Math.ceil(files.length / COLS)

// Mid grey so both dark and light assets are visible against it.
const canvas = sharp({
  create: {
    width: COLS * CELL,
    height: rows * (CELL + 22),
    channels: 4,
    background: { r: 122, g: 122, b: 128, alpha: 1 },
  },
})

const layers = []
for (let i = 0; i < files.length; i++) {
  const buf = await sharp(join(dir, files[i]))
    .resize({ width: CELL - 12, height: CELL - 12, fit: 'inside' })
    .png()
    .toBuffer()
  const meta = await sharp(buf).metadata()
  layers.push({
    input: buf,
    left: (i % COLS) * CELL + Math.round((CELL - meta.width) / 2),
    top: Math.floor(i / COLS) * (CELL + 22) + Math.round((CELL - meta.height) / 2),
  })
  const label = Buffer.from(
    `<svg width="${CELL}" height="20"><text x="${CELL / 2}" y="14" font-family="monospace" font-size="12" fill="#fff" text-anchor="middle">${files[i].replace(/\.(png|jpg)$/, '')}</text></svg>`,
  )
  layers.push({ input: label, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * (CELL + 22) + CELL })
}

await canvas.composite(layers).png().toFile(out)
console.log(`${out}: ${files.length} assets`)
