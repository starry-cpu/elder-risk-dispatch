import { test, expect } from '@playwright/test';

test.describe('Admin Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token-e2e');
    });
  });

  test('dashboard loads with stat cards and charts', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=重点老人')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=待处理预警')).toBeVisible();
    await expect(page.locator('text=今日工单完成率')).toBeVisible();
  });

  test('risk center loads and shows filters', async ({ page }) => {
    await page.goto('/risk');
    await expect(page.locator('.el-select')).toBeVisible({ timeout: 5000 });
  });

  test('work orders page loads with table', async ({ page }) => {
    await page.goto('/work-orders');
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 5000 });
  });

  test('sidebar navigates between pages', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('.el-menu-item:has-text("老人档案")').click();
    await expect(page).toHaveURL(/\/elders/);
    await page.locator('.el-menu-item:has-text("预警中心")').click();
    await expect(page).toHaveURL(/\/risk/);
    await page.locator('.el-menu-item:has-text("审计日志")').click();
    await expect(page).toHaveURL(/\/audit/);
  });
});
