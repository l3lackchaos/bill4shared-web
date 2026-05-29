import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import { join } from 'path'

const BASE = 'http://localhost:3000'
const SHOTS = join(process.cwd(), 'test-screenshots')
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oYmVwZ3JjaW5oamR2d2V1d3ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc3MDM2MywiZXhwIjoyMDk1MzQ2MzYzfQ.YA4KzFUTsxG-4tlMy7TTWdox_eqsXuSDwry0Afug4ZQ'
const SUPA = 'https://ohbepgrcinhjdvweuwym.supabase.co'

await mkdir(SHOTS, { recursive: true })

async function supa(path, method = 'GET', body) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SK,
      'Authorization': `Bearer ${SK}`,
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return r.json()
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()

const errors = []
page.on('response', r => { if (r.status() >= 500) errors.push(`[${r.status()}] ${r.url()}`) })
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))

async function shot(name) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true })
  console.log(`  ✓ screenshot: ${name}`)
}

// ─── Test 1: Home page ─────────────────────────────────────
console.log('\n=== Test 1: Home page ===')
await page.goto(BASE, { waitUntil: 'networkidle' })
await shot('01-home')
const sessionCount = await page.locator('a[href^="/session/"]').count()
console.log(`  Sessions listed: ${sessionCount}`)

// ─── Test 2: Create session → upload page ──────────────────
console.log('\n=== Test 2: Create session ===')
await page.goto(`${BASE}/new`)
await shot('02-new')
await page.click('text=สร้างบิลและอัปโหลดรูป')
await page.waitForURL('**/upload', { timeout: 8000 })
const sessionId = page.url().split('/session/')[1]?.split('/')[0]
console.log(`  Session ID: ${sessionId}`)
await shot('03-upload')

// ─── Test 3: Session redirect ──────────────────────────────
console.log('\n=== Test 3: Session redirect ===')
await page.goto(`${BASE}/session/${sessionId}`, { waitUntil: 'networkidle' })
const redirectedTo = page.url()
console.log(`  Redirected to: ${redirectedTo}`)
const redirectOk = redirectedTo.includes('/upload')
console.log(`  Redirect to /upload: ${redirectOk ? '✓' : '✗ FAIL'}`)

// ─── Test 4: group_order Confirm → Summary ─────────────────
console.log('\n=== Test 4: group_order Confirm → Summary ===')

// Create a fresh group_order session with pre-assigned items
const [newSession] = await supa('sessions', 'POST', {
  status: 'confirming',
  bill_type: 'group_order',
  split_mode: 2,
  food_subtotal: 266,
  delivery_fee: 0,
  total_discount: 0,
  grand_total: 266,
})
const groupId = newSession.id
console.log(`  Group session: ${groupId}`)

await supa('items', 'POST', [
  { session_id: groupId, name: 'โยเกิร์ตรสต้นตำรับ', unit_price: 59, quantity: 1, pre_assigned_name: 'Benz' },
  { session_id: groupId, name: 'โยเกิร์ตบุกน้ำผึ้ง', unit_price: 69, quantity: 1, pre_assigned_name: 'FIW' },
  { session_id: groupId, name: 'โยเกิร์ตปีโป้', unit_price: 69, quantity: 1, pre_assigned_name: 'FIW' },
  { session_id: groupId, name: 'โยเกิร์ตน้ำผึ้ง', unit_price: 69, quantity: 1, pre_assigned_name: 'Sine' },
])

await page.goto(`${BASE}/session/${groupId}/confirm`, { waitUntil: 'networkidle' })
await shot('04-confirm-group-order')
const itemCount = await page.locator('.divide-y > div').count()
console.log(`  Items shown: ${itemCount}`)

await page.click('text=ยืนยัน → ดูสรุป')
await page.waitForURL('**/summary', { timeout: 10000 })
await shot('05-summary-group-order')

const amountEls = await page.locator('.text-xl.font-bold.text-indigo-600').count()
console.log(`  Person amount cards: ${amountEls} (expected 3)`)
const summaryText = await page.textContent('body')
const hasBenz = summaryText.includes('Benz')
const hasFIW = summaryText.includes('FIW')
const hasSine = summaryText.includes('Sine')
console.log(`  Persons: Benz=${hasBenz} FIW=${hasFIW} Sine=${hasSine}`)

// ─── Test 5: physical bill assign → summary ────────────────
console.log('\n=== Test 5: Physical bill assign → summary ===')
const [physSession] = await supa('sessions', 'POST', {
  status: 'assigning',
  bill_type: 'physical',
  split_mode: 2,
  food_subtotal: 320,
  delivery_fee: 40,
  total_discount: 0,
  grand_total: 360,
})
const physId = physSession.id
const physItems = await supa('items', 'POST', [
  { session_id: physId, name: 'ข้าวผัดกุ้ง', unit_price: 120, quantity: 1, pre_assigned_name: null },
  { session_id: physId, name: 'ต้มยำกุ้ง', unit_price: 150, quantity: 1, pre_assigned_name: null },
  { session_id: physId, name: 'น้ำส้ม', unit_price: 25, quantity: 2, pre_assigned_name: null },
])

await page.goto(`${BASE}/session/${physId}/assign`, { waitUntil: 'networkidle' })
await shot('06-assign-items')

const inputs = page.locator('input[placeholder="ชื่อ..."]')
await inputs.nth(0).fill('อ้อ'); await inputs.nth(0).press('Enter')
await inputs.nth(1).fill('เต้'); await inputs.nth(1).press('Enter')
await inputs.nth(1).fill('อ้อ'); await inputs.nth(1).press('Enter')
await inputs.nth(2).fill('อ้อ'); await inputs.nth(2).press('Enter')
await shot('07-assign-filled')

await page.click('text=คำนวณบิล')
await page.waitForURL('**/summary', { timeout: 10000 })
await shot('08-summary-physical')

const physText = await page.textContent('body')
console.log(`  อ้อ in summary: ${physText.includes('อ้อ')}`)
console.log(`  เต้ in summary: ${physText.includes('เต้')}`)

// ─── Test 6: Copy button ───────────────────────────────────
console.log('\n=== Test 6: Copy button ===')
const copyExists = await page.locator('text=คัดลอกสรุป').count()
console.log(`  Copy button: ${copyExists > 0 ? '✓' : '✗ FAIL'}`)

// ─── Results ───────────────────────────────────────────────
await browser.close()

const failures = [
  !redirectOk && 'Session redirect to /upload failed',
  amountEls < 2 && 'group_order summary missing person cards',
  !hasBenz && 'Benz not in summary',
  !physText.includes('อ้อ') && 'อ้อ not in physical summary',
  copyExists === 0 && 'Copy button missing',
].filter(Boolean)

if (errors.length > 0 || failures.length > 0) {
  if (errors.length) { console.log('\nServer errors:'); errors.forEach(e => console.log(' -', e)) }
  if (failures.length) { console.log('\nTest failures:'); failures.forEach(f => console.log(' -', f)) }
  process.exit(1)
} else {
  console.log('\n✅ All tests passed.')
}
