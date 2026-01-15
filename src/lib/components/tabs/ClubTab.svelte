<script lang="ts">
  import { gameState, currentSeason, currentReputation, reputationUpgradesWithStatus } from '$lib/stores/game-state';
  import { formatNumber, formatDuration } from '$lib/utils/format';

  const game = $derived($gameState);
  const season = $derived($currentSeason);
  const reputation = $derived($currentReputation);
  const repUpgrades = $derived($reputationUpgradesWithStatus);

  function handleBuyRepUpgrade(upgradeId: string) {
    gameState.buyReputationUpgrade(upgradeId);
  }
</script>

<section class="club-tab">
  <h2 class="section-title">Club Management</h2>

  <!-- Season Stats Summary -->
  <div class="club-stats-panel">
    <div class="club-stat">
      <span class="club-stat-label">Current Season</span>
      <span class="club-stat-value">{season.number}</span>
    </div>
    <div class="club-stat">
      <span class="club-stat-label">Seasons Completed</span>
      <span class="club-stat-value">{game.stats.totalSeasons}</span>
    </div>
    <div class="club-stat">
      <span class="club-stat-label">Fastest Season</span>
      <span class="club-stat-value">
        {game.stats.fastestSeason < Infinity ? formatDuration(game.stats.fastestSeason) : '-'}
      </span>
    </div>
    <div class="club-stat highlight">
      <span class="club-stat-label">Reputation</span>
      <span class="club-stat-value">{formatNumber(reputation)}</span>
    </div>
  </div>

  <!-- Reputation Upgrades -->
  <div class="rep-upgrades-section">
    <h3 class="section-subtitle">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
      </svg>
      Reputation Upgrades
    </h3>
    <p class="section-hint">Permanent bonuses that persist between seasons</p>

    <div class="rep-upgrades-grid">
      {#each repUpgrades as upgrade}
        <div class="rep-upgrade-card" class:purchased={upgrade.purchased} class:can-afford={upgrade.canAfford && !upgrade.purchased}>
          <div class="rep-upgrade-header">
            <span class="rep-upgrade-name">{upgrade.name}</span>
            <span class="rep-upgrade-cost" class:affordable={upgrade.canAfford}>
              {upgrade.purchased ? '✓ Owned' : `${upgrade.cost} Rep`}
            </span>
          </div>
          <p class="rep-upgrade-desc">{upgrade.description}</p>
          {#if !upgrade.purchased}
            <button
              class="rep-upgrade-btn"
              disabled={!upgrade.canAfford}
              onclick={() => handleBuyRepUpgrade(upgrade.id)}
            >
              {upgrade.canAfford ? 'Purchase' : 'Not enough Rep'}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>
