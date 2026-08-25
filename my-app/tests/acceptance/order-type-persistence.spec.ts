import { test, expect } from '@playwright/test'

// Acceptance tests for spec 003-order-type-persistence.
// Each test maps one-for-one to a criterion in specs/003-order-type-persistence/spec.md.

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'test-password'

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/admin/)
}

// Place an order from the counter terminal, choosing the order type and an
// optional delivery address. Payment is G-Cash so no cash calculator is needed.
// Returns the order number from the receipt.
async function placeTerminalOrder(
  page: import('@playwright/test').Page,
  orderType: 'Dine-in' | 'Takeout' | 'Delivery',
  deliveryAddress?: string,
) {
  await page.goto('/admin/terminal')
  await page.getByRole('button', { name: /g-cash/i }).click()
  await page.getByRole('button', { name: orderType, exact: true }).click()

  if (orderType === 'Delivery' && deliveryAddress) {
    await page.getByPlaceholder(/house number|street|landmark/i).fill(deliveryAddress)
  }

  // Add the first product on the counter to the cart.
  await page.locator('button').filter({ has: page.locator('p') }).filter({ hasText: /₱/ }).first().click()

  await page.getByRole('button', { name: /place order/i }).click()

  // Wait for the receipt, then read the order number off it.
  await expect(page.getByText('Order placed')).toBeVisible()
  const receiptText = await page.getByText(/ORD-\d{8}-\d{6}/).first().innerText()
  return receiptText.match(/ORD-\d{8}-\d{6}/)![0]
}

// Place a QR-menu order (customer flow, table only — no order type chosen).
async function placeQrOrder(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/menu')
  await page.getByRole('button', { name: /add/i }).first().click()
  await page.getByRole('link', { name: /cart/i }).click()
  await page.waitForURL(/\/cart/)
  await page.getByRole('button', { name: /place order|checkout|apply/i }).last().click()
  await page.waitForURL(/\/order\//)
  return page.url().split('/').pop()!
}

test('dine-in order is saved and shown as dine-in', async ({ page }) => {
  await signInAsAdmin(page)
  const orderNumber = await placeTerminalOrder(page, 'Dine-in')

  // The kitchen shows the order as dine-in.
  await page.goto('/admin/kitchen')
  const card = page.locator('div').filter({ hasText: orderNumber }).first()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Dine-in')
})

test('takeout order is saved and shown as takeout', async ({ page }) => {
  await signInAsAdmin(page)
  const orderNumber = await placeTerminalOrder(page, 'Takeout')

  // The kitchen shows the order as takeout.
  await page.goto('/admin/kitchen')
  const card = page.locator('div').filter({ hasText: orderNumber }).first()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Takeout')
})

test('delivery order keeps its address on the kitchen and the customer page', async ({ page }) => {
  await signInAsAdmin(page)
  const address = '12 Maginhawa St, Quezon City'
  const orderNumber = await placeTerminalOrder(page, 'Delivery', address)

  // The kitchen shows the order as delivery with the address.
  await page.goto('/admin/kitchen')
  const card = page.locator('div').filter({ hasText: orderNumber }).first()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Delivery')
  await expect(card).toContainText(address)

  // The customer's order page shows the delivery address.
  await page.goto(`/order/${orderNumber}`)
  await expect(page.getByText('Delivery').first()).toBeVisible()
  await expect(page.getByText(address).first()).toBeVisible()
})

test('delivery order is refused without an address', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/terminal')
  await page.getByRole('button', { name: /g-cash/i }).click()
  await page.getByRole('button', { name: 'Delivery', exact: true }).click()

  await page.locator('button').filter({ has: page.locator('p') }).filter({ hasText: /₱/ }).first().click()

  await page.getByRole('button', { name: /place order/i }).click()

  // The order is refused and the cashier is told to enter an address.
  await expect(page.getByText(/delivery address/i)).toBeVisible()
  await expect(page.getByText('Order placed')).not.toBeVisible()
})

test('order type is shown on the receipt and the customer order page', async ({ page }) => {
  await signInAsAdmin(page)
  const orderNumber = await placeTerminalOrder(page, 'Takeout')

  // The receipt shows the order type.
  await expect(page.getByText('Takeout').first()).toBeVisible()

  // The customer's order page shows the order type too.
  await page.goto(`/order/${orderNumber}`)
  await expect(page.getByText('Order type')).toBeVisible()
  await expect(page.getByText('Takeout').first()).toBeVisible()
})

test('QR-menu order is labelled dine-in', async ({ page }) => {
  const orderNumber = await placeQrOrder(page)

  // No order type was chosen by the customer, so the order is counted as dine-in.
  await page.goto(`/order/${orderNumber}`)
  await expect(page.getByText('Order type')).toBeVisible()
  await expect(page.getByText('Dine-in').first()).toBeVisible()
})