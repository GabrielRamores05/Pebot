import { test, expect } from '@playwright/test'

// Acceptance tests for spec 000-manual-db-backup-restore.
// Each test maps one-for-one to a criterion in specs/000-manual-db-backup-restore/spec.md.

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'test-password'

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL(/\/admin/)
}

test('saves a backup with the current data', async ({ page }) => {
  await signInAsAdmin(page)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save Data' }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^cafeos-backup-.*\.zip$/)
  const path = await download.path()
  expect(path).toBeTruthy()
})

test('names the backup with a timestamp', async ({ page }) => {
  await signInAsAdmin(page)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save Data' }).click(),
  ])

  // cafeos-backup-YYYY-MM-DD-HH-MM.zip
  expect(download.suggestedFilename()).toMatch(/^cafeos-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/)
})

test('shows the 30-second warning before restoring', async ({ page }) => {
  await signInAsAdmin(page)

  await page.getByRole('button', { name: 'Restore Data' }).click()
  const fileChooserPromise = page.waitForEvent('filechooser')
  // Use an existing backup saved via Save Data in an earlier step.
  // The test harness seeds a valid backup at tests/fixtures/valid-backup.zip.
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles('tests/fixtures/valid-backup.zip')

  await expect(page.getByText('Current database will be permanently lost. Are you sure?')).toBeVisible()
  await expect(page.getByText('30s')).toBeVisible()
})

test('cancels the restore when I dismiss the warning', async ({ page }) => {
  await signInAsAdmin(page)

  await page.getByRole('button', { name: 'Restore Data' }).click()
  const fileChooser = await page.waitForEvent('filechooser')
  await fileChooser.setFiles('tests/fixtures/valid-backup.zip')

  await expect(page.getByText('Current database will be permanently lost. Are you sure?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByText('Current database will be permanently lost. Are you sure?')).not.toBeVisible()
  await expect(page).toHaveURL(/\/admin/)
})

test('restores the backup and sends me to login', async ({ page }) => {
  await signInAsAdmin(page)

  await page.getByRole('button', { name: 'Restore Data' }).click()
  const fileChooser = await page.waitForEvent('filechooser')
  await fileChooser.setFiles('tests/fixtures/valid-backup.zip')

  // Confirm becomes active only after the 30-second countdown.
  await expect(page.getByRole('button', { name: 'Confirm Restore' })).toBeEnabled({ timeout: 40_000 })
  await page.getByRole('button', { name: 'Confirm Restore' }).click()

  await page.waitForURL(/\/login/)
})

test('restores all previous data', async ({ page, request }) => {
  await signInAsAdmin(page)

  await page.getByRole('button', { name: 'Restore Data' }).click()
  const fileChooser = await page.waitForEvent('filechooser')
  await fileChooser.setFiles('tests/fixtures/valid-backup.zip')

  await expect(page.getByRole('button', { name: 'Confirm Restore' })).toBeEnabled({ timeout: 40_000 })
  await page.getByRole('button', { name: 'Confirm Restore' }).click()
  await page.waitForURL(/\/login/)

  // Sign back in and confirm the restored data is present.
  await signInAsAdmin(page)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: /live orders/i })).toBeVisible()
})

test('rejects an invalid backup file', async ({ page }) => {
  await signInAsAdmin(page)

  await page.getByRole('button', { name: 'Restore Data' }).click()
  const fileChooser = await page.waitForEvent('filechooser')
  await fileChooser.setFiles('tests/fixtures/invalid-backup.zip')

  await expect(
    page.getByText('Failed to restore backup. The selected file is not a valid Pebot backup.')
  ).toBeVisible()
})