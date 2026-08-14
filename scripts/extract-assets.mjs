/**
 * Slices the supplied sprite sheets in `Things/` into individual theme assets
 * under `src/assets/themes/<theme>/`.
 *
 * The generated images were produced as loose sheets — several sprites per file,
 * laid out irregularly and surrounded by a soft glow haze. This script:
 *   1. floors near-zero alpha so the haze does not leave a grey box behind,
 *   2. finds each sprite as a connected component of the alpha mask
 *      (dilated first, so a sprite's detached specks and splatter stay with it),
 *   3. trims each to its own bounds and writes it out under a stable name,
 *   4. for the circular portrait frames, locates the transparent aperture in the
 *      middle so the renderer knows where the photo sits inside the frame.
 *
 * Run: node scripts/extract-assets.mjs
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, '..', 'Things')
const OUT = join(root, 'src', 'assets', 'themes')

/** @type {Array<{file:string, theme:string, names:string[], alphaFloor?:number, dilate?:number, minAreaPct?:number, aperture?:boolean, single?:boolean, maxEdge?:number}>} */
const SHEETS = [
  // --- Celestial ---------------------------------------------------------
  {
    file: 'Celestial Theme Background.png',
    theme: 'celestial',
    names: ['background'],
    single: true,
    maxEdge: 1400,
  },
  {
    file: 'Node glow ring.png',
    theme: 'celestial',
    // The three rings' glow haloes overlap, so component detection merges them.
    // They are laid out as even thirds, so slice on a fixed grid instead.
    names: ['ring-blue', 'ring-gold', 'ring-purple'],
    grid: { cols: 3, rows: 1 },
    alphaFloor: 8,
    // Measure the hole so the ring lands on the portrait rather than swallowing it.
    aperture: true,
    maxEdge: 512,
  },
  {
    file: 'Star-point sprite.png',
    theme: 'celestial',
    names: Array.from({ length: 8 }, (_, i) => `star-${i + 1}`),
    alphaFloor: 6,
    dilate: 10,
    minAreaPct: 0.03,
    maxEdge: 128,
  },
  {
    file: 'Shattershard fragments.png',
    theme: 'celestial',
    names: Array.from({ length: 12 }, (_, i) => `shard-${i + 1}`),
    alphaFloor: 24,
    dilate: 3,
    minAreaPct: 0.12,
    maxEdge: 192,
  },
  {
    file: 'Icon set.png',
    theme: 'celestial',
    // reading order: 4 / 4 / 3
    names: [
      'back', 'menu', 'zoom-in', 'zoom-out',
      'search', 'share', 'tree', 'people',
      'timeline', 'memories', 'more',
    ],
    // This sheet carries a broad warm haze; floor it hard so tiles stay clean.
    alphaFloor: 46,
    dilate: 4,
    minAreaPct: 0.35,
    maxEdge: 192,
  },

  // --- Medieval ----------------------------------------------------------
  {
    file: 'Medieval Theme Background.png',
    theme: 'medieval',
    names: ['background'],
    single: true,
    maxEdge: 1400,
  },
  {
    file: 'Full-screen border frame.png',
    theme: 'medieval',
    names: ['border-frame'],
    single: true,
    alphaFloor: 12,
  },
  {
    file: 'Portrait frames.png',
    theme: 'medieval',
    names: ['frame-1', 'frame-2', 'frame-3'],
    alphaFloor: 20,
    dilate: 6,
    minAreaPct: 1.5,
    aperture: true,
    maxEdge: 512,
  },
  {
    file: 'Name plaque background.png',
    theme: 'medieval',
    names: ['plaque'],
    alphaFloor: 20,
    dilate: 8,
    minAreaPct: 2,
    maxEdge: 640,
  },
  {
    file: 'Leaf sprite.png',
    theme: 'medieval',
    names: ['leaf-1'],
    alphaFloor: 20,
    dilate: 4,
    minAreaPct: 0.4,
    maxEdge: 128,
  },
  {
    file: 'Crackshatter overlay.png',
    theme: 'medieval',
    names: ['crack-overlay'],
    alphaFloor: 20,
    dilate: 26,
    minAreaPct: 3,
    maxEdge: 512,
  },
  {
    file: 'Medieval Icon set.png',
    theme: 'medieval',
    names: ['back', 'settings', 'tree', 'people', 'timeline', 'memories', 'more'],
    alphaFloor: 22,
    dilate: 5,
    minAreaPct: 0.5,
    maxEdge: 192,
  },

  // --- Wuxia -------------------------------------------------------------
  {
    file: 'Wuxia  Murim Theme Background.png',
    theme: 'wuxia',
    names: ['background'],
    single: true,
    maxEdge: 1400,
  },
  {
    file: 'Wuxia Portrait frame.png',
    theme: 'wuxia',
    names: ['frame-1'],
    alphaFloor: 14,
    dilate: 14,
    minAreaPct: 4,
    aperture: true,
    maxEdge: 512,
  },
  {
    file: 'Seal badge background.png',
    theme: 'wuxia',
    names: ['seal'],
    alphaFloor: 16,
    dilate: 14,
    minAreaPct: 4,
    maxEdge: 256,
  },
  {
    file: 'Ink slashsplatter overlay.png',
    theme: 'wuxia',
    names: ['ink-slash'],
    alphaFloor: 16,
    dilate: 30,
    minAreaPct: 3,
    maxEdge: 640,
  },
  {
    file: 'Wuxia Icon set.png',
    theme: 'wuxia',
    names: ['back', 'menu', 'tree', 'people', 'timeline', 'skills', 'more'],
    alphaFloor: 22,
    // The ensō rings on this sheet are broken open and ringed with loose
    // splatter, so component detection either splits one icon in two or welds
    // neighbours together. The layout is a clean 2-over-5, so cut it by rows.
    rowGrid: [
      { from: 0, to: 0.53, cols: 2 },
      { from: 0.53, to: 1, cols: 5 },
    ],
    maxEdge: 192,
  },
]

// ---------------------------------------------------------------------------

/** Separable box dilation of a binary mask — joins a sprite to its own specks. */
function dilate(mask, width, height, radius) {
  if (radius <= 0) return mask
  const tmp = new Uint8Array(mask.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      let on = 0
      for (let d = -radius; d <= radius && !on; d++) {
        const nx = x + d
        if (nx >= 0 && nx < width && mask[row + nx]) on = 1
      }
      tmp[row + x] = on
    }
  }
  const out = new Uint8Array(mask.length)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let on = 0
      for (let d = -radius; d <= radius && !on; d++) {
        const ny = y + d
        if (ny >= 0 && ny < height && tmp[ny * width + x]) on = 1
      }
      out[y * width + x] = on
    }
  }
  return out
}

/**
 * Iterative flood fill; returns every component with its bounds and area, plus
 * a label map so a sprite can be cut out without dragging in its neighbours.
 */
function components(mask, width, height, minArea) {
  const seen = new Uint8Array(mask.length)
  const labels = new Int32Array(mask.length).fill(-1)
  const found = []
  const stack = new Int32Array(mask.length)
  let label = 0

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    const members = []
    let area = 0
    let minX = width
    let maxX = -1
    let minY = height
    let maxY = -1

    while (top > 0) {
      const idx = stack[--top]
      const x = idx % width
      const y = (idx / width) | 0
      members.push(idx)
      area++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      if (x > 0 && mask[idx - 1] && !seen[idx - 1]) { seen[idx - 1] = 1; stack[top++] = idx - 1 }
      if (x < width - 1 && mask[idx + 1] && !seen[idx + 1]) { seen[idx + 1] = 1; stack[top++] = idx + 1 }
      if (y > 0 && mask[idx - width] && !seen[idx - width]) { seen[idx - width] = 1; stack[top++] = idx - width }
      if (y < height - 1 && mask[idx + width] && !seen[idx + width]) { seen[idx + width] = 1; stack[top++] = idx + width }
    }

    if (area >= minArea) {
      for (const idx of members) labels[idx] = label
      found.push({ area, minX, maxX, minY, maxY, label: label++ })
    }
  }
  return { found, labels }
}

/**
 * Finds the photo aperture of a circular frame: the largest run of transparent
 * pixels inside the sprite that does not touch its outer edge.
 */
function findAperture(alpha, width, height, box, floor) {
  const w = box.maxX - box.minX + 1
  const h = box.maxY - box.minY + 1
  const hole = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      hole[y * w + x] = alpha[(y + box.minY) * width + (x + box.minX)] < floor ? 1 : 0
    }
  }
  // Flood the outside in, so only enclosed transparent regions remain.
  const stack = []
  const outside = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    if (hole[x]) stack.push(x)
    const bottom = (h - 1) * w + x
    if (hole[bottom]) stack.push(bottom)
  }
  for (let y = 0; y < h; y++) {
    if (hole[y * w]) stack.push(y * w)
    if (hole[y * w + w - 1]) stack.push(y * w + w - 1)
  }
  while (stack.length) {
    const idx = stack.pop()
    if (outside[idx] || !hole[idx]) continue
    outside[idx] = 1
    const x = idx % w
    const y = (idx / w) | 0
    if (x > 0) stack.push(idx - 1)
    if (x < w - 1) stack.push(idx + 1)
    if (y > 0) stack.push(idx - w)
    if (y < h - 1) stack.push(idx + w)
  }

  const inner = new Uint8Array(w * h)
  for (let i = 0; i < hole.length; i++) inner[i] = hole[i] && !outside[i] ? 1 : 0
  const holes = components(inner, w, h, 200).found
  if (!holes.length) return null
  holes.sort((a, b) => b.area - a.area)
  const best = holes[0]
  return {
    cx: box.minX + (best.minX + best.maxX) / 2,
    cy: box.minY + (best.minY + best.maxY) / 2,
    radius: Math.sqrt(best.area / Math.PI),
  }
}

// ---------------------------------------------------------------------------

const manifest = {}

for (const sheet of SHEETS) {
  const inPath = join(SRC, sheet.file)
  const outDir = join(OUT, sheet.theme)
  mkdirSync(outDir, { recursive: true })

  const image = sharp(inPath).ensureAlpha()
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  // Whole-image assets (backgrounds, the full-screen border) just get floored
  // and resized — there is nothing to slice.
  if (sheet.single) {
    const name = sheet.names[0]
    let pipe = sharp(inPath)
    if (sheet.maxEdge) pipe = pipe.resize({ width: sheet.maxEdge, height: sheet.maxEdge, fit: 'inside', withoutEnlargement: true })
    const ext = sheet.alphaFloor === undefined ? 'jpg' : 'png'
    const file = `${name}.${ext}`
    await (ext === 'jpg' ? pipe.jpeg({ quality: 84, mozjpeg: true }) : pipe.png({ compressionLevel: 9 })).toFile(join(outDir, file))
    manifest[`${sheet.theme}/${name}`] = { file, whole: true }
    console.log(`${sheet.theme}/${file}`.padEnd(46), `${width}x${height} (whole)`)
    continue
  }

  const floor = sheet.alphaFloor ?? 16
  const alpha = new Uint8Array(width * height)
  for (let i = 0, p = 3; p < data.length; i++, p += channels) {
    alpha[i] = data[p] < floor ? 0 : data[p]
  }

  const mask = new Uint8Array(width * height)
  for (let i = 0; i < alpha.length; i++) mask[i] = alpha[i] ? 1 : 0

  const minArea = Math.round(((sheet.minAreaPct ?? 0.5) / 100) * width * height)
  let boxes
  /** Label map, when sprites were found by component detection. */
  let labels = null

  if (sheet.grid || sheet.rowGrid) {
    // Fixed cells, for sheets whose sprites bleed into one another. Each cell is
    // then trimmed down to whatever it actually contains.
    const rows = sheet.rowGrid ?? [{ from: 0, to: 1, cols: sheet.grid.cols, count: sheet.grid.rows }]
    const cells = []
    if (sheet.grid) {
      for (let r = 0; r < sheet.grid.rows; r++) {
        for (let c = 0; c < sheet.grid.cols; c++) {
          cells.push({
            minX: Math.round((c * width) / sheet.grid.cols),
            maxX: Math.round(((c + 1) * width) / sheet.grid.cols) - 1,
            minY: Math.round((r * height) / sheet.grid.rows),
            maxY: Math.round(((r + 1) * height) / sheet.grid.rows) - 1,
          })
        }
      }
    } else {
      for (const row of rows) {
        for (let c = 0; c < row.cols; c++) {
          cells.push({
            minX: Math.round((c * width) / row.cols),
            maxX: Math.round(((c + 1) * width) / row.cols) - 1,
            minY: Math.round(row.from * height),
            maxY: Math.round(row.to * height) - 1,
          })
        }
      }
    }

    boxes = cells.map((cell) => {
      let minX = cell.maxX
      let maxX = cell.minX
      let minY = cell.maxY
      let maxY = cell.minY
      for (let y = cell.minY; y <= cell.maxY; y++) {
        for (let x = cell.minX; x <= cell.maxX; x++) {
          if (!alpha[y * width + x]) continue
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
      return maxX >= minX ? { minX, maxX, minY, maxY, area: 0 } : cell
    })
  } else {
    const result = components(dilate(mask, width, height, sheet.dilate ?? 0), width, height, minArea)
    boxes = result.found
    labels = result.labels
    // Reading order: group into rows, then left to right within each row.
    const rowTolerance = height * 0.12
    boxes.sort((a, b) => {
      const ay = (a.minY + a.maxY) / 2
      const by = (b.minY + b.maxY) / 2
      if (Math.abs(ay - by) > rowTolerance) return ay - by
      return a.minX - b.minX
    })
  }

  if (boxes.length !== sheet.names.length && !sheet.names[0].match(/-\d+$/)) {
    console.warn(`  ! ${sheet.file}: found ${boxes.length} sprites, expected ${sheet.names.length}`)
  }

  for (let i = 0; i < boxes.length; i++) {
    const name = sheet.names[i]
    if (!name) break
    const box = boxes[i]
    let left = box.minX
    let top = box.minY
    let w = box.maxX - box.minX + 1
    let h = box.maxY - box.minY + 1
    let apertureRatio

    if (sheet.aperture) {
      const hole = findAperture(alpha, width, height, box, 1)
      if (hole) {
        // Square the crop around the aperture centre so the photo sits dead
        // centre when the frame is drawn on a node.
        const half = Math.ceil(
          Math.max(hole.cx - box.minX, box.maxX - hole.cx, hole.cy - box.minY, box.maxY - hole.cy),
        )
        left = Math.round(hole.cx - half)
        top = Math.round(hole.cy - half)
        w = half * 2
        h = half * 2
        apertureRatio = Number((hole.radius / half).toFixed(4))
      }
    }

    // Copy the crop out pixel by pixel. Anything belonging to a *different*
    // sprite is dropped: the sheets lay their sprites out on a diagonal, so a
    // square crop centred on one frame's aperture otherwise drags in a slice of
    // its neighbour. Off-sheet area comes through as transparent.
    const crop = Buffer.alloc(w * h * 4)
    for (let y = 0; y < h; y++) {
      const sy = top + y
      if (sy < 0 || sy >= height) continue
      for (let x = 0; x < w; x++) {
        const sx = left + x
        if (sx < 0 || sx >= width) continue
        const src = sy * width + sx
        if (labels && labels[src] !== -1 && labels[src] !== box.label) continue
        const d = (y * w + x) * 4
        const s = src * channels
        crop[d] = data[s]
        crop[d + 1] = data[s + 1]
        crop[d + 2] = data[s + 2]
        crop[d + 3] = alpha[src]
      }
    }

    let pipe = sharp(crop, { raw: { width: w, height: h, channels: 4 } })

    if (sheet.maxEdge) {
      pipe = pipe.resize({ width: sheet.maxEdge, height: sheet.maxEdge, fit: 'inside', withoutEnlargement: true })
    }

    const file = `${name}.png`
    const out = await pipe.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    writeFileSync(join(outDir, file), out.data)

    manifest[`${sheet.theme}/${name}`] = {
      file,
      width: out.info.width,
      height: out.info.height,
      ...(apertureRatio ? { apertureRatio } : {}),
    }
    console.log(
      `${sheet.theme}/${file}`.padEnd(46),
      `${out.info.width}x${out.info.height}`.padEnd(12),
      apertureRatio ? `aperture=${apertureRatio}` : '',
    )
  }
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`\nWrote ${Object.keys(manifest).length} assets + manifest.json`)
