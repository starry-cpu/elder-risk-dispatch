import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[placeholder="请输入手机号"]')).toBeVisible();
    await expect(page.locator('input[placeholder="请输入密码"]')).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
  });

  test('validates empty form submission', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button:has-text("登录")').click();
    await expect(page.locator('.el-form-item__error')).toBeVisible();
  });
});
