<script lang="ts">
  import { gameState, trainingRate, totalMinutes, clickPower, visibleUpgrades, lockedUpgrades } from '$lib/stores/game-state';
  import { formatNumber, formatDuration, formatMoney } from '$lib/utils/format';
  import { calculateUpgradeCost, getMatchCooldown } from '$lib/game/formulas';
  import type { MatchResult } from '$lib/game/types';
  import DevTools from './DevTools.svelte';

  const game = $derived($gameState);
  const rate = $derived($trainingRate);
  const minutes = $derived($totalMinutes);
  const clickPwr = $derived($clickPower);
  const available = $derived($visibleUpgrades);
  const locked = $derived($lockedUpgrades);

  let lastMatchResult = $state<MatchResult | null>(null);
  let matchCooldownMs = $state(0);
  let clickRipples = $state<Array<{ id: number; x: number; y: number }>>([]);
  let rippleId = 0;
  let showGoalCelebration = $state(false);

  // Update match cooldown display
  $effect(() => {
    const interval = setInterval(() => {
      matchCooldownMs = getMatchCooldown($gameState);
    }, 100);

    return () => clearInterval(interval);
  });

  const matchCooldownDisplay = $derived(
    matchCooldownMs > 0 ? formatDuration(matchCooldownMs / 1000) : ''
  );

  const cooldownPercent = $derived(
    matchCooldownMs > 0 ? (1 - matchCooldownMs / 30000) * 100 : 100
  );

  function handleTrainClick(e: MouseEvent) {
    gameState.clickTrain();

    // Add ripple effect at click position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple = { id: rippleId++, x, y };
    clickRipples = [...clickRipples, newRipple];

    // Remove ripple after animation
    setTimeout(() => {
      clickRipples = clickRipples.filter((r) => r.id !== newRipple.id);
    }, 600);
  }

  function handleBuyUpgrade(upgradeId: string) {
    gameState.buyUpgrade(upgradeId);
  }

  function handlePlayMatch() {
    const result = gameState.playMatch();
    if (result) {
      lastMatchResult = result;
      if (result.won) {
        showGoalCelebration = true;
        setTimeout(() => {
          showGoalCelebration = false;
        }, 2000);
      }
    }
  }

  function canAfford(upgradeId: string): boolean {
    const upgrade = game.upgrades.find((u) => u.id === upgradeId);
    if (!upgrade) return false;
    return game.training.totalMinutes >= calculateUpgradeCost(upgrade);
  }

  function getUpgradeIcon(upgradeId: string): string {
    const icons: Record<string, string> = {
      // Era 1 - Always available
      better_skates: 'M12 2L8 6H4v4l-2 2 2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4l-4-4z',
      training_rink: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
      youth_program: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
      merchandise: 'M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3z',
      hockey_sticks: 'M3 2l8 10-8 10h4l8-10-8-10H3zm18 0l-8 10 8 10h-4l-8-10 8-10h4z',
      volunteer_coaches: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
      garage_rink: 'M19 9.3V4h-3v2.6L12 3 2 12h3v8h5v-6h4v6h5v-8h3l-3-2.7z',
      // Mid game - Unlockable
      equipment_locker: 'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2z',
      local_sponsors: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 15.41l-4-4 1.41-1.41L11 14.59l5.59-5.59L18 10.41l-7 7z',
      team_jerseys: 'M12 1L8 5.5V9H4v12h7v-9.68c0-.65.61-1.32 1-1.32s1 .67 1 1.32V21h7V9h-4V5.5L12 1z',
      outdoor_flooding: 'M17.66 8L12 2.35 6.34 8C4.78 9.56 4 11.64 4 13.64s.78 4.11 2.34 5.67 3.61 2.35 5.66 2.35 4.1-.79 5.66-2.35S20 15.64 20 13.64 19.22 9.56 17.66 8zM6 14c.01-2 .62-3.27 1.76-4.4L12 5.27l4.24 4.38C17.38 10.77 17.99 12 18 14H6z',
      // Late game
      community_support: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
      tournament_entry: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z',
      grassroots_legend: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    };
    return icons[upgradeId] || 'M12 2L2 7l10 5 10-5-10-5z';
  }

  function getUnlockRequirement(upgrade: typeof available[0]): string {
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

<div class="dashboard" class:celebrating={showGoalCelebration}>
  <!-- Goal celebration overlay -->
  {#if showGoalCelebration}
    <div class="goal-celebration">
      <div class="goal-text">GOAL!</div>
      <div class="confetti-container">
        {#each Array(30) as _, i}
          <div
            class="confetti"
            style="
              --x: {Math.random() * 100}%;
              --delay: {Math.random() * 0.5}s;
              --rotation: {Math.random() * 360}deg;
              --color: {['var(--score-gold)', 'var(--score-red)', 'var(--ice-blue)'][i % 3]};
            "
          ></div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Header / Scoreboard -->
  <header class="header" style="--primary: {game.club?.colors.primary}; --secondary: {game.club?.colors.secondary}">
    <div class="header-content">
      <div class="club-identity">
        <div class="club-badge">
          <div class="badge-inner">
            <span class="badge-initial">{game.club?.name.charAt(0) || '?'}</span>
          </div>
          <div class="badge-ring"></div>
        </div>
        <div class="club-info">
          <h1 class="club-name">{game.club?.name}</h1>
          <div class="club-meta">
            <span class="era-badge">Era {game.era.current}</span>
            <span class="era-name">Grassroots</span>
          </div>
        </div>
      </div>

      <div class="header-scoreboard">
        <div class="record">
          <span class="record-label">Record</span>
          <span class="record-value">{game.stats.matchesWon}W - {game.stats.matchesPlayed - game.stats.matchesWon}L</span>
        </div>
        <div class="time-played">
          <span class="time-label">Time</span>
          <span class="time-value">{formatDuration(game.stats.timePlayed)}</span>
        </div>
      </div>
    </div>
  </header>

  <main class="main">
    <!-- Resource Scoreboard -->
    <section class="resources-panel">
      <div class="resource-card primary">
        <div class="resource-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
          </svg>
        </div>
        <div class="resource-content">
          <span class="resource-label">Training Minutes</span>
          <span class="resource-value led-display">{formatNumber(minutes)}</span>
          <span class="resource-rate">
            <span class="rate-passive">+{formatNumber(rate)}/s</span>
            <span class="rate-click">+{formatNumber(clickPwr)}/click</span>
          </span>
        </div>
      </div>

      <div class="resource-card">
        <div class="resource-icon fans">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </div>
        <div class="resource-content">
          <span class="resource-label">Fans</span>
          <span class="resource-value led-display">{formatNumber(game.resources.fans)}</span>
        </div>
      </div>

      <div class="resource-card">
        <div class="resource-icon money">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
          </svg>
        </div>
        <div class="resource-content">
          <span class="resource-label">Money</span>
          <span class="resource-value led-display">{formatMoney(game.resources.money)}</span>
        </div>
      </div>
    </section>

    <!-- Main Game Grid -->
    <div class="game-grid">
      <!-- Training Rink -->
      <section class="panel training-panel">
        <div class="panel-header">
          <h2>Training Rink</h2>
          <span class="panel-hint">Click the ice to train!</span>
        </div>

        <button class="rink-button" onclick={handleTrainClick}>
          <div class="rink">
            <!-- Ice surface -->
            <div class="ice-surface">
              <div class="ice-reflection"></div>
            </div>

            <!-- Rink markings -->
            <div class="center-ice">
              <div class="center-circle"></div>
              <div class="center-dot"></div>
            </div>
            <div class="center-line"></div>
            <div class="blue-line left"></div>
            <div class="blue-line right"></div>
            <div class="goal-crease left"></div>
            <div class="goal-crease right"></div>

            <!-- Click ripples -->
            {#each clickRipples as ripple (ripple.id)}
              <div
                class="click-ripple"
                style="left: {ripple.x}px; top: {ripple.y}px"
              ></div>
            {/each}

            <!-- Puck -->
            <div class="puck">
              <span class="puck-plus">+{formatNumber(clickPwr)}</span>
            </div>
          </div>
        </button>
      </section>

      <!-- Match Area -->
      <section class="panel match-panel">
        <div class="panel-header">
          <h2>Play Match</h2>
          <span class="panel-hint">Challenge teams for fans & money</span>
        </div>

        <div class="match-content">
          <button
            class="match-btn"
            onclick={handlePlayMatch}
            disabled={matchCooldownMs > 0}
          >
            {#if matchCooldownMs > 0}
              <div class="cooldown-ring">
                <svg viewBox="0 0 100 100">
                  <circle class="cooldown-bg" cx="50" cy="50" r="45" />
                  <circle
                    class="cooldown-progress"
                    cx="50"
                    cy="50"
                    r="45"
                    style="stroke-dashoffset: {283 * (1 - cooldownPercent / 100)}"
                  />
                </svg>
                <span class="cooldown-time">{matchCooldownDisplay}</span>
              </div>
            {:else}
              <div class="match-ready">
                <svg class="whistle-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>Play Match</span>
              </div>
            {/if}
          </button>

          {#if lastMatchResult}
            <div class="match-result" class:won={lastMatchResult.won}>
              <div class="result-header">
                <span class="result-label">{lastMatchResult.won ? 'Victory' : 'Defeat'}</span>
              </div>
              <div class="result-score">
                <span class="score-home">{lastMatchResult.goalsFor}</span>
                <span class="score-divider">-</span>
                <span class="score-away">{lastMatchResult.goalsAgainst}</span>
              </div>
              <div class="result-rewards">
                <div class="reward">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3z"/>
                  </svg>
                  <span>+{lastMatchResult.fansGained}</span>
                </div>
                <div class="reward">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13z"/>
                  </svg>
                  <span>+{formatMoney(lastMatchResult.moneyEarned)}</span>
                </div>
              </div>
            </div>
          {:else}
            <div class="match-placeholder">
              <p>Win matches to grow your fanbase!</p>
            </div>
          {/if}
        </div>
      </section>

      <!-- Upgrades -->
      <section class="panel upgrades-panel">
        <div class="panel-header">
          <h2>Upgrades</h2>
          <span class="panel-hint">Spend training minutes</span>
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
                  <span class="cost-value">{formatNumber(cost)}</span>
                  <span class="cost-unit">min</span>
                {/if}
              </div>
            </button>
          {/each}

          <!-- Locked upgrades -->
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
    </div>
  </main>

  <DevTools />
</div>

<style>
  .dashboard {
    min-height: 100vh;
    position: relative;
    z-index: 10;
  }

  .dashboard.celebrating {
    animation: goal-horn 0.5s ease;
  }

  /* Goal Celebration */
  .goal-celebration {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(
      circle at center,
      rgba(255, 214, 10, 0.2) 0%,
      transparent 70%
    );
    pointer-events: none;
  }

  .goal-text {
    font-family: var(--font-display);
    font-size: clamp(4rem, 15vw, 10rem);
    color: var(--score-gold);
    text-shadow:
      0 0 40px var(--score-gold),
      0 0 80px var(--score-gold),
      0 0 120px var(--score-gold);
    animation: score-flash 0.5s ease-out;
    letter-spacing: 0.2em;
  }

  .confetti-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .confetti {
    position: absolute;
    width: 10px;
    height: 10px;
    background: var(--color);
    left: var(--x);
    top: -20px;
    animation: confetti-fall 2s ease-out forwards;
    animation-delay: var(--delay);
    transform: rotate(var(--rotation));
  }

  @keyframes confetti-fall {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(720deg);
      opacity: 0;
    }
  }

  /* Header */
  .header {
    background: linear-gradient(
      180deg,
      var(--arena-dark) 0%,
      var(--arena-deep) 100%
    );
    border-bottom: 2px solid var(--arena-elevated);
    position: relative;
    overflow: hidden;
  }

  .header::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--primary, var(--ice-blue)) 50%,
      transparent 100%
    );
    opacity: 0.05;
  }

  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: var(--space-md) var(--space-lg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg);
    position: relative;
  }

  .club-identity {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
  }

  .club-badge {
    position: relative;
    width: 50px;
    height: 50px;
  }

  .badge-inner {
    position: absolute;
    inset: 3px;
    background: linear-gradient(135deg, var(--primary, #3b82f6), var(--secondary, #fbbf24));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.2);
  }

  .badge-initial {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .badge-ring {
    position: absolute;
    inset: 0;
    border: 2px solid var(--secondary, #fbbf24);
    border-radius: 50%;
    opacity: 0.8;
  }

  .club-name {
    font-size: 1.6rem;
    color: var(--ice-white);
    margin: 0;
    letter-spacing: 0.05em;
  }

  .club-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-xs);
  }

  .era-badge {
    font-family: var(--font-score);
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    background: var(--arena-surface);
    border: 1px solid var(--arena-elevated);
    border-radius: var(--radius-sm);
    color: var(--score-gold);
    letter-spacing: 0.1em;
  }

  .era-name {
    font-size: 0.85rem;
    color: var(--ice-pale);
    opacity: 0.7;
  }

  .header-scoreboard {
    display: flex;
    gap: var(--space-xl);
  }

  .record,
  .time-played {
    text-align: center;
  }

  .record-label,
  .time-label {
    display: block;
    font-size: 0.65rem;
    color: var(--ice-blue);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 2px;
  }

  .record-value,
  .time-value {
    font-family: var(--font-score);
    font-size: 0.95rem;
    color: var(--ice-white);
    letter-spacing: 0.05em;
  }

  /* Main */
  .main {
    max-width: 1400px;
    margin: 0 auto;
    padding: var(--space-lg);
  }

  /* Resources Panel */
  .resources-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  .resource-card {
    background: linear-gradient(
      135deg,
      var(--arena-surface) 0%,
      var(--arena-dark) 100%
    );
    border: 1px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    box-shadow: var(--shadow-card);
    position: relative;
    overflow: hidden;
  }

  .resource-card.primary {
    border-color: var(--ice-blue);
    box-shadow: var(--shadow-card), 0 0 20px var(--ice-glow);
  }

  .resource-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--ice-blue), transparent);
    opacity: 0.5;
  }

  .resource-icon {
    width: 40px;
    height: 40px;
    background: var(--arena-elevated);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ice-blue);
    flex-shrink: 0;
  }

  .resource-icon.fans {
    color: var(--score-red);
  }

  .resource-icon.money {
    color: var(--score-gold);
  }

  .resource-icon svg {
    width: 22px;
    height: 22px;
  }

  .resource-content {
    flex: 1;
  }

  .resource-label {
    display: block;
    font-size: 0.65rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 2px;
  }

  .resource-value {
    display: block;
    font-size: 1.5rem;
    color: var(--ice-white);
    line-height: 1.2;
  }

  .resource-rate {
    display: flex;
    gap: var(--space-sm);
    margin-top: 2px;
    font-size: 0.7rem;
  }

  .rate-passive {
    color: var(--score-green);
  }

  .rate-click {
    color: var(--ice-blue);
    opacity: 0.7;
  }

  /* Game Grid */
  .game-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--space-lg);
  }

  .panel {
    background: linear-gradient(
      180deg,
      var(--arena-surface) 0%,
      var(--arena-dark) 100%
    );
    border: 1px solid var(--arena-elevated);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
  }

  .panel-header {
    margin-bottom: var(--space-md);
  }

  .panel-header h2 {
    font-size: 1.3rem;
    color: var(--ice-white);
    margin-bottom: 2px;
  }

  .panel-hint {
    font-size: 0.75rem;
    color: var(--ice-blue);
    opacity: 0.7;
  }

  /* Training Rink */
  .rink-button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .rink {
    width: 100%;
    aspect-ratio: 2 / 1;
    max-width: 320px;
    margin: 0 auto;
    background: linear-gradient(
      180deg,
      #e8f4fc 0%,
      #d4e9f7 50%,
      #c0ddf2 100%
    );
    border-radius: 80px;
    border: 4px solid var(--score-red);
    position: relative;
    overflow: hidden;
    transition: transform 0.1s, box-shadow 0.2s;
    box-shadow:
      inset 0 4px 20px rgba(0, 0, 0, 0.1),
      0 8px 30px rgba(0, 0, 0, 0.3);
  }

  .rink-button:hover .rink {
    transform: scale(1.02);
    box-shadow:
      inset 0 4px 20px rgba(0, 0, 0, 0.1),
      0 10px 40px rgba(0, 0, 0, 0.3),
      0 0 60px var(--ice-glow);
  }

  .rink-button:active .rink {
    transform: scale(0.98);
  }

  .ice-surface {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        ellipse at 30% 30%,
        rgba(255, 255, 255, 0.8) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse at 70% 70%,
        rgba(255, 255, 255, 0.4) 0%,
        transparent 40%
      );
  }

  .ice-reflection {
    position: absolute;
    top: 10%;
    left: 10%;
    right: 10%;
    height: 30%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.4) 0%,
      transparent 100%
    );
    border-radius: 50%;
  }

  .center-ice {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .center-circle {
    width: 60px;
    height: 60px;
    border: 3px solid #2563eb;
    border-radius: 50%;
  }

  .center-dot {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 12px;
    background: #2563eb;
    border-radius: 50%;
  }

  .center-line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 4px;
    background: var(--score-red);
    transform: translateX(-50%);
  }

  .blue-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #2563eb;
  }

  .blue-line.left {
    left: 25%;
  }

  .blue-line.right {
    right: 25%;
  }

  .goal-crease {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 30px;
    height: 50px;
    border: 2px solid var(--score-red);
    border-radius: 0 50% 50% 0;
  }

  .goal-crease.left {
    left: 0;
    border-left: none;
  }

  .goal-crease.right {
    right: 0;
    border-radius: 50% 0 0 50%;
    border-right: none;
  }

  .puck {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    background: radial-gradient(
      circle at 30% 30%,
      #333 0%,
      #111 100%
    );
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 4px 8px rgba(0, 0, 0, 0.4),
      inset 0 2px 4px rgba(255, 255, 255, 0.1);
    transition: transform 0.1s;
  }

  .rink-button:hover .puck {
    transform: translate(-50%, -50%) scale(1.1);
  }

  .rink-button:active .puck {
    transform: translate(-50%, -50%) scale(0.9);
  }

  .puck-plus {
    font-family: var(--font-score);
    font-size: 0.7rem;
    color: var(--score-gold);
    text-shadow: 0 0 10px var(--score-gold);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .rink-button:hover .puck-plus {
    opacity: 1;
  }

  .click-ripple {
    position: absolute;
    width: 40px;
    height: 40px;
    border: 3px solid var(--ice-blue);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: ice-ripple 0.6s ease-out forwards;
    pointer-events: none;
  }

  /* Match Panel */
  .match-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .match-btn {
    width: 100%;
    aspect-ratio: 1;
    max-width: 140px;
    margin: 0 auto;
    background: linear-gradient(
      135deg,
      var(--score-green) 0%,
      #1fa268 100%
    );
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow:
      0 6px 24px var(--score-green-glow),
      inset 0 2px 0 rgba(255, 255, 255, 0.2);
    position: relative;
  }

  .match-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow:
      0 12px 40px var(--score-green-glow),
      inset 0 2px 0 rgba(255, 255, 255, 0.2);
  }

  .match-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .match-btn:disabled {
    background: var(--arena-elevated);
    cursor: not-allowed;
    box-shadow: none;
  }

  .cooldown-ring {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cooldown-ring svg {
    position: absolute;
    inset: 10px;
    transform: rotate(-90deg);
  }

  .cooldown-bg {
    fill: none;
    stroke: var(--arena-dark);
    stroke-width: 6;
  }

  .cooldown-progress {
    fill: none;
    stroke: var(--ice-blue);
    stroke-width: 6;
    stroke-linecap: round;
    stroke-dasharray: 283;
    transition: stroke-dashoffset 0.1s linear;
  }

  .cooldown-time {
    font-family: var(--font-score);
    font-size: 1.2rem;
    color: var(--ice-white);
    text-shadow: 0 0 10px var(--ice-glow);
  }

  .match-ready {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    color: white;
  }

  .whistle-icon {
    width: 32px;
    height: 32px;
  }

  .match-ready span {
    font-family: var(--font-display);
    font-size: 1.1rem;
    letter-spacing: 0.1em;
  }

  .match-result {
    background: var(--arena-dark);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    text-align: center;
    border: 2px solid var(--arena-elevated);
  }

  .match-result.won {
    border-color: var(--score-green);
    box-shadow: 0 0 20px var(--score-green-glow);
  }

  .match-result:not(.won) {
    border-color: var(--score-red);
    box-shadow: 0 0 20px var(--score-red-glow);
  }

  .result-header {
    margin-bottom: var(--space-xs);
  }

  .result-label {
    font-family: var(--font-display);
    font-size: 1.1rem;
    letter-spacing: 0.1em;
  }

  .match-result.won .result-label {
    color: var(--score-green);
  }

  .match-result:not(.won) .result-label {
    color: var(--score-red);
  }

  .result-score {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .score-home,
  .score-away {
    font-family: var(--font-score);
    font-size: 2.2rem;
    color: var(--ice-white);
    text-shadow: 0 0 20px var(--ice-glow);
  }

  .score-divider {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--ice-pale);
    opacity: 0.5;
  }

  .result-rewards {
    display: flex;
    justify-content: center;
    gap: var(--space-lg);
  }

  .reward {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-score);
    font-size: 0.8rem;
    color: var(--score-green);
  }

  .reward svg {
    width: 16px;
    height: 16px;
  }

  .match-placeholder {
    text-align: center;
    padding: var(--space-lg);
    color: var(--ice-pale);
    opacity: 0.5;
  }

  /* Upgrades Panel */
  .upgrades-panel {
    grid-column: 1 / -1;
  }

  .upgrades-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--space-sm);
  }

  .upgrade-card {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    background: var(--arena-dark);
    border: 2px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    text-align: left;
    transition: all 0.2s ease;
  }

  .upgrade-card:hover:not(:disabled) {
    border-color: var(--ice-blue);
    transform: translateY(-2px);
  }

  .upgrade-card.affordable {
    border-color: var(--score-green);
    box-shadow: 0 0 20px var(--score-green-glow);
  }

  .upgrade-card.maxed {
    opacity: 0.5;
  }

  .upgrade-card:disabled {
    cursor: not-allowed;
  }

  .upgrade-card.locked {
    opacity: 0.6;
    border-color: var(--arena-elevated);
    cursor: default;
  }

  .upgrade-card.locked .upgrade-icon {
    opacity: 0.5;
  }

  .locked-badge {
    font-size: 0.65rem;
    color: var(--score-red);
    background: rgba(230, 57, 70, 0.2);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-family: var(--font-score);
    letter-spacing: 0.1em;
  }

  .unlock-requirement {
    font-size: 0.7rem;
    color: var(--ice-blue);
    margin-top: 4px;
    font-style: italic;
  }

  .upgrade-icon {
    width: 40px;
    height: 40px;
    background: var(--arena-surface);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ice-blue);
    flex-shrink: 0;
  }

  .upgrade-card.affordable .upgrade-icon {
    color: var(--score-green);
  }

  .upgrade-icon svg {
    width: 20px;
    height: 20px;
  }

  .upgrade-info {
    flex: 1;
    min-width: 0;
  }

  .upgrade-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
  }

  .upgrade-name {
    font-family: var(--font-display);
    font-size: 0.95rem;
    color: var(--ice-white);
    letter-spacing: 0.05em;
  }

  .upgrade-level {
    font-family: var(--font-score);
    font-size: 0.65rem;
    color: var(--ice-blue);
  }

  .upgrade-desc {
    font-size: 0.7rem;
    color: var(--ice-pale);
    opacity: 0.7;
    margin-bottom: 4px;
    line-height: 1.3;
  }

  .upgrade-progress {
    margin-top: 4px;
  }

  .progress-bar {
    height: 3px;
    background: var(--arena-elevated);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--ice-blue), var(--score-gold));
    transition: width 0.3s ease;
  }

  .upgrade-cost {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.35rem 0.6rem;
    background: var(--arena-surface);
    border-radius: var(--radius-sm);
    min-width: 60px;
  }

  .cost-value {
    font-family: var(--font-score);
    font-size: 0.9rem;
    color: var(--score-gold);
  }

  .cost-unit {
    font-size: 0.6rem;
    color: var(--ice-pale);
    opacity: 0.6;
    text-transform: uppercase;
  }

  .maxed-label {
    font-family: var(--font-display);
    font-size: 0.8rem;
    color: var(--score-green);
    letter-spacing: 0.1em;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      text-align: center;
      gap: var(--space-lg);
    }

    .club-identity {
      flex-direction: column;
    }

    .header-scoreboard {
      width: 100%;
      justify-content: center;
    }

    .game-grid {
      grid-template-columns: 1fr;
    }

    .upgrades-panel {
      grid-column: auto;
    }
  }
</style>
