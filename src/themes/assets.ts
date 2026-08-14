import manifest from '../assets/themes/manifest.json'
import type { ThemeId } from '../types'

/**
 * Resolves the theme art that `scripts/extract-assets.mjs` sliced out of the
 * supplied sheets in `Things/`. Going through Vite's glob means every asset is
 * hashed and bundled — nothing is fetched from the network at runtime.
 */
const urls = import.meta.glob('../assets/themes/**/*.{png,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const byKey: Record<string, string> = {}
for (const [path, url] of Object.entries(urls)) {
  const match = path.match(/themes\/([^/]+)\/(.+)\.(png|jpg)$/)
  if (match) byKey[`${match[1]}/${match[2]}`] = url
}

type ManifestEntry = { file: string; width?: number; height?: number; apertureRatio?: number }
const meta = manifest as Record<string, ManifestEntry>

export function asset(theme: ThemeId | string, name: string): string {
  const url = byKey[`${theme}/${name}`]
  if (!url && import.meta.env.DEV) {
    console.warn(`[themes] missing asset "${theme}/${name}"`)
  }
  return url ?? ''
}

export function hasAsset(theme: ThemeId | string, name: string): boolean {
  return Boolean(byKey[`${theme}/${name}`])
}

/**
 * How much of a portrait frame's width is the hole the photo shows through,
 * measured off the actual artwork. The renderer scales each frame so its
 * aperture lands exactly on the node's portrait radius, which is what keeps the
 * three medieval frame variants interchangeable despite differing bezel widths.
 */
export function apertureRatio(theme: ThemeId | string, name: string, fallback = 0.55): number {
  return meta[`${theme}/${name}`]?.apertureRatio ?? fallback
}

export function assetSize(theme: ThemeId | string, name: string) {
  const entry = meta[`${theme}/${name}`]
  return entry?.width && entry?.height ? { width: entry.width, height: entry.height } : null
}
