/**
 * End-to-end check of the flows that matter: create a tree, grow a branch,
 * soft-remove a relative, restore, hard-prune, and reload to prove persistence.
 *
 * Usage: node scripts/smoke.mjs <baseUrl> <outDir>
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const baseUrl = process.argv[2] ?? 'http://localhost:4173'
const outDir = process.argv[3] ?? 'shots'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 470, height: 940 }, deviceScaleFactor: 2 })

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

const nodeCount = () => page.locator('.person-node').count()
const check = (label, ok, detail = '') =>
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
// Grab the generated passcode before planting, to test unlocking later.
const passcode = await page.locator('.copy-row input').first().inputValue()
await page.getByRole('button', { name: 'Plant this tree' }).click()
await page.waitForSelector('.person-node', { timeout: 15000 })
await page.waitForTimeout(1500)

const treeUrl = page.url()
const startCount = await nodeCount()
check('demo tree renders', startCount === 14, `${startCount} nodes`)

// ---- add a relative -------------------------------------------------------
await page.locator('.person-node').filter({ hasText: 'Sarah' }).first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Add a relative here' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Child', exact: true }).click()
await page.getByPlaceholder('Full name').fill('Nora')
await page.getByPlaceholder('1962').fill('1994')
await page.getByRole('button', { name: 'Grow branch' }).click()
await page.waitForTimeout(1800)

const afterAdd = await nodeCount()
check('add relative grows a branch', afterAdd === startCount + 1, `${afterAdd} nodes`)
await page.screenshot({ path: `${outDir}/10-after-add.png` })

// ---- soft remove ----------------------------------------------------------
await page.locator('.person-node').filter({ hasText: 'Nora' }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Remove this relative' }).click()
await page.waitForTimeout(1600)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

const removedNodes = await page.locator('.person-node.is-removed').count()
check('soft remove keeps the node, marked removed', removedNodes >= 2, `${removedNodes} removed`)
check('nothing deleted by soft remove', (await nodeCount()) === afterAdd)
await page.screenshot({ path: `${outDir}/11-soft-removed.png` })

// ---- persistence across reload -------------------------------------------
// reload(), not goto(): navigating to the identical URL is a same-document
// fragment navigation, which would leave the store — and its edit rights — intact.
void treeUrl
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.person-node', { timeout: 15000 })
await page.waitForTimeout(1200)
check('tree persists across reload', (await nodeCount()) === afterAdd, `${await nodeCount()} nodes`)

// A reloaded viewer is read-only until the passcode is entered.
await page.locator('.person-node').filter({ hasText: 'Nora' }).first().click()
await page.waitForTimeout(400)
const editVisible = await page.getByRole('button', { name: 'Remove this relative' }).isVisible().catch(() => false)
const lockNotice = await page.getByText('You are viewing this tree').isVisible().catch(() => false)
check('reloaded viewer is read-only', !editVisible && lockNotice)
await page.keyboard.press('Escape')

// ---- unlock with the passcode, then restore and hard prune ---------------
await page.locator('.topbar .icon-btn').last().click()
await page.waitForTimeout(500)
await page.getByLabel('Edit passcode').fill(passcode)
await page.getByRole('button', { name: 'Unlock' }).click()
await page.waitForTimeout(600)
const unlocked = await page.getByText('unlocked for editing').isVisible().catch(() => false)
check('correct passcode unlocks editing', unlocked)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

await page.locator('.person-node').filter({ hasText: 'Nora' }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Regrow this branch' }).click()
await page.waitForTimeout(1600)
check('restore brings the branch back', (await page.locator('.person-node.is-removed').count()) === 1)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// Remove again, then prune for good.
await page.locator('.person-node').filter({ hasText: 'Nora' }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Remove this relative' }).click()
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'Prune permanently…' }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Prune permanently', exact: true }).click()
await page.waitForTimeout(2000)
const afterPrune = await nodeCount()
check('hard prune deletes the person', afterPrune === afterAdd - 1, `${afterPrune} nodes`)
await page.screenshot({ path: `${outDir}/12-after-prune.png` })

await browser.close()

if (errors.length) {
  console.log('\nCONSOLE ERRORS:')
  for (const e of [...new Set(errors)].slice(0, 20)) console.log('  -', e)
} else {
  console.log('\nNo console errors.')
}
