import { test, expect } from '@playwright/test';

test.describe('Futgol E2E Tests', () => {
  test('should load the landing page', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Futgol/);
  });

  test('should show login form', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const loginButton = page.getByText(/entrar|login/i);
    await expect(loginButton).toBeVisible();
  });

  test('should show registration form', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const registerButton = page.getByText(/criar conta|cadastr/i);
    if (await registerButton.isVisible()) {
      await registerButton.click();
      const nameInput = page.getByPlaceholder(/nome/i);
      await expect(nameInput).toBeVisible();
    }
  });

  test('should reject invalid login', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const emailInput = page.getByPlaceholder(/email/i);
    const passwordInput = page.getByPlaceholder(/senha/i);

    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid@email.com');
      await passwordInput.fill('wrongpassword');
      const submitButton = page.getByRole('button', { name: /entrar/i });
      await submitButton.click();
      await page.waitForTimeout(2000);
      const errorText = page.getByText(/inválid|erro|falha/i);
      await expect(errorText).toBeVisible();
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Futgol/);
  });

  test('API health check', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/health');
    expect(response.ok()).toBeTruthy();
  });
});
