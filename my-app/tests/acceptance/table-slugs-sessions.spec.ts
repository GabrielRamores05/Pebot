import { test, expect } from '@playwright/test'

// Acceptance tests for spec 004-table-slugs-sessions.
// Each test maps one-for-one to a criterion in specs/004-table-slugs-sessions/spec.md.

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'test-password'

interface TableRecord {
  id: number
  name: string
  slug: string
  status: string
  currentOccupants: number
  capacity: number
}

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/admin/)
}

async function tables(page: import('@playwright/test').Page): Promise<TableRecord[]> {
  const res = await page.request.get('/api/tables')
  expect(res.ok()).toBeTruthy()
  return res.json()
}

// Find a seeded table by its exact name. Each test uses its own table so the
// tests do not crowd one another's capacity.
async function tableByName(page: import('@playwright/test').Page, name: string): Promise<TableRecord> {
  const all = await tables(page)
  const table = all.find((t) => t.name === name)
  expect(table, `expected a seeded table named ${name}`).toBeTruthy()
  return table!
}

// Pick a product that is available for ordering and has an inventory record.
async function pickProduct(page: import('@playwright/test').Page): Promise<string> {
  const res = await page.request.get('/api/products')
  const list: { name: string; available?: boolean; inventory?: { quantity: number } | null }[] = await res.json()
  const product = list.find((p) => p.inventory && p.available !== false)
  expect(product, 'expected at least one available product with inventory').toBeTruthy()
  return product!.name
}

// Remember a loyalty name on the device before any navigation, so the menu's
// table check-in uses that name as the guest.
async function setCustomerName(page: import('@playwright/test').Page, name: string) {
  await page.addInitScript((n) => window.localStorage.setItem('loyaltyCustomerName', n), name)
}

// Place a QR-menu order from a table's slug link. Waits for the check-in to
// finish so the device remembers its visit before the order is placed. Returns
// the order number.
async function placeTableOrder(page: import('@playwright/test').Page, table: TableRecord, productName: string): Promise<string> {
  await page.goto(`/menu?table=${encodeURIComponent(table.slug)}`)
  await expect(page.getByText(/ordering from/i)).toBeVisible()
  // The check-in stores the visit on the device. A returning device keeps its
  // visit, so this resolves immediately for the second order in a test.
  await page.waitForFunction(() => !!window.localStorage.getItem('cafe_table_session_id'))
  await page.getByRole('button', { name: `Add ${productName} to cart` }).click()
  await page.getByRole('link', { name: /cart/i }).click()
  await page.waitForURL(/\/cart/)
  await page.getByRole('button', { name: /place order|checkout|apply/i }).last().click()
  await page.waitForURL(/\/order\//)
  return page.url().split('/').pop()!
}

// Read an order's details, including the visit it belongs to.
async function orderDetails(page: import('@playwright/test').Page, orderNumber: string): Promise<{ sessionId: number | null; orderNumber: string }> {
  const res = await page.request.get(`/api/orders/${orderNumber}`)
  expect(res.ok()).toBeTruthy()
  return res.json()
}

test('QR order is linked to the table visit', async ({ page }) => {
  await setCustomerName(page, 'First Visit Customer')
  const table = await tableByName(page, 'Table 1')
  const productName = await pickProduct(page)

  const orderNumber = await placeTableOrder(page, table, productName)

  // The order remembers the visit it belongs to.
  const order = await orderDetails(page, orderNumber)
  expect(order.sessionId).toBeTruthy()

  // Staff can see it on the tables screen under this table's visit.
  await signInAsAdmin(page)
  await page.goto('/admin/tables')
  const card = page.locator('div').filter({ hasText: 'Table 1' }).filter({ hasText: orderNumber }).last()
  await expect(card).toBeVisible()
  await expect(page.getByText("This Visit's Orders")).toBeVisible()
})

test('a refresh keeps the same visit', async ({ page }) => {
  await setCustomerName(page, 'Refresh Customer')
  const table = await tableByName(page, 'Table 2')
  const productName = await pickProduct(page)

  const first = await placeTableOrder(page, table, productName)
  // Return to the same table after the phone refreshes.
  const second = await placeTableOrder(page, table, productName)

  const firstOrder = await orderDetails(page, first)
  const secondOrder = await orderDetails(page, second)
  expect(firstOrder.sessionId).toBeTruthy()
  expect(secondOrder.sessionId).toBe(firstOrder.sessionId)
})

test('tables screen shows the visit orders together', async ({ page }) => {
  await setCustomerName(page, 'Group Customer')
  const table = await tableByName(page, 'Table 3')
  const productName = await pickProduct(page)

  const first = await placeTableOrder(page, table, productName)
  const second = await placeTableOrder(page, table, productName)

  // Both orders are part of the same visit.
  expect((await orderDetails(page, second)).sessionId).toBe((await orderDetails(page, first)).sessionId)

  await signInAsAdmin(page)
  await page.goto('/admin/tables')
  const card = page.locator('div').filter({ hasText: 'Table 3' }).filter({ hasText: first }).filter({ hasText: second }).last()
  await expect(card).toBeVisible()
})

test('renaming a table keeps its QR working', async ({ page }) => {
  const table = await tableByName(page, 'Table 4')

  // The QR link carries the table's permanent slug.
  const qrRes = await page.request.get(`/api/tables/qr?tableId=${table.id}`)
  expect(qrRes.ok()).toBeTruthy()
  const qr = await qrRes.json()
  expect(qr.menuUrl).toContain(`table=${encodeURIComponent(table.slug)}`)

  // Rename the table in the admin.
  await signInAsAdmin(page)
  const patch = await page.request.patch('/api/tables', { data: { id: table.id, name: 'Table 4 Renamed' } })
  expect(patch.ok()).toBeTruthy()

  // The same QR link still opens the table under its new name.
  await page.goto(`/menu?table=${encodeURIComponent(table.slug)}`)
  await expect(page.getByText(/ordering from Table 4 Renamed/i)).toBeVisible()
})

test('a new group starts a fresh visit', async ({ browser }) => {
  const contextA = await browser.newContext()
  const pageA = await contextA.newPage()
  await setCustomerName(pageA, 'First Group Customer')
  const table = await tableByName(pageA, 'Table 5')
  const productName = await pickProduct(pageA)
  const orderA = await placeTableOrder(pageA, table, productName)

  // A second device scans the same table QR — a different group.
  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await setCustomerName(pageB, 'Second Group Customer')
  const orderB = await placeTableOrder(pageB, table, productName)

  const visitA = await orderDetails(pageA, orderA)
  const visitB = await orderDetails(pageB, orderB)
  expect(visitA.sessionId).toBeTruthy()
  expect(visitB.sessionId).toBeTruthy()
  // The second group's orders belong to a fresh visit, never the first's.
  expect(visitB.sessionId).not.toBe(visitA.sessionId)

  await contextA.close()
  await contextB.close()
})