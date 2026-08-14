/**
 * Drives the built app in a real browser and captures each theme, so the
 * rendered tree can be compared against the reference mockups.
 *
 * Usage: node scripts/screenshot.mjs <baseUrl> <outDir>
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const baseUrl = process.argv[2] ?? 'http://localhost:4173'
const outDir = process.argv[3] ?? 'shots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 470, height: 940 },
  deviceScaleFactor: 2,
})

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.screenshot({ path: `${outDir}/00-landing.png` })

// Create a demo tree; the landing form starts on "Create a tree".
await page.getByRole('button', { name: 'Plant this tree' }).click()
await page.waitForSelector('.tree-canvas .person-node', { timeout: 15000 })
await page.waitForTimeout(2200)
await page.screenshot({ path: `${outDir}/01-celestial.png` })

// Person card
await page.locator('.person-node').first().click()
await page.waitForTimeout(700)
await page.screenshot({ path: `${outDir}/02-person-card.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// Theme switching through the settings sheet
for (const [theme, shot] of [
  ['Medieval', '03-medieval'],
  ['Wuxia', '04-wuxia'],
]) {
  await page.locator('.topbar .icon-btn').last().click()
  await page.waitForTimeout(500)
  await page.locator('.theme-card', { hasText: theme }).click()
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${outDir}/${shot}.png` })
}

// Add-relative modal
await page.locator('.fab').click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${outDir}/05-add-relative.png` })
await page.keyboard.press('Escape')

await browser.close()

if (errors.length) {
  console.log('CONSOLE ERRORS:')
  for (const e of [...new Set(errors)].slice(0, 20)) console.log('  -', e)
} else {
  console.log('No console errors.')
}
