import { test, expect } from '@playwright/test'

// Acceptance tests for the Recipe/BOM inventory model.
// Stock is sourced from INGREDIENTS (shared pool). A product's "sellable
// quantity" is calculated = floor(min over REQUIRED ingredients of
// currentStock / perProductQty). Optional ingredients never block.
// Each product must have a recipe (ProductIngredient) — see prisma/seed.ts.

const ADMIN_EMAIL = 'admin@cafeos.local'
const ADMIN_PASSWORD = 'admin123'

const CUSTOMER_NAME = 'Stock Test Customer'

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/admin/)
}

// Products API is public. Returns products with their derived inventory quantity.
async function products(page: import('@playwright/test').Page): Promise<{ id: number; name: string; price: number; available?: boolean; inventory?: { quantity: number; lowStockThreshold: number } | null }[]> {
  const res = await page.request.get('/api/products')
  expect(res.ok()).toBeTruthy()
  return res.json()
}

// Pick a product that is available AND has a recipe (required ingredients).
function pickProduct(list: { id: number; name: string; available?: boolean; inventory?: { quantity: number; lowStockThreshold: number } | null }[]): { id: number; name: string; available?: boolean; inventory?: { quantity: number; lowStockThreshold: number } | null } {
  const product = list.find((p) => p.available !== false && (p.inventory?.quantity ?? 0) > 0)
  expect(product, 'expected at least one available product with recipe stock').toBeTruthy()
  return product!
}

// Set a product's DERIVED sellable quantity to `n` by setting every REQUIRED
// ingredient's currentStock to n * perProductQty (so each yields exactly n
// servings and the min == n). Optional ingredients are left untouched.
async function setSellable(page: import('@playwright/test').Page, productId: number, n: number) {
  const res = await page.request.get(`/api/ingredients/product/${productId}`)
  const recipe: { ingredientId: number; quantity: number; required?: boolean }[] = await res.json()
  for (const pi of recipe) {
    if (pi.required) {
      await page.request.put(`/api/ingredients/${pi.ingredientId}`, { data: { currentStock: Math.max(0, n * pi.quantity) } })
    }
  }
}

// Read the product's current sellable quantity (derived).
async function sellableOf(page: import('@playwright/test').Page, productId: number): Promise<number> {
  const res = await page.request.get(`/api/ingredients/production-capacity?productId=${productId}`)
  const data: { sellable: number }[] = await res.json()
  return data[0]?.sellable ?? 0
}

async function placeQrOrder(page: import('@playwright/test').Page, productName: string) {
  await page.addInitScript((name) => {
    window.localStorage.setItem('loyaltyCustomerName', name)
  }, CUSTOMER_NAME)

  await page.goto('/menu')
  await page.getByRole('button', { name: `Add ${productName} to cart` }).click()
  await page.getByRole('link', { name: /cart/i }).click()
  await page.waitForURL(/\/cart/)
  await page.getByRole('button', { name: /place order|checkout|apply/i }).last().click()
  await page.waitForURL(/\/order\//)
  return page.url().split('/').pop()!
}

async function terminalOrder(page: import('@playwright/test').Page, productName: string, times = 1) {
  await page.goto('/admin/terminal')
  await page.getByRole('button', { name: /g-cash/i }).click()
  const card = page.locator('button', { hasText: productName }).first()
  for (let i = 0; i < times; i++) await card.click()
  await page.getByRole('button', { name: /place order/i }).click()
  await expect(page.getByText('Order placed')).toBeVisible()
}

test('refuses an order that oversells an item', async ({ page }) => {
  await signInAsAdmin(page)
  const list = await products(page)
  const product = pickProduct(list)
  await setSellable(page, product.id, 2)

  await page.goto('/admin/terminal')
  await page.getByRole('button', { name: /g-cash/i }).click()
  const card = page.locator('button', { hasText: product.name }).first()
  for (let i = 0; i < 3; i++) await card.click()
  await page.getByRole('button', { name: /place order/i }).click()

  await expect(page.getByText(/no longer available/i)).toBeVisible()
  await expect(page.getByText(product.name).first()).toBeVisible()
  await expect(page.getByText('Order placed')).not.toBeVisible()
})

test('cannot add an out-of-stock item', async ({ page }) => {
  await signInAsAdmin(page)
  const list = await products(page)
  const product = pickProduct(list)
  await setSellable(page, product.id, 0) // drain the required ingredient(s)

  await page.addInitScript((name) => {
    window.localStorage.setItem('loyaltyCustomerName', name)
  }, CUSTOMER_NAME)
  await page.goto('/menu')

  await expect(page.getByRole('button', { name: `Add ${product.name} to cart` })).toHaveCount(0)
  await expect(page.getByText('Sold out').first()).toBeVisible()
})

test('second order refused once the last is sold', async ({ page }) => {
  await signInAsAdmin(page)
  const list = await products(page)
  const product = pickProduct(list)
  await setSellable(page, product.id, 1)

  await placeQrOrder(page, product.name)

  expect(await sellableOf(page, product.id)).toBe(0)
  await page.goto('/menu')
  await expect(page.getByRole('button', { name: `Add ${product.name} to cart` })).toHaveCount(0)
})

test('whole order stops when an item runs out', async ({ page }) => {
  await signInAsAdmin(page)
  const list = await products(page)
  const a = pickProduct(list)
  const b = list.find((p) => p.available !== false && (p.inventory?.quantity ?? 0) > 0 && p.id !== a.id)!
  await setSellable(page, a.id, 1)
  await setSellable(page, b.id, 5)

  await page.goto('/admin/terminal')
  await page.getByRole('button', { name: /g-cash/i }).click()
  await page.locator('button', { hasText: a.name }).first().click()
  await page.locator('button', { hasText: b.name }).first().click()
  await setSellable(page, a.id, 0)

  await page.getByRole('button', { name: /place order/i }).click()
  await expect(page.getByText(/no longer available/i)).toBeVisible()
  await expect(page.getByText(a.name).first()).toBeVisible()
  await expect(page.getByText('Order placed')).not.toBeVisible()
})

test('normal order succeeds and deducts stock', async ({ page }) => {
  await signInAsAdmin(page)
  const list = await products(page)
  const product = pickProduct(list)
  await setSellable(page, product.id, 5)

  await terminalOrder(page, product.name, 2)

  expect(await sellableOf(page, product.id)).toBe(3)
})

test('staff can override an out-of-stock count at the terminal', async ({ page }) => {
  await signInAsAdmin(page)
  const list = await products(page)
  const product = pickProduct(list)
  await setSellable(page, product.id, 0)

  await page.goto('/admin/terminal')
  await page.getByRole('button', { name: /g-cash/i }).click()

  await expect(page.locator('button', { hasText: product.name }).first()).toBeDisabled()

  await page.getByText('Sell sold-out items').locator('..').locator('button').click()
  await expect(page.locator('button', { hasText: product.name }).first()).toBeEnabled()

  await page.locator('button', { hasText: product.name }).first().click()
  await page.getByRole('button', { name: /place order/i }).click()
  await expect(page.getByText('Order placed')).toBeVisible()
})

test('optional ingredients do not block when out of stock', async ({ page }) => {
  // Americano recipe: Coffee Beans (required) + Sugar (optional).
  // Draining sugar must NOT make an Americano unavailable.
  await signInAsAdmin(page)
  const list = await products(page)
  const product = list.find((p) => p.name.toLowerCase().includes('americano'))
  expect(product, 'expected an Americano product').toBeTruthy()

  // Find sugar in the recipe and drain it.
  const recipeRes = await page.request.get(`/api/ingredients/product/${product!.id}`)
  const recipe: { ingredientId: number; quantity: number; required?: boolean; ingredient?: { name: string } }[] = await recipeRes.json()
  const sugar = recipe.find((pi) => !pi.required && (pi.ingredient?.name?.toLowerCase().includes('sugar')))
  if (sugar) {
    await page.request.put(`/api/ingredients/${sugar.ingredientId}`, { data: { currentStock: 0 } })
  }

  const after = await sellableOf(page, product!.id)
  expect(after).toBeGreaterThan(0) // still sellable via beans alone
})
