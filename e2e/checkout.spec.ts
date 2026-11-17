import { expect, test } from '@playwright/test';

/**
 * End-to-end walk through the MOCK checkout: log in, pick an amount, get a QR
 * code, simulate a payment, land on the success screen with a rank.
 *
 * Needs APP_MODE=mock, a migrated database and `pnpm seed`.
 */
test('a mock user can log in, check out and be credited', async ({ page }) => {
  const handle = `e2e${Date.now().toString().slice(-8)}`;

  await page.goto('/login');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('Display name').fill('End To End');
  await page.getByRole('button', { name: /create mock session/i }).click();

  await expect(page).toHaveURL(/\/claim/);
  await expect(page.getByRole('heading', { name: /claim your rank/i })).toBeVisible();

  // The calculator answers before any money moves.
  await page.getByLabel(/how much/i).fill('42');
  await expect(page.getByText(/after this payment/i)).toBeVisible();

  await page.getByRole('button', { name: /^Pay \$42$/ }).click();

  await expect(page).toHaveURL(/\/checkout\//);
  await expect(page.getByRole('heading', { name: /scan and pay/i })).toBeVisible();
  await expect(page.getByRole('img', { name: /QR code to pay/i })).toBeVisible();
  await expect(page.getByText(/send only/i)).toBeVisible();

  // Simulated payment runs through the real crediting path.
  await page.getByRole('button', { name: /1\. Detect/ }).click();
  await expect(page.getByText(/detect →/)).toBeVisible();

  await page.getByRole('button', { name: /2\. Confirm/ }).click();

  await expect(page.getByRole('heading', { name: /you are #\d+/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/\$42 credited/)).toBeVisible();
  await expect(page.getByRole('link', { name: /share on x/i })).toBeVisible();

  // The listing is now on the board.
  await page.goto('/');
  await expect(page.getByRole('link', { name: `@${handle}` }).first()).toBeVisible();
});
