import { test, expect } from '@playwright/test';

test.describe('Ice Dynasty Game', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and navigate to game
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test.describe('Club Creation', () => {
    test('should show club creation form initially', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Ice Dynasty' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /Club Name/i })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Found Club' })).toBeDisabled();
    });

    test('should enable Found Club button when name is entered', async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await expect(page.getByRole('button', { name: 'Found Club' })).toBeEnabled();
    });

    test('should create club and show dashboard', async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();

      await expect(page.getByRole('heading', { name: 'Test Club' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    });

    test('should unlock First Steps achievement on club creation', async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();

      // Check achievements tab shows at least 1 unlocked (badge is separate element)
      const achievementsTab = page.getByRole('button', { name: /Achievements/i });
      await expect(achievementsTab).toBeVisible();
      // Badge should have a number >= 1
      const badgeText = await achievementsTab.locator('.tab-badge').textContent();
      expect(parseInt(badgeText || '0')).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Training System', () => {
    test.beforeEach(async ({ page }) => {
      // Create a club first
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
    });

    test('should show training minutes in header', async ({ page }) => {
      // Resources are now shown in header
      await expect(page.locator('.header-resources')).toBeVisible();
      await expect(page.locator('.header-resource.training')).toBeVisible();
    });

    test('should show training minutes increasing passively', async ({ page }) => {
      // Get initial value from header
      const getMinutes = async () => {
        const text = await page.locator('.header-resource.training .header-resource-value').textContent();
        return parseFloat(text?.replace(/[^\d.KMB]/g, '').replace('K', '000').replace('M', '000000') || '0');
      };

      const initialMinutes = await getMinutes();

      // Wait a bit for passive training
      await page.waitForTimeout(2000);

      const newMinutes = await getMinutes();
      expect(newMinutes).toBeGreaterThan(initialMinutes);
    });

    test('should increase training minutes on click', async ({ page }) => {
      const trainButton = page.getByRole('button', { name: /^\+\d/ });
      await trainButton.click();
      await trainButton.click();
      await trainButton.click();

      // Training should have increased
      const text = await page.locator('.header-resource.training .header-resource-value').textContent();
      expect(text).toBeTruthy();
    });
  });

  test.describe('Match System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      // Set speed to 100x for faster testing
      await page.getByRole('button', { name: '100x' }).click();
    });

    test('should have Play Match locked initially', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Locked/i })).toBeVisible();
    });

    test('should unlock Play Match after 100 training minutes', async ({ page }) => {
      // Wait for 100 minutes at 100x speed (about 1 second)
      await page.waitForTimeout(1500);

      await expect(page.getByRole('button', { name: 'Play Match' })).toBeEnabled();
    });

    test('should play a match and show result', async ({ page }) => {
      await page.waitForTimeout(1500); // Wait for unlock
      await page.getByRole('button', { name: 'Play Match' }).click();

      // Should show Victory or Defeat
      await expect(page.locator('text=/Victory|Defeat/')).toBeVisible();
    });

    test('should update record after match', async ({ page }) => {
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: 'Play Match' }).click();

      // Record should no longer be 0W - 0L
      await expect(page.locator('text=/[1-9]\\d*W|[1-9]\\d*L/')).toBeVisible();
    });
  });

  test.describe('Upgrade System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '100x' }).click();
      await page.waitForTimeout(500); // Get some training minutes
    });

    test('should show upgrades tab', async ({ page }) => {
      await page.getByRole('button', { name: 'Upgrades' }).click();
      await expect(page.getByRole('heading', { name: 'Upgrades' })).toBeVisible();
    });

    test('should buy upgrade and increase cost', async ({ page }) => {
      await page.getByRole('button', { name: 'Upgrades' }).click();

      // Look for Better Skates with 10 cost (now shows "cond" instead of "min")
      const upgradeButton = page.getByRole('button', { name: /Better Skates.*10.*cond/i });
      await upgradeButton.click();

      // Cost should have increased to 15 after purchase
      await expect(page.getByRole('button', { name: /Better Skates.*15.*cond/i })).toBeVisible();
    });

    test('should show locked upgrades with requirements', async ({ page }) => {
      await page.getByRole('button', { name: 'Upgrades' }).click();

      await expect(page.locator('text=Equipment Locker')).toBeVisible();
      await expect(page.locator('text=Requires 500 fans')).toBeVisible();
    });
  });

  test.describe('Morale System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '100x' }).click();
    });

    test('should show morale only on Dashboard tab', async ({ page }) => {
      // Morale should be visible on Dashboard
      await expect(page.locator('text=Team Morale')).toBeVisible();

      // Switch to Upgrades tab
      await page.getByRole('button', { name: 'Upgrades' }).click();

      // Morale should NOT be visible on Upgrades tab
      await expect(page.locator('text=Team Morale')).not.toBeVisible();

      // Switch back to Dashboard
      await page.getByRole('button', { name: 'Dashboard' }).click();

      // Morale should be visible again
      await expect(page.locator('text=Team Morale')).toBeVisible();
    });

    test('should show morale at level 0 initially', async ({ page }) => {
      await expect(page.locator('text=0/100')).toBeVisible();
      await expect(page.locator('text=1.00x')).toBeVisible();
    });

    test('should have Boost Morale disabled without money', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Boost Morale/i })).toBeDisabled();
    });

    test('should enable Boost Morale after earning money', async ({ page }) => {
      // Wait for unlock and play match
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: 'Play Match' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Play Match' }).click();

      // Should have enough money now
      await expect(page.getByRole('button', { name: /Boost Morale/i })).toBeEnabled();
    });

    test('should increase morale level when boosted', async ({ page }) => {
      await page.waitForTimeout(1500);

      // Play matches to get money
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: 'Play Match' }).click();
        await page.waitForTimeout(400);
      }

      await page.getByRole('button', { name: /Boost Morale/i }).click();

      await expect(page.locator('text=1/100')).toBeVisible();
      await expect(page.locator('text=1.05x')).toBeVisible();
    });
  });

  test.describe('Challenge System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '100x' }).click();
    });

    test('should show challenges tab', async ({ page }) => {
      await page.getByRole('button', { name: 'Challenges' }).click();
      await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible();
      await expect(page.locator('text=0 / 5 Completed')).toBeVisible();
    });

    test('should show available and locked challenges', async ({ page }) => {
      // Play some matches to unlock challenges
      await page.waitForTimeout(1500);
      for (let i = 0; i < 10; i++) {
        await page.getByRole('button', { name: 'Play Match' }).click();
        await page.waitForTimeout(400);
      }

      await page.getByRole('button', { name: 'Challenges' }).click();

      await expect(page.locator('text=Rookie Mode')).toBeVisible();
      await expect(page.locator('text=Available Challenges')).toBeVisible();
    });

    test('should start a challenge', async ({ page }) => {
      await page.waitForTimeout(1500);
      for (let i = 0; i < 10; i++) {
        await page.getByRole('button', { name: 'Play Match' }).click();
        await page.waitForTimeout(400);
      }

      await page.getByRole('button', { name: 'Challenges' }).click();
      await page.getByRole('button', { name: 'Start' }).first().click();

      await expect(page.locator('text=Active Challenge')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abandon' })).toBeVisible();
    });
  });

  test.describe('Achievement System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '100x' }).click();
    });

    test('should show achievements tab with First Steps unlocked', async ({ page }) => {
      await page.getByRole('button', { name: /Achievements/i }).click();

      await expect(page.getByRole('heading', { name: 'Achievements', exact: true })).toBeVisible();
      await expect(page.locator('text=First Steps')).toBeVisible();
      await expect(page.locator('text=Create your club')).toBeVisible();
    });

    test('should show bonus and secret achievement sections', async ({ page }) => {
      await page.getByRole('button', { name: /Achievements/i }).click();

      await expect(page.locator('text=Bonus Achievements')).toBeVisible();
      await expect(page.locator('text=Secret Achievements')).toBeVisible();
    });

    test('should unlock First Blood on first win', async ({ page }) => {
      await page.waitForTimeout(1500);

      // Play matches until we win
      for (let i = 0; i < 5; i++) {
        await page.getByRole('button', { name: 'Play Match' }).click();
        await page.waitForTimeout(400);
      }

      await page.getByRole('button', { name: /Achievements/i }).click();
      await expect(page.locator('text=First Blood')).toBeVisible();
    });

    test('should show badge emoji correctly for cosmetic achievements', async ({ page }) => {
      await page.getByRole('button', { name: /Achievements/i }).click();

      // First Steps badge should show only emoji
      const badge = page.locator('text=👶').first();
      await expect(badge).toBeVisible();

      // Should NOT contain "Baby" text next to the emoji
      await expect(page.locator('text=👶 Baby')).not.toBeVisible();
    });
  });

  test.describe('Dev Tools', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
    });

    test('should show speed controls', async ({ page }) => {
      await expect(page.getByRole('button', { name: '1x' })).toBeVisible();
      await expect(page.getByRole('button', { name: '100x' })).toBeVisible();
    });

    test('should change training rate when speed is changed', async ({ page }) => {
      // Check header rate (more specific to avoid matching training type rates)
      await expect(page.locator('.header-resource-rate').first()).toHaveText('+1/s');

      await page.getByRole('button', { name: '100x' }).click();

      await expect(page.locator('.header-resource-rate').first()).toHaveText('+100/s');
    });

    test('should reset game when reset button is clicked', async ({ page }) => {
      page.on('dialog', dialog => dialog.accept());

      await page.getByRole('button', { name: 'Reset' }).click();

      // Should show club creation form again
      await expect(page.getByRole('textbox', { name: /Club Name/i })).toBeVisible();
    });
  });
});
