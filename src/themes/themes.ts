import { asset } from './assets'
import type { WidthProfile } from '../lib/branchPath'
import type { ThemeId } from '../types'

export type RemovalEffect = 'shatter' | 'crack-shatter' | 'ink-slash'
export type FrameStyle = 'glow-ring' | 'metal' | 'brush'
export type PillStyle = 'capsule' | 'shield' | 'ink'

export type NavItem = { key: string; label: string }

export type Theme = {
  id: ThemeId
  name: string
  tagline: string

  fonts: {
    title: string
    body: string
    titleWeight: number
    titleSpacing: string
  }

  background: {
    image: string
    /** Fine-tunes the supplied plate toward the tone of the reference mockup. */
    filter: string
    /** Gradient / vignette painted over the background plate. */
    overlay: string
    base: string
    size: string
    /** Medieval only: the full-screen carved border that frames the page. */
    borderImage?: string
  }

  palette: {
    ink: string
    inkSoft: string
    accent: string
    accentSoft: string
    chrome: string
    chromeBorder: string
    branch: string
    branchHighlight: string
    branchGlow: string
    removedInk: string
    removedBranch: string
    surface: string
    surfaceBorder: string
  }

  branch: {
    profile: WidthProfile
    /** Width of a branch leaving the oldest generation — the trunk. */
    baseWidth: number
    /** Proportion of width retained per generation outward. */
    falloff: number
    glow: boolean
    /** Celestial: bright star-points strung along each branch. */
    starPoints: boolean
    /** Medieval: small leaf sprites scattered along the wood. */
    leaves: boolean
    /** Wuxia: dry-brush speckle along the stroke edge. */
    drybrush: boolean
  }

  node: {
    radius: number
    frame: FrameStyle
    /**
     * Frame artwork to alternate between as people are added — asset names under
     * this theme's folder. Celestial's are the three coloured glow rings, which
     * are picked by lineage rather than at random.
     */
    frameAssets: string[]
    plaque: boolean
    seal: boolean
    /** Ring colours assigned per lineage; index 0 is the first ancestral line. */
    lineageColors: string[]
    selfColor: string
  }

  removal: RemovalEffect

  /** Supplied sprite art used by the branch, node and removal renderers. */
  effects: {
    /** Celestial: crystal shards flung out when a node shatters. */
    shards?: string[]
    /** Celestial: sparkle strung along the branches. */
    star?: string
    /** Medieval: cracked-frame fragment overlay. */
    crack?: string
    /** Medieval: ivy leaf scattered along the carved branches. */
    leaf?: string
    /** Medieval: brass plaque behind each name. */
    plaque?: string
    /** Wuxia: red ink slash drawn across a removed node. */
    inkSlash?: string
    /** Wuxia: seal badge behind the surname character. */
    seal?: string
  }

  chrome: {
    defaultTreeName: string
    pills: { all: string; living: string; removed: string }
    nav: NavItem[]
    pillStyle: PillStyle
    /** Medieval: full-screen carved border frame around the whole canvas. */
    borderFrame: boolean
    backLabel?: string
    menuLabel?: string
  }
}

const CELESTIAL: Theme = {
  id: 'celestial',
  name: 'Celestial',
  tagline: 'A constellation of kin, drawn in starlight',
  fonts: {
    title: "'Cormorant Garamond', Georgia, serif",
    body: "'Cormorant Garamond', Georgia, serif",
    titleWeight: 500,
    titleSpacing: '0.02em',
  },
  background: {
    image: asset('celestial', 'background'),
    filter: 'saturate(1.08) brightness(0.9) contrast(1.04)',
    overlay:
      'radial-gradient(120% 70% at 50% 100%, rgba(255,186,110,0.22) 0%, rgba(120,60,180,0.12) 32%, rgba(4,2,14,0.86) 72%), linear-gradient(180deg, rgba(3,2,12,0.94) 0%, rgba(6,3,20,0.42) 26%, rgba(5,2,16,0.55) 70%, rgba(3,1,10,0.9) 100%)',
    base: '#05030f',
    size: 'cover',
  },
  palette: {
    ink: '#f2ecff',
    inkSoft: 'rgba(206,199,232,0.78)',
    accent: '#f2d492',
    accentSoft: 'rgba(242,212,146,0.34)',
    chrome: 'rgba(10,7,26,0.62)',
    chromeBorder: 'rgba(242,212,146,0.32)',
    branch: 'rgba(214,226,255,0.85)',
    branchHighlight: '#ffffff',
    branchGlow: '#8ab4ff',
    removedInk: 'rgba(168,168,182,0.55)',
    removedBranch: 'rgba(150,150,170,0.4)',
    surface: 'rgba(12,9,28,0.94)',
    surfaceBorder: 'rgba(242,212,146,0.28)',
  },
  branch: {
    profile: 'taper',
    // Thin: the Celestial branches read as drawn light, so most of their weight
    // comes from the glow underneath rather than the stroke itself.
    baseWidth: 3.2,
    falloff: 0.84,
    glow: true,
    starPoints: true,
    leaves: false,
    drybrush: false,
  },
  node: {
    radius: 46,
    frame: 'glow-ring',
    // Blue for one side of the family, gold for the other. Purple is held back
    // for the current user, so it never gets handed out as a lineage colour.
    frameAssets: ['ring-blue', 'ring-gold'],
    plaque: false,
    seal: false,
    lineageColors: ['#6f9dff', '#ffc072', '#7ee0d0', '#ff9ad2'],
    selfColor: '#b98cff',
  },
  removal: 'shatter',
  effects: {
    shards: ['shard-1', 'shard-2', 'shard-3', 'shard-4', 'shard-5', 'shard-6', 'shard-7', 'shard-8'],
    star: 'star-2',
  },
  chrome: {
    defaultTreeName: 'My Family Tree',
    pills: { all: 'All', living: 'Living', removed: 'Removed' },
    nav: [
      { key: 'tree', label: 'Tree' },
      { key: 'people', label: 'People' },
      { key: 'more', label: 'More' },
    ],
    pillStyle: 'capsule',
    borderFrame: false,
  },
}

const MEDIEVAL: Theme = {
  id: 'medieval',
  name: 'Medieval',
  tagline: 'A lineage set down in ink and oak',
  fonts: {
    title: "'UnifrakturMaguntia', 'Cinzel', Georgia, serif",
    body: "'Cinzel', Georgia, serif",
    titleWeight: 400,
    titleSpacing: '0.01em',
  },
  background: {
    image: asset('medieval', 'background'),
    filter: 'saturate(1.02) brightness(1.01)',
    overlay:
      'radial-gradient(120% 90% at 50% 40%, rgba(255,246,224,0.14) 0%, rgba(92,63,32,0.14) 58%, rgba(56,36,16,0.4) 100%)',
    base: '#c8ad82',
    size: 'cover',
    borderImage: asset('medieval', 'border-frame'),
  },
  palette: {
    ink: '#3a2a18',
    inkSoft: 'rgba(74,54,34,0.78)',
    accent: '#8a6224',
    accentSoft: 'rgba(138,98,36,0.28)',
    chrome: 'rgba(62,42,24,0.92)',
    chromeBorder: 'rgba(196,158,92,0.55)',
    branch: '#5b4025',
    branchHighlight: '#8a6a41',
    branchGlow: '#2e1f10',
    removedInk: 'rgba(110,104,96,0.7)',
    removedBranch: 'rgba(120,112,100,0.5)',
    surface: '#e7d5ac',
    surfaceBorder: 'rgba(92,62,30,0.55)',
  },
  branch: {
    profile: 'taper',
    baseWidth: 17,
    falloff: 0.8,
    glow: false,
    starPoints: false,
    leaves: true,
    drybrush: false,
  },
  node: {
    radius: 50,
    frame: 'metal',
    // Three cast-metal variants, alternated as people are added so the tree has
    // variety without a bespoke frame per person.
    frameAssets: ['frame-1', 'frame-2', 'frame-3'],
    plaque: true,
    seal: false,
    lineageColors: ['#7c6a4e', '#7c6a4e'],
    selfColor: '#a8863f',
  },
  removal: 'crack-shatter',
  effects: {
    crack: 'crack-overlay',
    leaf: 'leaf-1',
    plaque: 'plaque',
  },
  chrome: {
    defaultTreeName: 'My Family Tree',
    pills: { all: 'All', living: 'Living', removed: 'Removed' },
    nav: [
      { key: 'tree', label: 'Tree' },
      { key: 'people', label: 'People' },
      { key: 'more', label: 'More' },
    ],
    pillStyle: 'shield',
    borderFrame: true,
  },
}

const WUXIA: Theme = {
  id: 'wuxia',
  name: 'Wuxia',
  tagline: '根深叶茂 — deep roots, abundant leaves',
  fonts: {
    title: "'Ma Shan Zheng', 'Noto Serif SC', serif",
    body: "'Noto Serif SC', Georgia, serif",
    titleWeight: 400,
    titleSpacing: '0.06em',
  },
  background: {
    image: asset('wuxia', 'background'),
    filter: 'saturate(0.9) brightness(1.04)',
    overlay:
      'linear-gradient(180deg, rgba(246,244,239,0.72) 0%, rgba(246,244,239,0.3) 24%, rgba(246,244,239,0.24) 58%, rgba(243,240,233,0.66) 100%)',
    base: '#f4f2ec',
    size: 'cover',
  },
  palette: {
    ink: '#1d1d1f',
    inkSoft: 'rgba(45,45,48,0.66)',
    accent: '#a8322a',
    accentSoft: 'rgba(168,50,42,0.18)',
    chrome: 'rgba(248,246,241,0.9)',
    chromeBorder: 'rgba(40,40,44,0.28)',
    branch: '#2b2b2e',
    branchHighlight: '#55555c',
    branchGlow: '#000000',
    removedInk: 'rgba(120,120,124,0.7)',
    removedBranch: 'rgba(130,130,136,0.55)',
    surface: '#f7f5f0',
    surfaceBorder: 'rgba(40,40,44,0.3)',
  },
  branch: {
    profile: 'brush',
    baseWidth: 15,
    falloff: 0.84,
    glow: false,
    starPoints: false,
    leaves: false,
    drybrush: true,
  },
  node: {
    radius: 50,
    frame: 'brush',
    // One hand-painted ensō; variety comes from rotating it per person.
    frameAssets: ['frame-1'],
    plaque: false,
    seal: true,
    lineageColors: ['#25252a', '#25252a'],
    selfColor: '#2f6fa8',
  },
  removal: 'ink-slash',
  effects: {
    inkSlash: 'ink-slash',
    seal: 'seal',
  },
  chrome: {
    defaultTreeName: '家族谱',
    pills: { all: '全部', living: '在世', removed: '已故' },
    nav: [
      { key: 'tree', label: '家族谱' },
      { key: 'people', label: '人物' },
      { key: 'more', label: '更多' },
    ],
    pillStyle: 'ink',
    borderFrame: false,
    backLabel: '返回',
    menuLabel: '菜单',
  },
}

export const THEMES: Record<ThemeId, Theme> = {
  celestial: CELESTIAL,
  medieval: MEDIEVAL,
  wuxia: WUXIA,
}

export const THEME_LIST: Theme[] = [CELESTIAL, MEDIEVAL, WUXIA]

export function getTheme(id: ThemeId | undefined): Theme {
  return THEMES[id ?? 'celestial'] ?? CELESTIAL
}
