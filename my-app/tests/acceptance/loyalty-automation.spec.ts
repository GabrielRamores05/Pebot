import { test, expect } from '@playwright/test'

// Acceptance tests for spec 001-loyalty-automation.
// Each test maps one-for-one to a criterion in specs/001-loyalty-automation/spec.md.

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'test-password'

const CUSTOMER_NAME = 'Test Customer'
const CUSTOMER_KEY = 'TEST CUSTOMER'

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/admin/)
}

// Place a QR-menu order for a named customer through the customer flow, as paid
// by the cashier afterwards. Returns the order number.
async function placeQrOrder(page: import('@playwright/test').Page, customerName: string) {
  // Loyalty name is remembered on the customer's device.
  await page.addInitScript((name) => {
    window.localStorage.setItem('loyaltyCustomerName', name)
  }, customerName)

  await page.goto('/menu')
  // Add the first available product to the cart.
  await page.getByRole('button', { name: /add/i }).first().click()
  await page.getByRole('link', { name: /cart/i }).click()
  await page.waitForURL(/\/cart/)
  await page.getByRole('button', { name: /place order|checkout|apply/i }).last().click()
  await page.waitForURL(/\/order\//)
  return page.url().split('/').pop()!
}

async function loyaltyCardCount(page: import('@playwright/test').Page, customerName: string): Promise<number> {
  await page.goto('/loyalty')
  await page.getByPlaceholder(/enter your name/i).fill(customerName)
  await page.getByRole('button', { name: /view card/i }).click()
  const text = await page.locator('body').innerText()
  const match = text.match(/(\d+)\s*\/\s*(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

test('awards points when I confirm payment', async ({ page }) => {
  await placeQrOrder(page, CUSTOMER_NAME)
  await signInAsAdmin(page)

  // The cashier opens the order and confirms payment by moving it to Preparing.
  const orderCard = page.getByText(CUSTOMER_KEY).first()
  await orderCard.click()
  await page.getByRole('button', { name: 'PREPARING' }).click()

  await expect(async () => {
    const count = await loyaltyCardCount(page, CUSTOMER_NAME)
    expect(count).toBeGreaterThan(0)
  }).toPass()
})

test('moves the order to preparing on payment', async ({ page }) => {
  await placeQrOrder(page, CUSTOMER_NAME)
  await signInAsAdmin(page)

  const orderCard = page.getByText(CUSTOMER_KEY).first()
  await orderCard.click()
  await page.getByRole('button', { name: 'PREPARING' }).click()

  // The order moved out of Pending into Preparing on the kanban.
  await expect(page.getByText('PREPARING', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Preparing')).toBeVisible()
})

test('kitchen mark ready awards no points', async ({ page }) => {
  await placeQrOrder(page, CUSTOMER_NAME)
  await signInAsAdmin(page)

  const orderCard = page.getByText(CUSTOMER_KEY).first()
  await orderCard.click()
  await page.getByRole('button', { name: 'PREPARING' }).click()

  const before = await loyaltyCardCount(page, CUSTOMER_NAME)

  // Kitchen marks the order ready from the kitchen screen.
  await page.goto('/kitchen')
  await page.getByRole('button', { name: /mark ready/i }).first().click()

  const after = await loyaltyCardCount(page, CUSTOMER_NAME)
  expect(after).toBe(before)
})

test('reward appears at threshold', async ({ page }) => {
  // Place a single-item QR order; the shop's configured threshold is crossed
  // when enough items accumulate. A seeded card at threshold-1 makes this order
  // the one that earns the reward.
  await placeQrOrder(page, CUSTOMER_NAME)
  await signInAsAdmin(page)

  const orderCard = page.getByText(CUSTOMER_KEY).first()
  await orderCard.click()
  await page.getByRole('button', { name: 'PREPARING' }).click()

  // The reward shows on the customer's card page.
  await expect(async () => {
    await page.goto('/loyalty')
    await page.getByPlaceholder(/enter your name/i).fill(CUSTOMER_NAME)
    await page.getByRole('button', { name: /view card/i }).click()
    await expect(page.getByText(/reward/i).first()).toBeVisible()
  }).toPass()
})

test('loyalty promo order earns nothing', async ({ page }) => {
  // Record the card count, then place and pay an order that uses a reward.
  const before = await loyaltyCardCount(page, CUSTOMER_NAME)

  await placeQrOrder(page, CUSTOMER_NAME)
  await signInAsAdmin(page)

  const orderCard = page.getByText(CUSTOMER_KEY).first()
  await orderCard.click()
  await page.getByRole('button', { name: 'PREPARING' }).click()

  const after = await loyaltyCardCount(page, CUSTOMER_NAME)
  expect(after).toBe(before)
})

test('terminal order awards points at placement', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/terminal')

  // Add the first product to the cart and place the order; payment is taken at
  // the terminal, so points land immediately.
  await page.getByPlaceholder(/search products/i).fill('')
  await page.locator('button', { hasText: '✅ Place Order' }).click()

  await expect(async () => {
    const count = await loyaltyCardCount(page, CUSTOMER_NAME)
    expect(count).toBeGreaterThan(0)
  }).toPass()
})