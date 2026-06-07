const { test, expect } = require('@playwright/test');

test('page loads and has no console errors', async ({ page }) => {
  const messages = [];
  page.on('console', msg => messages.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => messages.push(`PAGEERROR: ${err.message}`));

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toHaveText('PIXEL SURVIVORS');
  console.log('MESSAGES=', JSON.stringify(messages, null, 2));
});
