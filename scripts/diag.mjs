import { chromium } from 'playwright'

const browser = await chromium.launch()

// Author: create the tree.
const author = await browser.newContext({ viewport: { width: 470, height: 940 } })
const a = await author.newPage()
await a.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' })
await a.getByRole('button', { name: 'Plant this tree' }).click()
await a.waitForSelector('.person-node', { timeout: 20000 })
await a.waitForTimeout(1200)
const url = a.url()
console.log('tree url:', url)

// Same tab, genuine reload.
await a.reload({ waitUntil: 'domcontentloaded' })
await a.waitForSelector('.person-node', { timeout: 20000 })
await a.waitForTimeout(1200)
await a.locator('.topbar .icon-btn').last().click()
await a.waitForTimeout(800)
const sameTab = await a.locator('.settings-section').nth(2).innerText()
console.log('after reload, same tab :', JSON.stringify(sameTab.replace(/\s+/g, ' ').slice(0, 90)))

// A different visitor opening the shared link.
const visitor = await browser.newContext({ viewport: { width: 470, height: 940 } })
const v = await visitor.newPage()
await v.goto(url, { waitUntil: 'domcontentloaded' })
await v.waitForSelector('.person-node', { timeout: 20000 })
await v.waitForTimeout(1200)
console.log('visitor sees nodes  :', await v.locator('.person-node').count())
await v.locator('.topbar .icon-btn').last().click()
await v.waitForTimeout(800)
const other = await v.locator('.settings-section').nth(2).innerText()
console.log('visitor edit access :', JSON.stringify(other.replace(/\s+/g, ' ').slice(0, 90)))

await browser.close()
