/**
 * Confirms a deployment is really talking to Firestore rather than silently
 * falling back to browser-local storage: creates a tree in the browser, then
 * looks that exact tree id up through the Firestore REST API.
 *
 * Usage: node scripts/verify-backend.mjs <baseUrl> <firebaseApiKey> <projectId>
 */
import { chromium } from 'playwright'

const [baseUrl, apiKey, projectId] = process.argv.slice(2)
if (!baseUrl || !apiKey || !projectId) {
  console.error('usage: verify-backend.mjs <baseUrl> <apiKey> <projectId>')
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 470, height: 940 } })
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: 'Plant this tree' }).click()
await page.waitForSelector('.person-node', { timeout: 20000 })
await page.waitForTimeout(2500)

const treeId = (page.url().match(/#\/tree\/([\w-]+)/) ?? [])[1]
console.log('created tree:', treeId)

await page.locator('.topbar .icon-btn').last().click()
await page.waitForTimeout(800)
const storage = (await page.locator('.settings-section').last().innerText()).replace(/\s+/g, ' ')
console.log('app reports :', JSON.stringify(storage.slice(0, 110)))
await browser.close()

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/trees/${treeId}`
const treeRes = await fetch(`${base}?key=${apiKey}`)
console.log('firestore tree doc      :', treeRes.status === 200 ? 'FOUND' : `MISSING (${treeRes.status})`)

const peopleRes = await fetch(`${base}/people?key=${apiKey}&pageSize=100`)
const people = await peopleRes.json()
console.log('firestore people count  :', people.documents?.length ?? 0)

const relRes = await fetch(`${base}/relationships?key=${apiKey}&pageSize=200`)
const rels = await relRes.json()
console.log('firestore relationships :', rels.documents?.length ?? 0)

const ok = treeRes.status === 200 && (people.documents?.length ?? 0) === 14
console.log(ok ? '\nPASS — deployment is persisting to Firestore' : '\nFAIL — not reaching Firestore')
console.log('cleanup id:', treeId)
