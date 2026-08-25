import { test, expect } from '@playwright/test'

// Acceptance tests for spec 005-kitchen-customer-messages.
// Each test maps one-for-one to a criterion in specs/005-kitchen-customer-messages/spec.md.

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'test-password'

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/admin/)
}

// Remember a loyalty name on the device before any navigation, so the menu uses
// that name as the guest.
async function setCustomerName(page: import('@playwright/test').Page, name: string) {
  await page.addInitScript((n) => window.localStorage.setItem('loyaltyCustomerName', n), name)
}

// Pick a product that is available for ordering and has an inventory record.
async function pickProduct(page: import('@playwright/test').Page): Promise<string> {
  const res = await page.request.get('/api/products')
  const list: { name: string; available?: boolean; inventory?: { quantity: number } | null }[] = await res.json()
  const product = list.find((p) => p.inventory && p.available !== false)
  expect(product, 'expected at least one available product with inventory').toBeTruthy()
  return product!.name
}

// Place a QR-menu order and return its order number.
async function placeQrOrder(page: import('@playwright/test').Page): Promise<string> {
  const productName = await pickProduct(page)
  await page.goto('/menu')
  await page.getByRole('button', { name: `Add ${productName} to cart` }).click()
  await page.getByRole('link', { name: /cart/i }).click()
  await page.waitForURL(/\/cart/)
  await page.getByRole('button', { name: /place order|checkout|apply/i }).last().click()
  await page.waitForURL(/\/order\//)
  return page.url().split('/').pop()!
}

// Send a text message as the customer on their order page.
async function sendCustomerMessage(page: import('@playwright/test').Page, message: string) {
  await page.getByPlaceholder(/follow-up message/i).fill(message)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText(message)).toBeVisible()
}

// Open the message thread for an order from its card on the kitchen screen.
async function openThread(page: import('@playwright/test').Page, orderNumber: string) {
  const card = page.locator('div').filter({ hasText: orderNumber }).first()
  await card.getByRole('button', { name: /message/i }).click()
}

test('customer message appears on the kitchen screen', async ({ page }) => {
  await setCustomerName(page, 'Message Customer')
  const orderNumber = await placeQrOrder(page)

  await sendCustomerMessage(page, 'Please no ice in my drink')

  // The kitchen screen shows the customer's words with the order.
  await signInAsAdmin(page)
  await page.goto('/kitchen')
  const card = page.locator('div').filter({ hasText: orderNumber }).first()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Please no ice in my drink')
})

test('kitchen reply reaches the customer order page', async ({ page }) => {
  await setCustomerName(page, 'Reply Customer')
  const orderNumber = await placeQrOrder(page)

  await sendCustomerMessage(page, 'Can I get extra ketchup?')

  // The kitchen reads the message and types a reply.
  await signInAsAdmin(page)
  await page.goto('/kitchen')
  await openThread(page, orderNumber)
  await page.getByPlaceholder(/reply as/i).fill('Sure, we will add extra ketchup')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Sure, we will add extra ketchup')).toBeVisible()

  // The customer sees the reply on their order page.
  await page.goto(`/order/${orderNumber}`)
  await expect(page.getByText('Sure, we will add extra ketchup')).toBeVisible()
})

test('kitchen can play a customer voice message', async ({ page }) => {
  await setCustomerName(page, 'Voice Customer')
  const orderNumber = await placeQrOrder(page)

  // Post a voice message through the API (the recording UI needs a microphone).
  const res = await page.request.post(`/api/orders/${orderNumber}/messages`, {
    data: { type: 'voice', content: '/uploads/test-voice.webm', sender: 'Voice Customer' },
  })
  expect(res.ok()).toBeTruthy()

  // The kitchen thread offers an audio player for it.
  await signInAsAdmin(page)
  await page.goto('/kitchen')
  await openThread(page, orderNumber)
  await expect(page.locator('audio[controls]')).toBeVisible()
})

test('unanswered message marks the kitchen order card', async ({ page }) => {
  await setCustomerName(page, 'Waiting Customer')
  const orderNumber = await placeQrOrder(page)

  await sendCustomerMessage(page, 'Where is my order?')

  // The card is flagged as having a message waiting for an answer.
  await signInAsAdmin(page)
  await page.goto('/kitchen')
  const card = page.locator('div').filter({ hasText: orderNumber }).first()
  await expect(card).toContainText(/waiting/i)
})

test('kitchen thread shows the whole conversation in order', async ({ page }) => {
  await setCustomerName(page, 'Thread Customer')
  const orderNumber = await placeQrOrder(page)

  await sendCustomerMessage(page, 'First question')
  await sendCustomerMessage(page, 'Second question')

  await signInAsAdmin(page)
  await page.goto('/kitchen')
  await openThread(page, orderNumber)

  // Both customer messages are in the thread, in the order they were sent.
  await expect(page.getByText('First question')).toBeVisible()
  await expect(page.getByText('Second question')).toBeVisible()
})
