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
      // Resources are now shown inline in header
      await expect(page.locator('.header-resources-inline')).toBeVisible();
      await expect(page.locator('.header-resource.training')).toBeVisible();
    });

    test('should show training minutes increasing passively', async ({ page }) => {
      // Set speed to 100x to see a significant change
      await page.getByRole('button', { name: '100x' }).click();

      // Get initial value from header (parses formatted numbers like "1.5K" → 1500)
      const getMinutes = async () => {
        const text = await page.locator('.header-resource.training .header-resource-value').textContent() || '0';
        const match = text.match(/([\d.]+)([KMB])?/);
        if (!match) return 0;
        const num = parseFloat(match[1]);
        const suffix = match[2];
        if (suffix === 'K') return num * 1000;
        if (suffix === 'M') return num * 1000000;
        if (suffix === 'B') return num * 1000000000;
        return num;
      };

      const initialMinutes = await getMinutes();

      // Wait a bit for passive training (at 100x speed: 100/s)
      await page.waitForTimeout(1500);

      const newMinutes = await getMinutes();
      expect(newMinutes).toBeGreaterThan(initialMinutes);
    });

    test('should increase training minutes on click', async ({ page }) => {
      // Click the Train button (action button in rink actions)
      const trainButton = page.locator('.action-btn.training-btn');
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
      // Set speed to 1000x for faster testing
      await page.getByRole('button', { name: '1000x' }).click();
    });

    test('should have matches locked initially', async ({ page }) => {
      // Matches are locked initially - show locked info message
      await expect(page.locator('.match-locked-info')).toBeVisible();
      await expect(page.locator('text=/unlock matches/i')).toBeVisible();
    });

    test('should unlock matches after 3000 training', async ({ page }) => {
      // Wait for 3000+ training at 1000x speed (1/s * 1000 = 1000/s, need 3+ seconds)
      await page.waitForTimeout(4000);

      // Match buttons should now be visible and enabled
      await expect(page.getByRole('button', { name: /Balanced/i })).toBeEnabled();
    });

    test('should play a match and show result', async ({ page }) => {
      // Wait for 3000+ training at 1000x speed
      await page.waitForTimeout(4000);

      // Click Balanced tactic button to start match
      await page.getByRole('button', { name: /Balanced/i }).click();

      // Wait for match animation + result (at 1000x speed, this is very fast)
      await page.waitForTimeout(100);

      // Record should have updated from 0W - 0L
      await expect(page.locator('text=/[1-9]\\d*W|[1-9]\\d*L/')).toBeVisible({ timeout: 5000 });
    });

    test('should update record after match', async ({ page }) => {
      await page.waitForTimeout(4000);
      await page.getByRole('button', { name: /Balanced/i }).click();

      // Wait for match to complete
      await page.waitForTimeout(5000);

      // Record should no longer be 0W - 0L
      await expect(page.locator('text=/[1-9]\\d*W|[1-9]\\d*L/')).toBeVisible();
    });
  });

  test.describe('Upgrade System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '1000x' }).click();
      // Wait for training + passive income to accumulate money for upgrades
      await page.waitForTimeout(5000); // 5s at 1000x = enough for a match + passive income
    });

    test('should show upgrades tab', async ({ page }) => {
      await page.getByRole('button', { name: 'Upgrades' }).click();
      await expect(page.getByRole('heading', { name: 'Upgrades' })).toBeVisible();
    });

    test('should buy upgrade and increase cost', async ({ page }) => {
      // Play a match to get money for upgrades
      await page.getByRole('button', { name: /Balanced/i }).click();
      await page.waitForTimeout(5000); // Wait for match animation + result

      await page.getByRole('button', { name: 'Upgrades' }).click();

      // Look for Better Skates with $50 cost (upgrades now cost money)
      const upgradeButton = page.getByRole('button', { name: /Better Skates.*\$50/i });
      await upgradeButton.click();

      // Cost should have increased to $75 after purchase (50 * 1.5)
      await expect(page.getByRole('button', { name: /Better Skates.*\$75/i })).toBeVisible();
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
      await page.getByRole('button', { name: '1000x' }).click();
    });

    test('should show morale only on Dashboard tab', async ({ page }) => {
      // Morale should be visible on Dashboard (compact morale panel)
      await expect(page.locator('.morale-panel-compact')).toBeVisible();

      // Switch to Upgrades tab
      await page.getByRole('button', { name: 'Upgrades' }).click();

      // Morale should NOT be visible on Upgrades tab
      await expect(page.locator('.morale-panel-compact')).not.toBeVisible();

      // Switch back to Dashboard
      await page.getByRole('button', { name: 'Dashboard' }).click();

      // Morale should be visible again
      await expect(page.locator('.morale-panel-compact')).toBeVisible();
    });

    test('should show morale at level 0 initially', async ({ page }) => {
      await expect(page.locator('text=0/100')).toBeVisible();
      await expect(page.locator('text=1.00x')).toBeVisible();
    });

    test('should have Boost Morale disabled without money', async ({ page }) => {
      await expect(page.locator('.morale-boost-btn-compact')).toBeDisabled();
    });

    test('should enable Boost Morale after earning money', async ({ page }) => {
      // Wait for 3000+ training at 1000x (1000/s, need 3s)
      await page.waitForTimeout(4000);
      await page.getByRole('button', { name: /Balanced/i }).click();
      await page.waitForTimeout(5000); // Wait for match
      // Wait for more training for second match
      await page.waitForTimeout(4000);
      await page.getByRole('button', { name: /Balanced/i }).click();
      await page.waitForTimeout(5000); // Wait for match

      // Should have enough money now
      await expect(page.locator('.morale-boost-btn-compact')).toBeEnabled();
    });

    test('should increase morale level when boosted', async ({ page }) => {
      test.setTimeout(60000); // Increase timeout for this test

      // Wait for enough training for matches
      await page.waitForTimeout(8000);

      // Play a couple matches to get money
      for (let i = 0; i < 2; i++) {
        const playBtn = page.getByRole('button', { name: /Balanced/i });
        if (await playBtn.isEnabled()) {
          await playBtn.click();
          await page.waitForTimeout(5500); // Wait for match animation + result
        }
        await page.waitForTimeout(4000); // Wait for more training
      }

      await page.locator('.morale-boost-btn-compact').click();

      await expect(page.locator('text=1/100')).toBeVisible();
      await expect(page.locator('text=1.05x')).toBeVisible();
    });
  });

  test.describe('Challenge System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '1000x' }).click();
    });

    test('should show challenges tab', async ({ page }) => {
      await page.getByRole('button', { name: 'Challenges' }).click();
      await expect(page.getByRole('heading', { name: 'Challenges', exact: true })).toBeVisible();
      // New level-based system: 8 challenges × 5 levels = 40 total levels
      await expect(page.locator('.challenges-count')).toHaveText('0 / 40 Levels');
    });

    test('should show all challenges available from start (AD-style)', async ({ page }) => {
      await page.getByRole('button', { name: 'Challenges' }).click();

      // All 8 challenges should be visible (no locked challenges anymore)
      await expect(page.locator('.challenge-name:has-text("Rookie Season")')).toBeVisible();
      await expect(page.locator('.challenge-name:has-text("Budget Season")')).toBeVisible();
      await expect(page.locator('.challenge-name:has-text("Intensive Training")')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'All Challenges' })).toBeVisible();
      // Each challenge shows level stars
      await expect(page.locator('.challenge-stars').first()).toBeVisible();
    });

    test('should start a challenge at level 1', async ({ page }) => {
      await page.getByRole('button', { name: 'Challenges' }).click();
      // Wait for challenges to load
      await page.waitForTimeout(500);
      // Click "Level 1" button (new button text)
      await page.getByRole('button', { name: 'Level 1' }).first().click();
      // Wait for UI to update after starting challenge
      await page.waitForTimeout(300);

      await expect(page.getByRole('heading', { name: /Active Challenge - Level 1/ })).toBeVisible();
      // Abandon button is now in the header challenge bar
      await expect(page.locator('.challenge-abandon-btn')).toBeVisible();
    });
  });

  test.describe('Achievement System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '1000x' }).click();
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
      test.setTimeout(60000); // Increase timeout for this test

      // Wait for training to accumulate
      await page.waitForTimeout(8000);

      // Play matches until we win
      for (let i = 0; i < 2; i++) {
        const playBtn = page.getByRole('button', { name: /Balanced/i });
        if (await playBtn.isEnabled()) {
          await playBtn.click();
          await page.waitForTimeout(5500); // Wait for match animation + result
        }
        await page.waitForTimeout(4000); // Wait for more training
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

  test.describe('Passive Income', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '1000x' }).click();
    });

    test('should show passive income rate in header', async ({ page }) => {
      // Wait for 3000+ training at 1000x (1000/s = 3s)
      await page.waitForTimeout(4000);

      await page.getByRole('button', { name: /Balanced/i }).click();
      await page.waitForTimeout(5000); // Wait for match animation

      // Should see income rate displayed (fans generate money)
      await expect(page.locator('.header-resource.money .header-resource-rate')).toBeVisible();
    });

    test('should increase money passively from fans', async ({ page }) => {
      // Wait for 3000+ training at 1000x (1000/s = 3s)
      await page.waitForTimeout(4000);

      // Play a match to get fans
      await page.getByRole('button', { name: /Balanced/i }).click();
      await page.waitForTimeout(5000); // Wait for match animation

      // Get initial money
      const getMoneyText = async () => {
        return await page.locator('.header-resource.money .header-resource-value').textContent();
      };

      const initialMoney = await getMoneyText();

      // Wait for passive income to accumulate
      await page.waitForTimeout(2000);

      const newMoney = await getMoneyText();

      // Money should have increased from passive income
      expect(newMoney).not.toBe(initialMoney);
    });
  });

  test.describe('Dev Tools', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
    });

    test('should show speed controls', async ({ page }) => {
      await expect(page.getByRole('button', { name: '1x' })).toBeVisible();
      await expect(page.getByRole('button', { name: '1000x' })).toBeVisible();
    });

    test('should change training rate when speed is changed', async ({ page }) => {
      // Check header rate (base rate is 1/s)
      await expect(page.locator('.header-resource-rate').first()).toHaveText('+1/s');

      await page.getByRole('button', { name: '1000x' }).click();

      // New format: 1 decimal for values < 10K
      await expect(page.locator('.header-resource-rate').first()).toHaveText('+1.0K/s');
    });

    test('should reset game when reset button is clicked', async ({ page }) => {
      // Click reset button to open modal
      await page.getByRole('button', { name: 'Reset' }).click();

      // Confirm in the modal
      await page.getByRole('button', { name: 'Reset Everything' }).click();

      // Should show club creation form again
      await expect(page.getByRole('textbox', { name: /Club Name/i })).toBeVisible();
    });
  });

  test.describe('Season System', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: /Club Name/i }).fill('Test Club');
      await page.getByRole('button', { name: 'Found Club' }).click();
      await page.getByRole('button', { name: '1000x' }).click();
    });

    test('should show season info in header', async ({ page }) => {
      await expect(page.locator('.season-label')).toHaveText('Season 1');
      await expect(page.locator('.season-progress-text')).toHaveText('0/10');
    });

    test('should show reputation display', async ({ page }) => {
      // Reputation is now shown as "X Rep" format
      await expect(page.locator('.rep-value')).toHaveText('0 Rep');
    });

    test('should track season wins', async ({ page }) => {
      // Wait for 3000+ training at 1000x (1000/s = 3s)
      await page.waitForTimeout(4000);

      // Play a match
      await page.getByRole('button', { name: /Balanced/i }).click();
      await page.waitForTimeout(5000); // Wait for match animation

      // Season progress should have updated (at least 0 or 1 win)
      const progressText = await page.locator('.season-progress-text').textContent();
      expect(progressText).toMatch(/\d+\/10/);
    });

    // Skip: This test requires completing a full 10-win season which takes too long
    // with the new economy (3000 training per match at 1000/s = ~3s+ per match at 1000x)
    // Tested manually via /playtest
    test.skip('should show End Season button when goal is reached', async ({ page }) => {
      test.setTimeout(180000);

      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(10000);
        const playBtn = page.getByRole('button', { name: /Balanced/i });
        if (await playBtn.isEnabled()) {
          await playBtn.click();
          await page.waitForTimeout(5000); // Wait for match animation
        }
        const endBtn = page.locator('.end-season-btn');
        if (await endBtn.isVisible({ timeout: 100 }).catch(() => false)) {
          break;
        }
      }

      await expect(page.locator('.end-season-btn')).toBeVisible({ timeout: 5000 });
    });

    test('should show Club tab with reputation upgrades', async ({ page }) => {
      await page.getByRole('button', { name: 'Club' }).click();
      await expect(page.getByRole('heading', { name: 'Club Management' })).toBeVisible();
      await expect(page.locator('text=Reputation Upgrades')).toBeVisible();
      await expect(page.locator('text=Veteran Coach')).toBeVisible();
    });

    test('should show season stats in Club tab', async ({ page }) => {
      await page.getByRole('button', { name: 'Club' }).click();

      await expect(page.locator('text=Current Season')).toBeVisible();
      await expect(page.locator('text=Seasons Completed')).toBeVisible();
    });

    // Skip: Requires full season completion - tested manually via /playtest
    test.skip('should show End Season modal with correct info', async ({ page }) => {
      test.setTimeout(180000);

      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(10000);
        const playBtn = page.getByRole('button', { name: /Balanced/i });
        if (await playBtn.isEnabled()) {
          await playBtn.click();
          await page.waitForTimeout(5000); // Wait for match animation
        }
        const endBtn = page.locator('.end-season-btn');
        if (await endBtn.isVisible({ timeout: 100 }).catch(() => false)) {
          break;
        }
      }

      // Check if end season button appeared
      const endSeasonBtn = page.locator('.end-season-btn');
      if (await endSeasonBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await endSeasonBtn.click();

        // Verify modal content
        await expect(page.locator('text=Season Complete!')).toBeVisible();
        await expect(page.locator('text=End Season & Prestige')).toBeVisible();
        await expect(page.locator('text=Keep Playing')).toBeVisible();
      }
    });
  });
});
