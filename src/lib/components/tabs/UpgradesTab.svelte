<script lang="ts">
  import { gameState, visibleUpgrades, lockedUpgrades } from '$lib/stores/game-state';
  import { formatNumber, formatMoney } from '$lib/utils/format';
  import { calculateUpgradeCost, canAffordUpgrade } from '$lib/game/formulas';
  import type { Upgrade } from '$lib/game/types';

  const game = $derived($gameState);
  const available = $derived($visibleUpgrades);
  const locked = $derived($lockedUpgrades);

  function handleBuyUpgrade(upgradeId: string) {
    gameState.buyUpgrade(upgradeId);
  }

  function canAfford(upgradeId: string): boolean {
    return canAffordUpgrade(game, upgradeId);
  }

  function getUpgradeIcon(upgradeId: string): string {
    const icons: Record<string, string> = {
      better_skates: 'M12 2L8 6H4v4l-2 2 2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4l-4-4z',
      training_rink: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
      youth_program: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
      merchandise: 'M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3z',
      hockey_sticks: 'M3 2l8 10-8 10h4l8-10-8-10H3zm18 0l-8 10 8 10h-4l-8-10 8-10h4z',
      volunteer_coaches: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
      garage_rink: 'M19 9.3V4h-3v2.6L12 3 2 12h3v8h5v-6h4v6h5v-8h3l-3-2.7z',
      equipment_locker: 'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2z',
      local_sponsors: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 15.41l-4-4 1.41-1.41L11 14.59l5.59-5.59L18 10.41l-7 7z',
      team_jerseys: 'M12 1L8 5.5V9H4v12h7v-9.68c0-.65.61-1.32 1-1.32s1 .67 1 1.32V21h7V9h-4V5.5L12 1z',
      outdoor_flooding: 'M17.66 8L12 2.35 6.34 8C4.78 9.56 4 11.64 4 13.64s.78 4.11 2.34 5.67 3.61 2.35 5.66 2.35 4.1-.79 5.66-2.35S20 15.64 20 13.64 19.22 9.56 17.66 8zM6 14c.01-2 .62-3.27 1.76-4.4L12 5.27l4.24 4.38C17.38 10.77 17.99 12 18 14H6z',
      community_support: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
      tournament_entry: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z',
      grassroots_legend: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      improved_jockstraps: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    };
    return icons[upgradeId] || 'M12 2L2 7l10 5 10-5-10-5z';
  }

  function getUnlockRequirement(upgrade: Upgrade): string {
    if (!upgrade.unlockCondition) return '';
    const { type, value } = upgrade.unlockCondition;

    switch (type) {
      case 'fans':
        return `Requires ${formatNumber(value)} fans`;
      case 'matchesPlayed':
        return `Requires ${value} matches played`;
      case 'matchesWon':
        return `Requires ${value} wins`;
      case 'money':
        return `Requires ${formatMoney(value)}`;
      case 'trainingMinutes':
        return `Requires ${formatNumber(value)} training minutes`;
      default:
        return '';
    }
  }
</script>

<section class="panel upgrades-panel full-width">
  <div class="panel-header">
    <h2>Upgrades</h2>
    <span class="panel-hint">Spend money to improve your club</span>
  </div>

  <div class="upgrades-grid">
    {#each available as upgrade}
      {@const cost = calculateUpgradeCost(upgrade)}
      {@const affordable = canAfford(upgrade.id)}
      {@const maxed = upgrade.level >= upgrade.maxLevel}
      {@const progress = (upgrade.level / upgrade.maxLevel) * 100}

      <button
        class="upgrade-card"
        class:affordable
        class:maxed
        onclick={() => handleBuyUpgrade(upgrade.id)}
        disabled={!affordable || maxed}
      >
        <div class="upgrade-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d={getUpgradeIcon(upgrade.id)} />
          </svg>
        </div>

        <div class="upgrade-info">
          <div class="upgrade-header">
            <span class="upgrade-name">{upgrade.name}</span>
            <span class="upgrade-level">{upgrade.level}/{upgrade.maxLevel}</span>
          </div>
          <p class="upgrade-desc">{upgrade.description}</p>

          <div class="upgrade-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {progress}%"></div>
            </div>
          </div>
        </div>

        <div class="upgrade-cost">
          {#if maxed}
            <span class="maxed-label">MAX</span>
          {:else}
            <span class="cost-value">{formatMoney(cost)}</span>
          {/if}
        </div>
      </button>
    {/each}

    {#each locked as upgrade}
      <div class="upgrade-card locked">
        <div class="upgrade-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z" />
          </svg>
        </div>

        <div class="upgrade-info">
          <div class="upgrade-header">
            <span class="upgrade-name">{upgrade.name}</span>
            <span class="locked-badge">LOCKED</span>
          </div>
          <p class="upgrade-desc">{upgrade.description}</p>
          <p class="unlock-requirement">{getUnlockRequirement(upgrade)}</p>
        </div>
      </div>
    {/each}
  </div>
</section>
<!-- Styles are in app.css (SHARED TAB COMPONENT STYLES) -->
