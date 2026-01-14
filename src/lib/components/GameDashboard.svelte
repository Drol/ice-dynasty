<script lang="ts">
  import { gameState, trainingRate, totalMinutes, clickPower, visibleUpgrades, lockedUpgrades, matchesUnlocked, MATCH_UNLOCK_THRESHOLD, moraleMultiplier, winChance, challengesWithStatus, activeChallenge as activeChallengeStore, completedChallenges, currentTactic as currentTacticStore, passiveIncomeRate, currentSeason, seasonCompleted, seasonProgress, potentialReputationGain, currentReputation, reputationUpgradesWithStatus, matchCost as matchCostStore, canAffordMatch as canAffordMatchStore, affordableUpgradesCount, affordableRepUpgradesCount, autoMatchInterval as autoMatchIntervalStore, timeUntilAutoMatch as timeUntilAutoMatchStore } from '$lib/stores/game-state';
  import { formatNumber, formatDuration, formatMoney } from '$lib/utils/format';
  import { calculateUpgradeCost, calculateMoraleCost, TACTIC_MODIFIERS, canAffordUpgrade, getChallengeGoalWins, getChallengeRestriction, getTotalChallengeReward, getNextLevelReward } from '$lib/game/formulas';
  import type { MatchTactic, ChallengeRestriction } from '$lib/game/types';
  import type { MatchResult, Achievement, Challenge } from '$lib/game/types';
  import DevTools from './DevTools.svelte';
  import Modal from './Modal.svelte';

  // Tab navigation
  type TabId = 'dashboard' | 'upgrades' | 'club' | 'achievements' | 'challenges';
  let activeTab = $state<TabId>('dashboard');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
    { id: 'upgrades', label: 'Upgrades', icon: 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z' },
    { id: 'club', label: 'Club', icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z' },
    { id: 'achievements', label: 'Achievements', icon: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z' },
    { id: 'challenges', label: 'Challenges', icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z' },
  ];

  const game = $derived($gameState);
  const rate = $derived($trainingRate);
  const minutes = $derived($totalMinutes);
  const clickPwr = $derived($clickPower);
  const available = $derived($visibleUpgrades);
  const locked = $derived($lockedUpgrades);
  const matchUnlocked = $derived($matchesUnlocked);
  const moraleMult = $derived($moraleMultiplier);
  const currentWinChance = $derived($winChance);
  const tactic = $derived($currentTacticStore);
  const incomeRate = $derived($passiveIncomeRate);

  // Season data
  const season = $derived($currentSeason);
  const seasonDone = $derived($seasonCompleted);
  const progress = $derived($seasonProgress);
  const repGain = $derived($potentialReputationGain);
  const reputation = $derived($currentReputation);
  const repUpgrades = $derived($reputationUpgradesWithStatus);

  // Badge counts for tabs
  const upgradesBuyable = $derived($affordableUpgradesCount);
  const repUpgradesBuyable = $derived($affordableRepUpgradesCount);

  // Auto-match
  const autoMatchInterval = $derived($autoMatchIntervalStore);
  const timeUntilAutoMatch = $derived($timeUntilAutoMatchStore);

  // End Season modal state
  let showEndSeasonModal = $state(false);
  let lastSeasonReward = $state(0);

  // Abandon Challenge modal state
  let showAbandonModal = $state(false);

  function handleEndSeason() {
    const reward = gameState.endSeason();
    if (reward > 0) {
      lastSeasonReward = reward;
      showEndSeasonModal = false;
    }
  }

  function handleAbandonChallenge() {
    gameState.abandonChallenge();
    showAbandonModal = false;
  }

  function handleBuyRepUpgrade(upgradeId: string) {
    gameState.buyReputationUpgrade(upgradeId);
  }

  // Tactic info for display
  const tacticInfo = $derived({
    offensive: { icon: 'M3 2l8 10-8 10h4l8-10-8-10H3z', label: 'Offensive', desc: '-15% win, +50% money' },
    balanced: { icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', label: 'Balanced', desc: 'No modifiers' },
    defensive: { icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z', label: 'Defensive', desc: '+10% win, +50% fans, -30% money' },
  });

  function handleTacticChange(newTactic: MatchTactic) {
    gameState.setTactic(newTactic);
  }

  // Achievement helpers
  const bonusAchievements = $derived(
    game.achievements.filter((a: Achievement) => a.rewardType === 'bonus')
  );
  const cosmeticAchievements = $derived(
    game.achievements.filter((a: Achievement) => a.rewardType === 'cosmetic')
  );
  const unlockedCount = $derived(
    game.achievements.filter((a: Achievement) => a.unlocked).length
  );

  // Challenge helpers (all challenges available from start - AD style)
  const challenges = $derived($challengesWithStatus);
  const currentChallenge = $derived($activeChallengeStore);
  const challengesWithProgress = $derived($completedChallenges);
  // Challenges that can still level up (not at max level and not active)
  const availableChallenges = $derived(
    challenges.filter((c) => c.canStart)
  );
  // Total levels completed across all challenges
  const totalLevelsCompleted = $derived(
    challenges.reduce((sum, c) => sum + c.currentLevel, 0)
  );
  const maxTotalLevels = $derived(challenges.length * 5);

  let lastMatchResult = $state<MatchResult | null>(null);
  let clickRipples = $state<Array<{ id: number; x: number; y: number }>>([]);
  let rippleId = 0;
  let showGoalCelebration = $state(false);

  // Match cost (training minutes)
  const currentMatchCost = $derived($matchCostStore);
  const canAffordMatch = $derived($canAffordMatchStore);

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
    return canAffordUpgrade(game, upgradeId);
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

  function handleBoostMorale() {
    gameState.boostMorale();
  }

  function handleStartChallenge(challengeId: string) {
    gameState.startChallenge(challengeId);
  }

  function getChallengeProgress(challenge: Challenge): number {
    const goalWins = getChallengeGoalWins(challenge, challenge.attemptingLevel || 1);
    return (challenge.currentWins / goalWins) * 100;
  }

  function getRestrictionText(restriction: ChallengeRestriction): string {
    const { type, value } = restriction;
    switch (type) {
      case 'winChanceCap':
        return `Win chance capped at ${Math.round((value as number) * 100)}%`;
      case 'noMoney':
        return value && (value as number) > 0
          ? `No money + ${Math.round((value as number) * 100)}% slower training`
          : 'No money income (matches or passive)';
      case 'trainingDecay':
        return `Training decays ${Math.round((value as number) * 100)}% per second`;
      case 'forcedTactic':
        return `Locked to ${value} tactic`;
      case 'noUpgrades':
        return value && (value as number) > 1
          ? `No upgrades + ${value}x match cost`
          : 'Cannot buy season upgrades';
      case 'timeLimit':
        return `Complete within ${Math.round(value as number)} seconds`;
      case 'highGoal':
        return `Requires ${value} wins`;
      default:
        return '';
    }
  }

  // Short restriction text for header display
  function getShortRestrictionText(restriction: ChallengeRestriction): string {
    const { type, value } = restriction;
    switch (type) {
      case 'winChanceCap':
        return `${Math.round((value as number) * 100)}% win cap`;
      case 'noMoney':
        return 'No money';
      case 'trainingDecay':
        return `${Math.round((value as number) * 100)}% decay`;
      case 'forcedTactic':
        return `${value} only`;
      case 'noUpgrades':
        return 'No upgrades';
      case 'timeLimit':
        return `${Math.round(value as number)}s limit`;
      case 'highGoal':
        return `${value} wins`;
      default:
        return '';
    }
  }

  // Generate star display for challenge levels (★★★☆☆)
  function getLevelStars(challenge: Challenge): string {
    const filled = '★'.repeat(challenge.currentLevel);
    const empty = '☆'.repeat(challenge.maxLevel - challenge.currentLevel);
    return filled + empty;
  }

  // Get the restriction for the next level to attempt
  function getNextLevelRestriction(challenge: Challenge): ChallengeRestriction {
    const nextLevel = challenge.currentLevel + 1;
    // Return base restriction for maxed challenges (won't be displayed anyway)
    if (nextLevel > challenge.maxLevel) {
      return challenge.baseRestriction;
    }
    return getChallengeRestriction(challenge, nextLevel);
  }

  // Format reward description with level multiplier
  function getRewardDescription(challenge: Challenge, level: number): string {
    const baseValue = challenge.baseReward.value;
    const scaling = challenge.rewardScaling[level - 1] || 1;
    const scaledValue = baseValue * scaling;
    const percentValue = Math.round(scaledValue * 100);
    return `+${percentValue}% ${challenge.baseReward.type.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`;
  }

  const moraleCost = $derived(calculateMoraleCost(game.morale.level));
  const canAffordMorale = $derived(game.resources.money >= moraleCost);
  const moraleMaxed = $derived(game.morale.level >= game.morale.maxLevel);
  const moraleProgress = $derived((game.morale.level / game.morale.maxLevel) * 100);

  // Unified Rink State
  type RinkMode = 'training' | 'match';
  let rinkMode = $state<RinkMode>('training');
  let isPlayingMatch = $state(false);
  let matchAnimationTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  // Generate random opponent colors for each match
  const OPPONENT_COLOR_PALETTES = [
    { primary: '#1e40af', secondary: '#fbbf24' }, // Blue/Gold
    { primary: '#166534', secondary: '#ffffff' }, // Green/White
    { primary: '#7c2d12', secondary: '#fcd34d' }, // Brown/Yellow
    { primary: '#4c1d95', secondary: '#c4b5fd' }, // Purple/Lavender
    { primary: '#0f766e', secondary: '#fef3c7' }, // Teal/Cream
    { primary: '#be185d', secondary: '#fbcfe8' }, // Pink/LightPink
    { primary: '#ea580c', secondary: '#1e293b' }, // Orange/Slate
    { primary: '#0369a1', secondary: '#f97316' }, // Sky/Orange
  ];

  let opponentColors = $state(OPPONENT_COLOR_PALETTES[0]);

  function getRandomOpponentColors() {
    // Make sure opponent colors are different from team colors
    const teamPrimary = game.club?.colors?.primary || '#dc2626';
    const available = OPPONENT_COLOR_PALETTES.filter(
      (p) => p.primary !== teamPrimary
    );
    return available[Math.floor(Math.random() * available.length)];
  }

  // Player positions for animation (relative %)
  interface RinkPlayer {
    id: number;
    x: number;
    y: number;
    team: 'home' | 'away';
    isGoalie?: boolean;
    animationDelay: number;
  }

  const trainingPlayers: RinkPlayer[] = [
    { id: 1, x: 30, y: 30, team: 'home', animationDelay: 0 },
    { id: 2, x: 50, y: 50, team: 'home', animationDelay: 0.2 },
    { id: 3, x: 70, y: 40, team: 'home', animationDelay: 0.4 },
    { id: 4, x: 40, y: 65, team: 'home', animationDelay: 0.6 },
  ];

  const matchPlayers: RinkPlayer[] = [
    // Home team (5 + goalie)
    { id: 1, x: 15, y: 50, team: 'home', isGoalie: true, animationDelay: 0 },
    { id: 2, x: 25, y: 30, team: 'home', animationDelay: 0.1 },
    { id: 3, x: 25, y: 70, team: 'home', animationDelay: 0.15 },
    { id: 4, x: 35, y: 45, team: 'home', animationDelay: 0.2 },
    { id: 5, x: 35, y: 55, team: 'home', animationDelay: 0.25 },
    { id: 6, x: 45, y: 50, team: 'home', animationDelay: 0.3 },
    // Away team (5 + goalie)
    { id: 7, x: 85, y: 50, team: 'away', isGoalie: true, animationDelay: 0.05 },
    { id: 8, x: 75, y: 30, team: 'away', animationDelay: 0.12 },
    { id: 9, x: 75, y: 70, team: 'away', animationDelay: 0.18 },
    { id: 10, x: 65, y: 45, team: 'away', animationDelay: 0.22 },
    { id: 11, x: 65, y: 55, team: 'away', animationDelay: 0.28 },
    { id: 12, x: 55, y: 50, team: 'away', animationDelay: 0.32 },
  ];

  const rinkPlayers = $derived(rinkMode === 'match' ? matchPlayers : trainingPlayers);

  function handleRinkClick(e: MouseEvent) {
    if (rinkMode === 'training' && !isPlayingMatch) {
      handleTrainClick(e);
    }
  }

  function handleStartMatchWithTactic(selectedTactic: MatchTactic) {
    if (!matchUnlocked || !canAffordMatch || isPlayingMatch) return;

    // Set tactic first
    gameState.setTactic(selectedTactic);

    // Generate new opponent colors
    opponentColors = getRandomOpponentColors();

    // Switch to match mode
    rinkMode = 'match';
    isPlayingMatch = true;

    // Play match after animation delay
    matchAnimationTimer = setTimeout(() => {
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

      // Return to training mode after showing result
      setTimeout(() => {
        rinkMode = 'training';
        isPlayingMatch = false;
      }, 2000);
    }, 2500);
  }

  // Cleanup timer on component destroy
  $effect(() => {
    return () => {
      if (matchAnimationTimer) {
        clearTimeout(matchAnimationTimer);
      }
    };
  });
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

      <!-- Resources integrated into header -->
      <div class="header-resources-inline">
        <div class="header-resource training">
          <svg class="header-resource-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
          </svg>
          <div class="header-resource-content">
            <span class="header-resource-value">{formatNumber(minutes)}</span>
            <span class="header-resource-rate">+{formatNumber(rate)}/s</span>
          </div>
        </div>

        <div class="header-resource fans">
          <svg class="header-resource-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <span class="header-resource-value">{formatNumber(game.resources.fans)}</span>
        </div>

        <div class="header-resource money">
          <svg class="header-resource-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
          </svg>
          <div class="header-resource-content">
            <span class="header-resource-value">{formatMoney(game.resources.money)}</span>
            {#if incomeRate > 0}
              <span class="header-resource-rate">+{formatMoney(incomeRate)}/s</span>
            {/if}
          </div>
        </div>

        <div class="header-divider"></div>

        <div class="season-info">
          <span class="season-label">Season {season.number}</span>
          <div class="season-progress">
            <div class="season-progress-bar">
              <div class="season-progress-fill" style="width: {progress.percentage}%"></div>
            </div>
            <span class="season-progress-text">{progress.wins}/{progress.goal}</span>
          </div>
          {#if seasonDone}
            <button class="end-season-btn" onclick={() => showEndSeasonModal = true}>
              End Season (+{repGain})
            </button>
          {/if}
        </div>

        <div class="record">
          <span class="record-value">{game.stats.matchesWon}W-{game.stats.matchesPlayed - game.stats.matchesWon}L</span>
        </div>

        <div class="reputation-display">
          <span class="rep-value">{formatNumber(reputation)} Rep</span>
        </div>
      </div>
    </div>

    <!-- Active Challenge Indicator -->
    {#if currentChallenge}
      <div class="header-challenge-bar">
        <div class="challenge-indicator">
          <!-- Jersey icon with team colors -->
          <svg class="challenge-jersey" viewBox="0 0 24 24">
            <path class="jersey-body" d="M6 4L4 6v14h16V6l-2-2h-3v2a3 3 0 01-6 0V4H6z" fill="var(--primary, #3b82f6)"/>
            <path class="jersey-collar" d="M9 4v2a3 3 0 006 0V4" fill="none" stroke="var(--secondary, #fbbf24)" stroke-width="1.5"/>
            <path class="jersey-sleeves" d="M4 6L2 8v4l2-1V6zM20 6l2 2v4l-2-1V6z" fill="var(--secondary, #fbbf24)"/>
          </svg>
          <span class="challenge-name">{currentChallenge.name} L{currentChallenge.attemptingLevel}</span>
          <span class="challenge-restriction">{getShortRestrictionText(getChallengeRestriction(currentChallenge, currentChallenge.attemptingLevel))}</span>
          <span class="challenge-wins">{currentChallenge.currentWins}/{getChallengeGoalWins(currentChallenge, currentChallenge.attemptingLevel)} wins</span>
        </div>
        <button class="challenge-abandon-btn" onclick={() => showAbandonModal = true}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          Abandon
        </button>
      </div>
    {/if}

    <!-- Auto-Match Indicator -->
    {#if autoMatchInterval !== null}
      <div class="header-auto-match-bar">
        <div class="auto-match-indicator">
          <svg class="auto-match-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
          <span class="auto-match-label">Auto-Match</span>
          <span class="auto-match-countdown">{Math.ceil(timeUntilAutoMatch ?? 0)}s</span>
        </div>
      </div>
    {/if}
  </header>

  <!-- Tab Navigation -->
  <nav class="tab-nav">
    <div class="tab-nav-content">
      {#each tabs as tab}
        <button
          class="tab-btn"
          class:active={activeTab === tab.id}
          onclick={() => activeTab = tab.id}
        >
          <svg class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d={tab.icon} />
          </svg>
          <span class="tab-label">{tab.label}</span>
          {#if tab.id === 'upgrades' && upgradesBuyable > 0}
            <span class="tab-badge buyable">{upgradesBuyable}</span>
          {/if}
          {#if tab.id === 'club' && repUpgradesBuyable > 0}
            <span class="tab-badge buyable">{repUpgradesBuyable}</span>
          {/if}
          {#if tab.id === 'achievements' && unlockedCount > 0}
            <span class="tab-badge">{unlockedCount}</span>
          {/if}
          {#if tab.id === 'challenges' && currentChallenge}
            <span class="tab-badge active-badge">!</span>
          {:else if tab.id === 'challenges' && totalLevelsCompleted > 0}
            <span class="tab-badge">{totalLevelsCompleted}</span>
          {/if}
        </button>
      {/each}
    </div>
  </nav>

  <main class="main">
    <!-- Tab Content -->
    {#if activeTab === 'dashboard'}
      <!-- Lagmoral (Global Multiplier) - Dashboard only -->
      <section class="morale-panel">
        <div class="morale-header">
          <div class="morale-title">
            <svg class="morale-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <div class="morale-info">
              <h3>Team Morale</h3>
              <span class="morale-hint">Global multiplier for all production</span>
            </div>
          </div>
          <div class="morale-stats">
            <div class="morale-level">
              <span class="level-label">Level</span>
              <span class="level-value">{game.morale.level}/{game.morale.maxLevel}</span>
            </div>
            <div class="morale-multiplier">
              <span class="mult-label">Boost</span>
              <span class="mult-value">{moraleMult.toFixed(2)}x</span>
            </div>
          </div>
        </div>

        <div class="morale-progress-container">
          <div class="morale-progress-bar">
            <div class="morale-progress-fill" style="width: {moraleProgress}%"></div>
          </div>
        </div>

        <button
          class="morale-boost-btn"
          class:affordable={canAffordMorale}
          class:maxed={moraleMaxed}
          onclick={handleBoostMorale}
          disabled={!canAffordMorale || moraleMaxed}
        >
          {#if moraleMaxed}
            <span class="btn-text">Maximum Morale</span>
          {:else}
            <div class="btn-content">
              <span class="btn-text">Boost Morale</span>
              <span class="btn-cost">{formatMoney(moraleCost)}</span>
            </div>
          {/if}
        </button>
      </section>
      <!-- Unified Rink Panel -->
      <section class="panel unified-rink-panel">
        <!-- Action Buttons -->
        <div class="rink-actions">
          <button
            class="action-btn training-btn"
            class:active={rinkMode === 'training' && !isPlayingMatch}
            onclick={() => { rinkMode = 'training'; }}
            disabled={isPlayingMatch}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="action-icon">
              <path d="M12 2L8 6H4v4l-2 2 2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4l-4-4z"/>
            </svg>
            <span class="action-label">Train</span>
            <span class="action-value">+{formatNumber(clickPwr)}/click</span>
          </button>

          {#if matchUnlocked}
            <button
              class="action-btn offensive-btn"
              class:active={tactic === 'offensive' && isPlayingMatch}
              onclick={() => handleStartMatchWithTactic('offensive')}
              disabled={!canAffordMatch || isPlayingMatch}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="action-icon">
                <path d="M3 2l8 10-8 10h4l8-10-8-10H3z"/>
              </svg>
              <span class="action-label">Offensive</span>
              <span class="action-value">-15% win, +50% $</span>
            </button>

            <button
              class="action-btn balanced-btn"
              class:active={tactic === 'balanced' && isPlayingMatch}
              onclick={() => handleStartMatchWithTactic('balanced')}
              disabled={!canAffordMatch || isPlayingMatch}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="action-icon">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span class="action-label">Balanced</span>
              <span class="action-value">No modifier</span>
            </button>

            <button
              class="action-btn defensive-btn"
              class:active={tactic === 'defensive' && isPlayingMatch}
              onclick={() => handleStartMatchWithTactic('defensive')}
              disabled={!canAffordMatch || isPlayingMatch}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="action-icon">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
              <span class="action-label">Defensive</span>
              <span class="action-value">+10% win, -30% $</span>
            </button>
          {:else}
            <div class="match-locked-info">
              <svg class="lock-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/>
              </svg>
              <span>Train {formatNumber(MATCH_UNLOCK_THRESHOLD - minutes)} more min to unlock matches</span>
            </div>
          {/if}
        </div>

        <!-- Win Chance & Cost Info -->
        {#if matchUnlocked}
          <div class="rink-info-bar">
            <div class="info-item">
              <span class="info-label">Win Chance</span>
              <span class="info-value" class:low={currentWinChance < 0.45} class:medium={currentWinChance >= 0.45 && currentWinChance < 0.6} class:high={currentWinChance >= 0.6}>
                {Math.round(currentWinChance * 100)}%
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Match Cost</span>
              <span class="info-value" class:affordable={canAffordMatch}>{formatNumber(currentMatchCost)} training</span>
            </div>
          </div>
        {/if}

        <!-- Unified Rink -->
        <button
          class="unified-rink-button"
          class:match-mode={rinkMode === 'match'}
          onclick={handleRinkClick}
          disabled={rinkMode === 'match'}
          style="--team-primary: {game.club?.colors?.primary || '#dc2626'}; --team-secondary: {game.club?.colors?.secondary || '#ffffff'}; --opponent-primary: {opponentColors.primary}; --opponent-secondary: {opponentColors.secondary};"
        >
          <div class="unified-rink">
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

            <!-- Goal nets -->
            <div class="goal-net left"></div>
            <div class="goal-net right"></div>

            <!-- Pixel Players -->
            {#each rinkPlayers as player (player.id)}
              <div
                class="pixel-player"
                class:home={player.team === 'home'}
                class:away={player.team === 'away'}
                class:goalie={player.isGoalie}
                class:match-mode={rinkMode === 'match'}
                style="left: {player.x}%; top: {player.y}%; animation-delay: {player.animationDelay}s;"
              ></div>
            {/each}

            <!-- Referee (only during match) -->
            {#if rinkMode === 'match'}
              <div class="pixel-referee" style="left: 50%; top: 25%;"></div>
              <div class="pixel-referee" style="left: 50%; top: 75%;"></div>
            {/if}

            <!-- Coach (only during training) -->
            {#if rinkMode === 'training'}
              <div class="pixel-coach" style="left: 8%; top: 50%;"></div>
            {/if}

            <!-- Puck -->
            <div class="pixel-puck" class:match-mode={rinkMode === 'match'}></div>

            <!-- Click ripples (training only) -->
            {#if rinkMode === 'training'}
              {#each clickRipples as ripple (ripple.id)}
                <div
                  class="click-ripple"
                  style="left: {ripple.x}px; top: {ripple.y}px"
                ></div>
              {/each}
            {/if}

            <!-- Training click indicator -->
            {#if rinkMode === 'training'}
              <div class="click-indicator">
                <span class="click-text">+{formatNumber(clickPwr)}</span>
              </div>
            {/if}

            <!-- Match animation overlay -->
            {#if isPlayingMatch && !lastMatchResult}
              <div class="match-animation-overlay">
                <span class="match-text">Playing...</span>
              </div>
            {/if}
          </div>
        </button>

        <!-- Match Result (shown after match) -->
        {#if lastMatchResult && rinkMode === 'match'}
          <div class="rink-match-result" class:won={lastMatchResult.won}>
            <div class="result-header">
              <span class="result-label">{lastMatchResult.won ? 'Victory!' : 'Defeat'}</span>
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
        {/if}
      </section>

    {:else if activeTab === 'upgrades'}
      <!-- Upgrades Tab -->
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

    {:else if activeTab === 'achievements'}
      <!-- Achievements Tab -->
      <section class="achievements-tab">
        <div class="achievements-header">
          <h2>Achievements</h2>
          <span class="achievements-count">{unlockedCount} / {game.achievements.length} Unlocked</span>
        </div>

        <!-- Bonus Achievements (always visible) -->
        <div class="achievement-section">
          <h3 class="achievement-section-title">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Bonus Achievements
          </h3>
          <p class="achievement-section-hint">These achievements grant permanent bonuses</p>

          <div class="achievements-grid">
            {#each bonusAchievements as achievement}
              <div class="achievement-card" class:unlocked={achievement.unlocked}>
                <div class="achievement-icon" class:unlocked={achievement.unlocked}>
                  {#if achievement.unlocked}
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  {:else}
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" opacity="0.3"/>
                    </svg>
                  {/if}
                </div>
                <div class="achievement-info">
                  <span class="achievement-name">{achievement.name}</span>
                  <span class="achievement-desc">
                    {#if achievement.unlocked}
                      {achievement.description}
                    {:else}
                      ???
                    {/if}
                  </span>
                  <span class="achievement-reward">
                    {#if achievement.bonusType === 'all'}
                      +{(achievement.bonusValue || 0) * 100}% to all stats
                    {:else if achievement.bonusType === 'winChance'}
                      +{(achievement.bonusValue || 0) * 100}% win chance
                    {:else if achievement.bonusType === 'fanGain'}
                      +{(achievement.bonusValue || 0) * 100}% fan gain
                    {:else if achievement.bonusType === 'moneyGain'}
                      +{(achievement.bonusValue || 0) * 100}% money gain
                    {:else if achievement.bonusType === 'trainingRate'}
                      +{(achievement.bonusValue || 0) * 100}% training rate
                    {:else if achievement.bonusType === 'baseMoney'}
                      +${achievement.bonusValue} base income
                    {:else}
                      +{(achievement.bonusValue || 0) * 100}% bonus
                    {/if}
                  </span>
                </div>
                {#if achievement.unlocked}
                  <div class="achievement-check">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Cosmetic Achievements (hidden until unlocked) -->
        <div class="achievement-section">
          <h3 class="achievement-section-title">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Secret Achievements
          </h3>
          <p class="achievement-section-hint">Discover hidden achievements through gameplay</p>

          <div class="achievements-grid">
            {#each cosmeticAchievements as achievement}
              {#if achievement.unlocked}
                <div class="achievement-card unlocked cosmetic">
                  <div class="achievement-badge">
                    {achievement.badge}
                  </div>
                  <div class="achievement-info">
                    <span class="achievement-name">{achievement.name}</span>
                    <span class="achievement-desc">{achievement.description}</span>
                  </div>
                  <div class="achievement-check">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                </div>
              {:else}
                <div class="achievement-card hidden">
                  <div class="achievement-icon hidden">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/>
                    </svg>
                  </div>
                  <div class="achievement-info">
                    <span class="achievement-name">???</span>
                    <span class="achievement-desc">Keep playing to discover</span>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </section>

    {:else if activeTab === 'challenges'}
      <!-- Challenges Tab -->
      <section class="challenges-tab">
        <div class="challenges-header">
          <h2>Challenges</h2>
          <span class="challenges-count">{totalLevelsCompleted} / {maxTotalLevels} Levels</span>
        </div>

        <!-- Active Challenge -->
        {#if currentChallenge}
          <div class="challenge-section active-section">
            <h3 class="challenge-section-title">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Active Challenge - Level {currentChallenge.attemptingLevel}
            </h3>

            <div class="challenge-card active">
              <div class="challenge-icon active">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
              </div>
              <div class="challenge-content">
                <div class="challenge-header-row">
                  <span class="challenge-name">{currentChallenge.name}</span>
                  <span class="challenge-progress-text">{currentChallenge.currentWins}/{getChallengeGoalWins(currentChallenge, currentChallenge.attemptingLevel)} wins</span>
                </div>
                <span class="challenge-stars">{getLevelStars(currentChallenge)}</span>
                <p class="challenge-desc">{currentChallenge.description}</p>
                <p class="challenge-restriction">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  {getRestrictionText(getChallengeRestriction(currentChallenge, currentChallenge.attemptingLevel))}
                </p>
                <div class="challenge-progress-bar">
                  <div class="challenge-progress-fill" style="width: {getChallengeProgress(currentChallenge)}%"></div>
                </div>
                <div class="challenge-footer">
                  <span class="challenge-reward">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    {getRewardDescription(currentChallenge, currentChallenge.attemptingLevel)}
                  </span>
                  <button class="abandon-btn" onclick={handleAbandonChallenge}>
                    Abandon
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- All Challenges (AD-style: all available from start) -->
        <div class="challenge-section">
          <h3 class="challenge-section-title">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            All Challenges
          </h3>
          <p class="challenge-section-hint">Complete levels 1-5 for stacking rewards. Harder levels = bigger bonuses!</p>

          <div class="challenges-grid">
            {#each challenges as challenge}
              <div class="challenge-card" class:maxed={challenge.isMaxed} class:has-progress={challenge.hasProgress}>
                <div class="challenge-icon" class:completed={challenge.isMaxed}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    {#if challenge.isMaxed}
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    {:else}
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                    {/if}
                  </svg>
                </div>
                <div class="challenge-content">
                  <div class="challenge-header-row">
                    <span class="challenge-name">{challenge.name}</span>
                    <span class="challenge-stars" class:maxed={challenge.isMaxed}>{getLevelStars(challenge)}</span>
                  </div>
                  <p class="challenge-desc">{challenge.description}</p>

                  {#if challenge.isMaxed}
                    <!-- Maxed out - show total reward -->
                    <p class="challenge-total-reward">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      Total: +{Math.round(getTotalChallengeReward(challenge) * 100)}% {challenge.baseReward.type}
                    </p>
                  {:else}
                    <!-- Show next level info -->
                    <p class="challenge-restriction">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                      L{challenge.currentLevel + 1}: {getRestrictionText(getNextLevelRestriction(challenge))}
                    </p>
                    <p class="challenge-goal">Goal: Win {getChallengeGoalWins(challenge, challenge.currentLevel + 1)} matches</p>
                    <div class="challenge-footer">
                      <span class="challenge-reward">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        {getRewardDescription(challenge, challenge.currentLevel + 1)}
                      </span>
                      <button
                        class="start-btn"
                        onclick={() => handleStartChallenge(challenge.id)}
                        disabled={!!currentChallenge}
                      >
                        {currentChallenge ? 'Active' : `Level ${challenge.currentLevel + 1}`}
                      </button>
                    </div>
                  {/if}

                  {#if challenge.currentLevel > 0 && !challenge.isMaxed}
                    <p class="challenge-current-bonus">
                      Current bonus: +{Math.round(getTotalChallengeReward(challenge) * 100)}%
                    </p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

      </section>
    {/if}

    <!-- Club Tab -->
    {#if activeTab === 'club'}
      <section class="tab-content club-content">
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
    {/if}
  </main>

  <!-- End Season Modal -->
  {#if showEndSeasonModal}
    <div class="modal-overlay" onclick={() => showEndSeasonModal = false}>
      <div class="modal-content end-season-modal" onclick={(e) => e.stopPropagation()}>
        <h2 class="modal-title">Season Complete!</h2>
        <p class="modal-subtitle">Congratulations on completing Season {season.number}!</p>

        <div class="season-summary">
          <div class="summary-stat">
            <span class="summary-label">Wins</span>
            <span class="summary-value">{season.wins}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-label">Losses</span>
            <span class="summary-value">{season.losses}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-label">Fans</span>
            <span class="summary-value">{formatNumber(game.resources.fans)}</span>
          </div>
          <div class="summary-stat highlight">
            <span class="summary-label">Reputation Earned</span>
            <span class="summary-value">+{repGain}</span>
          </div>
        </div>

        <div class="modal-warning">
          <p>Starting a new season will reset:</p>
          <ul>
            <li>Training minutes</li>
            <li>Fans and money</li>
            <li>Season upgrades</li>
            <li>Team morale</li>
          </ul>
          <p class="modal-keep">You will keep: Reputation, Reputation upgrades, Stats</p>
        </div>

        <div class="modal-actions">
          <button class="modal-btn cancel" onclick={() => showEndSeasonModal = false}>
            Keep Playing
          </button>
          <button class="modal-btn confirm" onclick={handleEndSeason}>
            End Season & Prestige
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Abandon Challenge Modal -->
  <Modal
    open={showAbandonModal}
    title="Abandon Challenge?"
    onclose={() => showAbandonModal = false}
    onconfirm={handleAbandonChallenge}
    confirmText="Abandon"
    cancelText="Keep Going"
    confirmDanger={true}
  >
    {#snippet children()}
      <p>Are you sure you want to abandon <strong>{currentChallenge?.name}</strong>?</p>
      <p style="margin-top: 0.5rem; color: var(--score-red);">Your progress ({currentChallenge?.currentWins} wins) will be lost.</p>
    {/snippet}
  </Modal>

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

  /* Header Resources Inline */
  .header-resources-inline {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .header-resource {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--arena-dark);
    border-radius: var(--radius-sm);
    border: 1px solid var(--arena-elevated);
  }

  .header-resource-icon {
    width: 16px;
    height: 16px;
    fill: var(--ice-blue);
  }

  .header-resource.training .header-resource-icon {
    fill: var(--ice-blue);
  }

  .header-resource.fans .header-resource-icon {
    fill: var(--score-red);
  }

  .header-resource.money .header-resource-icon {
    fill: var(--score-gold);
  }

  .header-resource-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }

  .header-resource-value {
    font-family: var(--font-score);
    font-size: 0.9rem;
    color: var(--ice-white);
    letter-spacing: 0.05em;
  }

  .header-resource-rate {
    font-size: 0.6rem;
    color: var(--ice-pale);
    opacity: 0.8;
  }

  .header-divider {
    width: 1px;
    height: 24px;
    background: var(--arena-elevated);
    margin: 0 var(--space-xs);
  }

  .season-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .season-label {
    font-family: var(--font-score);
    font-size: 0.75rem;
    color: var(--ice-blue);
    text-transform: uppercase;
  }

  .season-progress {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .season-progress-bar {
    width: 60px;
    height: 6px;
    background: var(--arena-dark);
    border-radius: 3px;
    overflow: hidden;
  }

  .season-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--ice-blue), var(--score-gold));
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .season-progress-text {
    font-family: var(--font-score);
    font-size: 0.7rem;
    color: var(--ice-pale);
  }

  .end-season-btn {
    padding: var(--space-xs) var(--space-sm);
    background: var(--score-gold);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--arena-deep);
    font-family: var(--font-display);
    font-size: 0.65rem;
    text-transform: uppercase;
    cursor: pointer;
    animation: pulse-gold 2s ease-in-out infinite;
  }

  @keyframes pulse-gold {
    0%, 100% { box-shadow: 0 0 5px var(--score-gold); }
    50% { box-shadow: 0 0 15px var(--score-gold); }
  }

  .record {
    font-family: var(--font-score);
    font-size: 0.8rem;
    color: var(--ice-pale);
  }

  .record-value {
    color: var(--ice-white);
  }

  .reputation-display {
    font-family: var(--font-score);
    font-size: 0.8rem;
  }

  .rep-value {
    color: var(--score-gold);
  }

  /* Tab Navigation */
  .tab-nav {
    background: var(--arena-deep);
    border-bottom: 2px solid var(--arena-elevated);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .tab-nav-content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-lg);
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    color: var(--ice-pale);
    font-family: var(--font-display);
    font-size: 0.9rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .tab-btn:hover {
    background: var(--arena-surface);
    color: var(--ice-white);
  }

  .tab-btn.active {
    background: var(--arena-surface);
    border-color: var(--ice-blue);
    color: var(--ice-white);
    box-shadow: 0 0 15px var(--ice-glow);
  }

  .tab-icon {
    width: 18px;
    height: 18px;
  }

  .tab-label {
    text-transform: uppercase;
  }

  .tab-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--score-gold);
    border-radius: 9px;
    font-family: var(--font-score);
    font-size: 0.65rem;
    color: var(--arena-deep);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(251, 191, 36, 0.4);
  }

  .tab-badge.buyable {
    background: var(--arena-green, #22c55e);
    color: white;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
    animation: pulse-badge 2s ease-in-out infinite;
  }

  @keyframes pulse-badge {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  /* Active Challenge Bar in Header */
  .header-challenge-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(90deg, var(--arena-deep) 0%, var(--arena-dark) 100%);
    padding: var(--space-sm) var(--space-md);
    border-top: 2px solid var(--score-gold);
    border-bottom: 1px solid var(--arena-elevated);
  }

  .challenge-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    font-family: var(--font-score);
    font-size: 0.8rem;
    color: var(--ice-white);
    flex: 1;
  }

  .challenge-jersey {
    width: 22px;
    height: 22px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    flex-shrink: 0;
  }

  .challenge-name {
    font-weight: bold;
    letter-spacing: 0.05em;
    color: var(--score-gold);
  }

  .challenge-indicator .challenge-restriction,
  .challenge-indicator .challenge-wins {
    display: flex;
    align-items: center;
    height: 22px;
    padding: 0 0.5rem;
    margin: 0;
    background: var(--arena-surface);
    border-radius: var(--radius-sm);
    color: var(--ice-white);
    font-family: var(--font-score);
    font-size: 0.7rem;
  }

  .challenge-indicator .challenge-restriction {
    border: 1px solid var(--score-red);
  }

  .challenge-indicator .challenge-wins {
    border: 1px solid var(--ice-blue);
  }

  .challenge-abandon-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: 0.2rem 0.5rem;
    background: transparent;
    border: 1px solid var(--score-red);
    border-radius: var(--radius-sm);
    color: var(--score-red);
    font-family: var(--font-score);
    font-size: 0.7rem;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0.7;
  }

  .challenge-abandon-btn:hover {
    background: var(--score-red);
    color: white;
    opacity: 1;
  }

  .challenge-abandon-btn svg {
    width: 12px;
    height: 12px;
  }

  /* Auto-Match Bar in Header */
  .header-auto-match-bar {
    background: linear-gradient(90deg, var(--ice-blue) 0%, rgba(96, 165, 250, 0.6) 100%);
    padding: var(--space-xs) var(--space-md);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .auto-match-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    font-family: var(--font-score);
    font-size: 0.75rem;
    color: var(--ice-white);
  }

  .auto-match-icon {
    width: 14px;
    height: 14px;
    opacity: 0.9;
    animation: spin-slow 3s linear infinite;
  }

  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .auto-match-label {
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .auto-match-countdown {
    font-family: var(--font-score);
    font-weight: bold;
    padding: 0.1rem 0.4rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    min-width: 35px;
    text-align: center;
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

  /* Morale Panel */
  .morale-panel {
    background: linear-gradient(
      135deg,
      var(--arena-surface) 0%,
      var(--arena-dark) 100%
    );
    border: 2px solid var(--score-gold);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card), 0 0 30px rgba(251, 191, 36, 0.1);
    position: relative;
    overflow: hidden;
    margin-bottom: var(--space-lg);
  }

  .morale-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--score-gold), transparent);
    opacity: 0.6;
  }

  .morale-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
    gap: var(--space-md);
  }

  .morale-title {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .morale-icon {
    width: 40px;
    height: 40px;
    color: var(--score-red);
    filter: drop-shadow(0 0 10px var(--score-red));
  }

  .morale-info h3 {
    font-size: 1.3rem;
    color: var(--ice-white);
    margin: 0 0 2px 0;
    letter-spacing: 0.05em;
  }

  .morale-hint {
    font-size: 0.7rem;
    color: var(--ice-blue);
    opacity: 0.7;
  }

  .morale-stats {
    display: flex;
    gap: var(--space-lg);
  }

  .morale-level,
  .morale-multiplier {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .level-label,
  .mult-label {
    font-size: 0.65rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .level-value {
    font-family: var(--font-score);
    font-size: 1.1rem;
    color: var(--ice-white);
    letter-spacing: 0.05em;
  }

  .mult-value {
    font-family: var(--font-score);
    font-size: 1.3rem;
    color: var(--score-gold);
    text-shadow: 0 0 10px var(--score-gold);
  }

  .morale-progress-container {
    margin-bottom: var(--space-md);
  }

  .morale-progress-bar {
    height: 12px;
    background: var(--arena-deep);
    border-radius: var(--radius-sm);
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .morale-progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--score-red) 0%,
      var(--score-gold) 50%,
      var(--score-green) 100%
    );
    transition: width 0.5s ease;
    box-shadow: 0 0 10px var(--score-gold);
    position: relative;
  }

  .morale-progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.3) 50%,
      transparent 100%
    );
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .morale-boost-btn {
    width: 100%;
    padding: var(--space-md);
    background: linear-gradient(
      135deg,
      var(--arena-elevated) 0%,
      var(--arena-dark) 100%
    );
    border: 2px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--ice-white);
    letter-spacing: 0.1em;
  }

  .morale-boost-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  .morale-boost-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .morale-boost-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .morale-boost-btn.affordable {
    background: linear-gradient(
      135deg,
      var(--score-gold) 0%,
      #d97706 100%
    );
    border-color: var(--score-gold);
    box-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
  }

  .morale-boost-btn.affordable:hover:not(:disabled) {
    box-shadow: 0 8px 30px rgba(251, 191, 36, 0.4);
  }

  .morale-boost-btn.maxed {
    background: linear-gradient(
      135deg,
      var(--score-green) 0%,
      #15803d 100%
    );
    border-color: var(--score-green);
    cursor: default;
  }

  .btn-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-text {
    text-transform: uppercase;
  }

  .btn-cost {
    font-family: var(--font-score);
    font-size: 1rem;
    color: var(--ice-white);
    background: rgba(0, 0, 0, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-sm);
  }

  /* Game Grid (legacy) */
  .game-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--space-lg);
  }

  /* Unified Rink Panel */
  .unified-rink-panel {
    width: 100%;
  }

  .rink-actions {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
    justify-content: center;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-sm) var(--space-md);
    background: var(--arena-elevated);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 85px;
  }

  .action-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    background: var(--arena-card);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.active {
    border-color: var(--ice-blue);
    box-shadow: 0 0 15px rgba(100, 200, 255, 0.3);
  }

  .action-icon {
    width: 24px;
    height: 24px;
    color: var(--ice-white);
  }

  .action-label {
    font-size: 0.7rem;
    color: var(--ice-white);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .action-value {
    font-size: 0.6rem;
    color: var(--ice-blue);
    opacity: 0.8;
  }

  /* Training button */
  .training-btn.active {
    border-color: var(--ice-blue);
  }

  .training-btn .action-icon {
    color: var(--ice-blue);
  }

  /* Offensive button */
  .offensive-btn:hover:not(:disabled) {
    border-color: var(--score-red);
  }

  .offensive-btn .action-icon {
    color: var(--score-red);
  }

  /* Balanced button */
  .balanced-btn:hover:not(:disabled) {
    border-color: var(--score-gold);
  }

  .balanced-btn .action-icon {
    color: var(--score-gold);
  }

  /* Defensive button */
  .defensive-btn:hover:not(:disabled) {
    border-color: var(--score-green);
  }

  .defensive-btn .action-icon {
    color: var(--score-green);
  }

  .match-locked-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-md);
    color: var(--ice-pale);
    font-size: 0.75rem;
  }

  .match-locked-info .lock-icon {
    width: 16px;
    height: 16px;
    color: var(--ice-blue);
  }

  /* Rink info bar */
  .rink-info-bar {
    display: flex;
    justify-content: center;
    gap: var(--space-lg);
    margin-bottom: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-md);
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .info-label {
    font-size: 0.7rem;
    color: var(--ice-blue);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-value {
    font-family: var(--font-score);
    font-size: 0.9rem;
    color: var(--ice-white);
  }

  .info-value.low {
    color: var(--score-red);
  }

  .info-value.medium {
    color: var(--score-gold);
  }

  .info-value.high {
    color: var(--score-green);
  }

  .info-value.affordable {
    color: var(--score-green);
  }

  /* Unified Rink Button */
  .unified-rink-button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .unified-rink-button:disabled {
    cursor: default;
  }

  .unified-rink {
    width: 100%;
    aspect-ratio: 2.2 / 1;
    max-width: 600px;
    margin: 0 auto;
    background: linear-gradient(
      180deg,
      #e8f4fc 0%,
      #d4e9f7 50%,
      #c0ddf2 100%
    );
    border-radius: 100px;
    border: 4px solid var(--team-primary, #dc2626);
    position: relative;
    overflow: hidden;
    transition: transform 0.1s, box-shadow 0.2s;
    box-shadow:
      inset 0 4px 20px rgba(0, 0, 0, 0.1),
      0 8px 30px rgba(0, 0, 0, 0.3);
  }

  .unified-rink-button:not(:disabled):hover .unified-rink {
    transform: scale(1.01);
    box-shadow:
      inset 0 4px 20px rgba(0, 0, 0, 0.1),
      0 10px 40px rgba(0, 0, 0, 0.3),
      0 0 60px var(--ice-glow);
  }

  .unified-rink-button:not(:disabled):active .unified-rink {
    transform: scale(0.99);
  }

  .unified-rink.match-mode {
    border-color: var(--score-gold);
    animation: match-pulse 1s ease-in-out infinite;
  }

  @keyframes match-pulse {
    0%, 100% { box-shadow: inset 0 4px 20px rgba(0, 0, 0, 0.1), 0 0 30px rgba(251, 191, 36, 0.3); }
    50% { box-shadow: inset 0 4px 20px rgba(0, 0, 0, 0.1), 0 0 50px rgba(251, 191, 36, 0.5); }
  }

  /* Goal nets */
  .goal-net {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 40px;
    background: linear-gradient(90deg, #fff 0%, #ddd 100%);
    border: 2px solid #999;
  }

  .goal-net.left {
    left: 2px;
    border-left: none;
    border-radius: 0 4px 4px 0;
  }

  .goal-net.right {
    right: 2px;
    border-right: none;
    border-radius: 4px 0 0 4px;
  }

  /* Pixel Art Players - NES 8-bit style */
  .pixel-player {
    position: absolute;
    width: 16px;
    height: 22px;
    image-rendering: pixelated;
    transform: translate(-50%, -50%);
    z-index: 10;
    /* CSS-generated pixel sprite */
    background:
      /* Head (skin) */
      linear-gradient(#f5d0c5, #f5d0c5) 4px 0 / 8px 5px,
      /* Jersey body */
      linear-gradient(var(--jersey-primary), var(--jersey-primary)) 2px 5px / 12px 8px,
      /* Jersey stripe */
      linear-gradient(var(--jersey-secondary), var(--jersey-secondary)) 2px 9px / 12px 2px,
      /* Pants */
      linear-gradient(#333, #333) 4px 13px / 8px 5px,
      /* Left leg */
      linear-gradient(#222, #222) 4px 18px / 3px 4px,
      /* Right leg */
      linear-gradient(#222, #222) 9px 18px / 3px 4px;
    background-repeat: no-repeat;
    animation: skate 0.6s steps(2) infinite;
  }

  .pixel-player.home {
    --jersey-primary: var(--team-primary, #dc2626);
    --jersey-secondary: var(--team-secondary, #fff);
  }

  .pixel-player.away {
    --jersey-primary: var(--opponent-primary, #1e40af);
    --jersey-secondary: var(--opponent-secondary, #fbbf24);
  }

  .pixel-player.goalie {
    width: 20px;
    height: 26px;
    /* Goalie with pads */
    background:
      /* Head */
      linear-gradient(#f5d0c5, #f5d0c5) 6px 0 / 8px 5px,
      /* Mask */
      linear-gradient(var(--jersey-secondary), var(--jersey-secondary)) 6px 0 / 8px 3px,
      /* Jersey */
      linear-gradient(var(--jersey-primary), var(--jersey-primary)) 2px 5px / 16px 10px,
      /* Stripe */
      linear-gradient(var(--jersey-secondary), var(--jersey-secondary)) 2px 9px / 16px 2px,
      /* Pads */
      linear-gradient(#f0f0f0, #f0f0f0) 2px 15px / 16px 11px,
      /* Pad stripes */
      linear-gradient(var(--jersey-primary), var(--jersey-primary)) 4px 17px / 2px 7px,
      linear-gradient(var(--jersey-primary), var(--jersey-primary)) 14px 17px / 2px 7px;
    background-repeat: no-repeat;
    animation: goalie-sway 1.5s ease-in-out infinite;
  }

  @keyframes skate {
    0%, 100% { transform: translate(-50%, -50%) translateY(0); }
    50% { transform: translate(-50%, -50%) translateY(-1px); }
  }

  .pixel-player.match-mode {
    animation: skate-fast 0.3s steps(2) infinite;
  }

  @keyframes skate-fast {
    0%, 100% { transform: translate(-50%, -50%) translateY(0); }
    50% { transform: translate(-50%, -50%) translateY(-2px); }
  }

  @keyframes goalie-sway {
    0%, 100% { transform: translate(-50%, -50%) translateX(0); }
    50% { transform: translate(-50%, -50%) translateX(3px); }
  }

  /* Referee - black/white striped */
  .pixel-referee {
    position: absolute;
    width: 14px;
    height: 20px;
    image-rendering: pixelated;
    transform: translate(-50%, -50%);
    z-index: 9;
    background:
      /* Head */
      linear-gradient(#f5d0c5, #f5d0c5) 3px 0 / 8px 4px,
      /* Striped jersey */
      repeating-linear-gradient(
        0deg,
        #000 0px, #000 2px,
        #fff 2px, #fff 4px
      ) 1px 4px / 12px 8px,
      /* Black pants */
      linear-gradient(#1a1a1a, #1a1a1a) 3px 12px / 8px 4px,
      /* Legs */
      linear-gradient(#333, #333) 3px 16px / 3px 4px,
      linear-gradient(#333, #333) 8px 16px / 3px 4px;
    background-repeat: no-repeat;
    animation: referee-move 2s ease-in-out infinite;
  }

  @keyframes referee-move {
    0%, 100% { transform: translate(-50%, -50%) translateX(-5px); }
    50% { transform: translate(-50%, -50%) translateX(5px); }
  }

  /* Coach */
  .pixel-coach {
    position: absolute;
    width: 16px;
    height: 24px;
    image-rendering: pixelated;
    transform: translate(-50%, -50%);
    z-index: 8;
    background:
      /* Head */
      linear-gradient(#f5d0c5, #f5d0c5) 4px 0 / 8px 5px,
      /* Cap */
      linear-gradient(var(--team-primary, #dc2626), var(--team-primary, #dc2626)) 2px 0 / 12px 3px,
      /* Jacket */
      linear-gradient(#2d3748, #2d3748) 2px 5px / 12px 10px,
      /* Team logo on jacket */
      linear-gradient(var(--team-primary, #dc2626), var(--team-primary, #dc2626)) 5px 8px / 6px 4px,
      /* Pants */
      linear-gradient(#1a1a1a, #1a1a1a) 4px 15px / 8px 5px,
      /* Legs */
      linear-gradient(#222, #222) 4px 20px / 3px 4px,
      linear-gradient(#222, #222) 9px 20px / 3px 4px;
    background-repeat: no-repeat;
    animation: coach-gesture 3s ease-in-out infinite;
  }

  @keyframes coach-gesture {
    0%, 40%, 100% { transform: translate(-50%, -50%) scale(1); }
    50%, 60% { transform: translate(-50%, -50%) scale(1.05); }
  }

  /* Pixel Puck */
  .pixel-puck {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 8px;
    height: 8px;
    background: radial-gradient(circle at 30% 30%, #444, #111);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 15;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    animation: puck-idle 2s ease-in-out infinite;
  }

  @keyframes puck-idle {
    0%, 100% { transform: translate(-50%, -50%); }
    25% { transform: translate(-60%, -60%); }
    50% { transform: translate(-40%, -50%); }
    75% { transform: translate(-50%, -40%); }
  }

  .pixel-puck.match-mode {
    animation: puck-match 0.8s ease-in-out infinite;
  }

  @keyframes puck-match {
    0% { left: 45%; top: 50%; }
    25% { left: 55%; top: 40%; }
    50% { left: 60%; top: 55%; }
    75% { left: 40%; top: 45%; }
    100% { left: 45%; top: 50%; }
  }

  /* Click indicator */
  .click-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .unified-rink-button:hover .click-indicator {
    opacity: 1;
  }

  .click-text {
    font-family: var(--font-score);
    font-size: 1.2rem;
    color: var(--score-gold);
    text-shadow: 0 0 15px var(--score-gold), 0 2px 4px rgba(0, 0, 0, 0.5);
    background: rgba(0, 0, 0, 0.4);
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-md);
  }

  /* Match animation overlay */
  .match-animation-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    z-index: 20;
  }

  .match-text {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--score-gold);
    text-shadow: 0 0 20px var(--score-gold);
    animation: pulse-text 0.5s ease-in-out infinite;
  }

  @keyframes pulse-text {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* Rink match result */
  .rink-match-result {
    margin-top: var(--space-md);
    padding: var(--space-md);
    background: var(--arena-elevated);
    border-radius: var(--radius-md);
    text-align: center;
    border: 2px solid var(--score-red);
  }

  .rink-match-result.won {
    border-color: var(--score-green);
    background: linear-gradient(135deg, rgba(22, 163, 74, 0.1), transparent);
  }

  .rink-match-result .result-header {
    margin-bottom: var(--space-sm);
  }

  .rink-match-result .result-label {
    font-family: var(--font-display);
    font-size: 1.2rem;
    color: var(--score-red);
    text-transform: uppercase;
  }

  .rink-match-result.won .result-label {
    color: var(--score-green);
  }

  .rink-match-result .result-score {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
  }

  .rink-match-result .score-home,
  .rink-match-result .score-away {
    font-family: var(--font-score);
    font-size: 2rem;
    color: var(--ice-white);
  }

  .rink-match-result .score-divider {
    font-size: 1.5rem;
    color: var(--ice-pale);
  }

  .rink-match-result .result-rewards {
    display: flex;
    justify-content: center;
    gap: var(--space-lg);
  }

  .rink-match-result .reward {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--score-gold);
    font-family: var(--font-score);
  }

  .rink-match-result .reward svg {
    width: 16px;
    height: 16px;
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

  /* Training Types Display */
  .training-types {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
    padding: var(--space-md);
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-md);
    flex-wrap: wrap;
  }

  .training-type {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-sm) var(--space-md);
    background: var(--arena-elevated);
    border-radius: var(--radius-md);
    min-width: 90px;
  }

  .training-type.conditioning {
    border-left: 3px solid var(--score-gold);
  }

  .training-type.skating {
    border-left: 3px solid var(--ice-blue);
  }

  .training-type.shooting {
    border-left: 3px solid var(--score-red);
  }

  .training-type-header {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .training-type-icon {
    width: 16px;
    height: 16px;
    opacity: 0.8;
  }

  .training-type.conditioning .training-type-icon {
    color: var(--score-gold);
  }

  .training-type.skating .training-type-icon {
    color: var(--ice-blue);
  }

  .training-type.shooting .training-type-icon {
    color: var(--score-red);
  }

  .training-type-label {
    font-size: 0.7rem;
    color: var(--ice-blue);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .training-type-value {
    font-size: 1.1rem;
    font-weight: bold;
    color: var(--ice-white);
  }

  .training-type-rate {
    font-size: 0.65rem;
    color: var(--ice-blue);
    opacity: 0.7;
  }

  .cascade-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    opacity: 0.6;
  }

  .cascade-arrow svg {
    width: 20px;
    height: 20px;
    color: var(--ice-blue);
    animation: pulse-arrow 2s ease-in-out infinite;
  }

  @keyframes pulse-arrow {
    0%, 100% { opacity: 0.4; transform: translateX(0); }
    50% { opacity: 1; transform: translateX(3px); }
  }

  .cascade-rate {
    font-size: 0.6rem;
    color: var(--ice-blue);
  }

  /* Tactic Selector */
  .tactic-selector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
    padding: var(--space-md);
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-md);
  }

  .tactic-label {
    font-size: 0.75rem;
    color: var(--ice-blue);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }

  .tactic-buttons {
    display: flex;
    gap: var(--space-sm);
  }

  .tactic-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--space-sm) var(--space-md);
    background: var(--arena-elevated);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;
    min-width: 70px;
  }

  .tactic-btn:hover {
    background: var(--arena-card);
    transform: translateY(-2px);
  }

  .tactic-btn.active {
    border-color: var(--ice-blue);
    background: var(--arena-card);
    box-shadow: 0 0 15px rgba(100, 200, 255, 0.3);
  }

  .tactic-btn.active.offensive {
    border-color: var(--score-red);
    box-shadow: 0 0 15px rgba(220, 53, 69, 0.3);
  }

  .tactic-btn.active.defensive {
    border-color: var(--score-gold);
    box-shadow: 0 0 15px rgba(255, 193, 7, 0.3);
  }

  .tactic-icon {
    width: 20px;
    height: 20px;
    color: var(--ice-white);
  }

  .tactic-btn.offensive .tactic-icon {
    color: var(--score-red);
  }

  .tactic-btn.defensive .tactic-icon {
    color: var(--score-gold);
  }

  .tactic-name {
    font-size: 0.65rem;
    color: var(--ice-white);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tactic-desc {
    font-size: 0.7rem;
    color: var(--ice-blue);
    opacity: 0.8;
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
  .win-chance-display {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--arena-elevated);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-sm);
  }

  .win-chance-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .win-chance-bar {
    flex: 1;
    height: 8px;
    background: var(--arena-surface);
    border-radius: 4px;
    overflow: hidden;
  }

  .win-chance-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease, background 0.3s ease;
  }

  .win-chance-fill.low {
    background: linear-gradient(90deg, var(--danger-red) 0%, #e74c3c 100%);
  }

  .win-chance-fill.medium {
    background: linear-gradient(90deg, #f39c12 0%, #f1c40f 100%);
  }

  .win-chance-fill.high {
    background: linear-gradient(90deg, var(--score-green) 0%, #1fa268 100%);
  }

  .win-chance-value {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
    min-width: 40px;
    text-align: right;
  }

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

  .match-btn.locked {
    background: linear-gradient(
      135deg,
      var(--arena-elevated) 0%,
      var(--arena-dark) 100%
    );
    border: 2px solid var(--arena-elevated);
  }

  .match-locked {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    height: 100%;
    padding: var(--space-md);
  }

  .lock-icon {
    width: 32px;
    height: 32px;
    color: var(--score-red);
    opacity: 0.7;
  }

  .lock-text {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--ice-pale);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .lock-requirement {
    font-size: 0.75rem;
    color: var(--ice-blue);
    text-align: center;
  }

  .match-cost {
    font-size: 0.75rem;
    color: var(--score-red);
    font-family: var(--font-body);
    letter-spacing: 0;
    opacity: 0.8;
  }

  .match-cost.affordable {
    color: var(--score-green);
  }

  .match-btn.cant-afford {
    opacity: 0.6;
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

  .upgrade-cost.skating-cost .cost-value {
    color: var(--ice-blue);
  }

  .upgrade-cost.shooting-cost .cost-value {
    color: var(--score-red);
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

  /* Full Width Panel */
  .full-width {
    max-width: 100%;
  }

  /* Achievements Tab */
  .achievements-tab {
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

  .achievements-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-lg);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--arena-elevated);
  }

  .achievements-header h2 {
    font-size: 1.5rem;
    color: var(--ice-white);
    margin: 0;
  }

  .achievements-count {
    font-family: var(--font-score);
    font-size: 0.9rem;
    color: var(--score-gold);
    background: var(--arena-dark);
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-md);
  }

  .achievement-section {
    margin-bottom: var(--space-xl);
  }

  .achievement-section:last-child {
    margin-bottom: 0;
  }

  .achievement-section-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 1.1rem;
    color: var(--ice-white);
    margin: 0 0 var(--space-xs) 0;
  }

  .achievement-section-title svg {
    width: 20px;
    height: 20px;
    color: var(--score-gold);
  }

  .achievement-section-hint {
    font-size: 0.75rem;
    color: var(--ice-pale);
    opacity: 0.7;
    margin: 0 0 var(--space-md) 0;
  }

  .achievements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-md);
  }

  .achievement-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--arena-dark);
    border: 2px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    transition: all 0.2s ease;
  }

  .achievement-card.unlocked {
    border-color: var(--score-gold);
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.15);
  }

  .achievement-card.hidden {
    opacity: 0.5;
  }

  .achievement-card.cosmetic.unlocked {
    border-color: var(--ice-blue);
    box-shadow: 0 0 20px var(--ice-glow);
  }

  .achievement-icon {
    width: 48px;
    height: 48px;
    background: var(--arena-surface);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .achievement-icon svg {
    width: 28px;
    height: 28px;
    color: var(--ice-pale);
  }

  .achievement-icon.unlocked {
    background: linear-gradient(135deg, var(--score-gold) 0%, #d97706 100%);
  }

  .achievement-icon.unlocked svg {
    color: var(--arena-deep);
  }

  .achievement-icon.hidden svg {
    opacity: 0.4;
  }

  .achievement-badge {
    width: 48px;
    height: 48px;
    background: var(--arena-surface);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 1.5rem;
  }

  .achievement-info {
    flex: 1;
    min-width: 0;
  }

  .achievement-name {
    display: block;
    font-family: var(--font-display);
    font-size: 1rem;
    color: var(--ice-white);
    letter-spacing: 0.03em;
    margin-bottom: 2px;
  }

  .achievement-desc {
    display: block;
    font-size: 0.75rem;
    color: var(--ice-pale);
    opacity: 0.8;
    margin-bottom: 4px;
  }

  .achievement-reward {
    display: block;
    font-family: var(--font-score);
    font-size: 0.7rem;
    color: var(--score-green);
  }

  .achievement-card:not(.unlocked) .achievement-reward {
    color: var(--ice-pale);
    opacity: 0.6;
  }

  .achievement-check {
    width: 28px;
    height: 28px;
    background: var(--score-green);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 10px var(--score-green-glow);
  }

  .achievement-check svg {
    width: 16px;
    height: 16px;
    color: white;
  }

  /* Active Tab Badge */
  .tab-badge.active-badge {
    background: var(--score-red);
    animation: pulse-badge 1.5s ease infinite;
  }

  @keyframes pulse-badge {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(230, 57, 70, 0.4);
    }
    50% {
      box-shadow: 0 0 0 6px rgba(230, 57, 70, 0);
    }
  }

  /* Challenges Tab */
  .challenges-tab {
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

  .challenges-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-lg);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--arena-elevated);
  }

  .challenges-header h2 {
    font-size: 1.5rem;
    color: var(--ice-white);
    margin: 0;
  }

  .challenges-count {
    font-family: var(--font-score);
    font-size: 0.9rem;
    color: var(--score-gold);
    background: var(--arena-dark);
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-md);
  }

  .challenge-section {
    margin-bottom: var(--space-xl);
  }

  .challenge-section:last-child {
    margin-bottom: 0;
  }

  .challenge-section.active-section {
    background: linear-gradient(
      135deg,
      rgba(230, 57, 70, 0.1) 0%,
      transparent 100%
    );
    border: 2px solid var(--score-red);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-xl);
  }

  .challenge-section-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 1.1rem;
    color: var(--ice-white);
    margin: 0 0 var(--space-xs) 0;
  }

  .challenge-section-title svg {
    width: 20px;
    height: 20px;
    color: var(--ice-blue);
  }

  .challenge-section-title.completed-title svg {
    color: var(--score-green);
  }

  .challenge-section-title.locked-title svg {
    color: var(--ice-pale);
    opacity: 0.5;
  }

  .active-section .challenge-section-title svg {
    color: var(--score-red);
  }

  .challenge-section-hint {
    font-size: 0.75rem;
    color: var(--ice-pale);
    opacity: 0.7;
    margin: 0 0 var(--space-md) 0;
  }

  .challenges-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-md);
  }

  .challenge-card {
    display: flex;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--arena-dark);
    border: 2px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    transition: all 0.2s ease;
  }

  .challenge-card.active {
    border-color: var(--score-red);
    box-shadow: 0 0 30px rgba(230, 57, 70, 0.2);
    background: linear-gradient(
      135deg,
      var(--arena-dark) 0%,
      rgba(230, 57, 70, 0.05) 100%
    );
  }

  .challenge-card.available {
    border-color: var(--ice-blue);
  }

  .challenge-card.available:hover {
    border-color: var(--score-gold);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(251, 191, 36, 0.15);
  }

  .challenge-card.completed {
    border-color: var(--score-green);
    opacity: 0.8;
  }

  .challenge-card.maxed {
    border-color: var(--gold);
    background: linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, var(--arena-dark) 100%);
  }

  .challenge-card.has-progress {
    border-color: var(--ice-blue);
  }

  .challenge-card.locked {
    opacity: 0.5;
  }

  .challenge-stars {
    font-size: 1rem;
    letter-spacing: 2px;
    color: var(--gold);
    text-shadow: 0 0 4px rgba(234, 179, 8, 0.3);
  }

  .challenge-stars.maxed {
    color: var(--gold);
    text-shadow: 0 0 8px rgba(234, 179, 8, 0.6);
  }

  .challenge-total-reward {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--gold);
    font-weight: 600;
    margin-top: 0.5rem;
  }

  .challenge-total-reward svg {
    width: 16px;
    height: 16px;
    color: var(--gold);
  }

  .challenge-current-bonus {
    font-size: 0.75rem;
    color: var(--ice-blue);
    opacity: 0.8;
    margin-top: 0.25rem;
  }

  .challenge-icon {
    width: 48px;
    height: 48px;
    background: var(--arena-surface);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .challenge-icon svg {
    width: 28px;
    height: 28px;
    color: var(--ice-blue);
  }

  .challenge-icon.active {
    background: linear-gradient(135deg, var(--score-red) 0%, #b91c1c 100%);
  }

  .challenge-icon.active svg {
    color: white;
  }

  .challenge-icon.completed {
    background: linear-gradient(135deg, var(--score-green) 0%, #15803d 100%);
  }

  .challenge-icon.completed svg {
    color: white;
  }

  .challenge-icon.locked svg {
    color: var(--ice-pale);
    opacity: 0.4;
  }

  .challenge-content {
    flex: 1;
    min-width: 0;
  }

  .challenge-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .challenge-name {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--ice-white);
    letter-spacing: 0.03em;
  }

  .challenge-progress-text {
    font-family: var(--font-score);
    font-size: 0.9rem;
    color: var(--score-gold);
  }

  .challenge-desc {
    font-size: 0.8rem;
    color: var(--ice-pale);
    margin: 0 0 var(--space-sm) 0;
    line-height: 1.4;
  }

  .challenge-restriction {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 0.75rem;
    color: var(--score-red);
    margin: 0 0 var(--space-sm) 0;
    padding: var(--space-xs) var(--space-sm);
    background: rgba(230, 57, 70, 0.1);
    border-radius: var(--radius-sm);
  }

  .challenge-restriction svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .challenge-goal {
    font-size: 0.8rem;
    color: var(--ice-blue);
    margin: 0 0 var(--space-sm) 0;
  }

  .challenge-progress-bar {
    height: 8px;
    background: var(--arena-surface);
    border-radius: var(--radius-sm);
    overflow: hidden;
    margin-bottom: var(--space-md);
  }

  .challenge-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--score-red) 0%, var(--score-gold) 100%);
    transition: width 0.3s ease;
    box-shadow: 0 0 10px var(--score-red);
  }

  .challenge-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .challenge-reward {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-score);
    font-size: 0.75rem;
    color: var(--ice-pale);
  }

  .challenge-reward svg {
    width: 14px;
    height: 14px;
    color: var(--score-gold);
  }

  .challenge-reward.active {
    color: var(--score-green);
  }

  .challenge-reward.active svg {
    color: var(--score-green);
  }

  .start-btn {
    padding: var(--space-xs) var(--space-md);
    background: linear-gradient(135deg, var(--score-green) 0%, #15803d 100%);
    border: none;
    border-radius: var(--radius-sm);
    color: white;
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .start-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px var(--score-green-glow);
  }

  .start-btn:disabled {
    background: var(--arena-elevated);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .abandon-btn {
    padding: var(--space-xs) var(--space-md);
    background: transparent;
    border: 1px solid var(--score-red);
    border-radius: var(--radius-sm);
    color: var(--score-red);
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .abandon-btn:hover {
    background: rgba(230, 57, 70, 0.1);
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

    .tab-nav-content {
      justify-content: center;
      padding: var(--space-sm);
    }

    .tab-btn {
      padding: var(--space-sm);
    }

    .tab-label {
      display: none;
    }

    .tab-icon {
      width: 22px;
      height: 22px;
    }

    .morale-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .morale-stats {
      width: 100%;
      justify-content: space-around;
    }

    .game-grid {
      grid-template-columns: 1fr;
    }

    .upgrades-panel {
      grid-column: auto;
    }

    .achievements-header {
      flex-direction: column;
      gap: var(--space-sm);
      text-align: center;
    }

    .achievements-grid {
      grid-template-columns: 1fr;
    }

    .achievement-card {
      padding: var(--space-sm);
    }

    .challenges-header {
      flex-direction: column;
      gap: var(--space-sm);
      text-align: center;
    }

    .challenges-grid {
      grid-template-columns: 1fr;
    }

    .challenge-card {
      flex-direction: column;
    }

    .challenge-icon {
      align-self: flex-start;
    }

    .challenge-footer {
      flex-direction: column;
      align-items: flex-start;
    }

    .start-btn,
    .abandon-btn {
      width: 100%;
    }
  }

  /* Season Info in Header */
  .season-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 140px;
  }

  .season-label {
    font-family: var(--font-display);
    font-size: 1rem;
    color: var(--score-gold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .season-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .season-progress-bar {
    flex: 1;
    height: 6px;
    background: var(--arena-dark);
    border-radius: 3px;
    overflow: hidden;
  }

  .season-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--ice-blue) 0%, var(--score-gold) 100%);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .season-progress-text {
    font-family: var(--font-score);
    font-size: 0.75rem;
    color: var(--ice-pale);
    white-space: nowrap;
  }

  .end-season-btn {
    margin-top: 4px;
    padding: 6px 12px;
    background: linear-gradient(135deg, var(--score-gold) 0%, #d97706 100%);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--arena-dark);
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .end-season-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 10px rgba(251, 191, 36, 0.3); }
    50% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.6); }
  }

  .reputation-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 var(--space-md);
    border-left: 1px solid var(--arena-surface);
  }

  .rep-label {
    font-size: 0.7rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .rep-value {
    font-family: var(--font-score);
    font-size: 1.2rem;
    color: var(--score-gold);
    font-weight: bold;
  }

  /* End Season Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-md);
  }

  .modal-content {
    background: var(--arena-dark);
    border: 2px solid var(--score-gold);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    max-width: 480px;
    width: 100%;
    box-shadow: 0 0 60px rgba(251, 191, 36, 0.3);
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 2rem;
    color: var(--score-gold);
    text-align: center;
    margin-bottom: var(--space-xs);
  }

  .modal-subtitle {
    font-size: 0.9rem;
    color: var(--ice-pale);
    text-align: center;
    margin-bottom: var(--space-lg);
  }

  .season-summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
  }

  .summary-stat {
    background: var(--arena-surface);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .summary-stat.highlight {
    grid-column: 1 / -1;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%);
    border: 1px solid var(--score-gold);
  }

  .summary-label {
    display: block;
    font-size: 0.7rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }

  .summary-value {
    font-family: var(--font-score);
    font-size: 1.5rem;
    color: var(--ice-white);
    font-weight: bold;
  }

  .summary-stat.highlight .summary-value {
    color: var(--score-gold);
  }

  .modal-warning {
    background: rgba(230, 57, 70, 0.1);
    border: 1px solid var(--score-red);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-bottom: var(--space-lg);
    font-size: 0.85rem;
    color: var(--ice-pale);
  }

  .modal-warning p {
    margin-bottom: var(--space-sm);
  }

  .modal-warning ul {
    margin: 0;
    padding-left: var(--space-lg);
    margin-bottom: var(--space-sm);
  }

  .modal-warning li {
    color: var(--score-red);
  }

  .modal-keep {
    color: var(--score-green);
    font-weight: bold;
  }

  .modal-actions {
    display: flex;
    gap: var(--space-md);
  }

  .modal-btn {
    flex: 1;
    padding: var(--space-md) var(--space-lg);
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--font-display);
    font-size: 0.9rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-btn.cancel {
    background: var(--arena-surface);
    color: var(--ice-pale);
    border: 1px solid var(--arena-elevated);
  }

  .modal-btn.cancel:hover {
    background: var(--arena-elevated);
  }

  .modal-btn.confirm {
    background: linear-gradient(135deg, var(--score-gold) 0%, #d97706 100%);
    color: var(--arena-dark);
  }

  .modal-btn.confirm:hover {
    transform: scale(1.02);
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
  }

  /* Club Tab */
  .club-content {
    padding: var(--space-lg);
  }

  .club-stats-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .club-stat {
    background: var(--arena-surface);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    text-align: center;
    border: 1px solid var(--arena-elevated);
  }

  .club-stat.highlight {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%);
    border-color: var(--score-gold);
  }

  .club-stat-label {
    display: block;
    font-size: 0.7rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }

  .club-stat-value {
    font-family: var(--font-score);
    font-size: 1.3rem;
    color: var(--ice-white);
    font-weight: bold;
  }

  .club-stat.highlight .club-stat-value {
    color: var(--score-gold);
  }

  .rep-upgrades-section {
    background: var(--arena-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
  }

  .section-subtitle {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-family: var(--font-display);
    font-size: 1.3rem;
    color: var(--score-gold);
    margin-bottom: var(--space-xs);
  }

  .section-subtitle svg {
    width: 24px;
    height: 24px;
  }

  .section-hint {
    font-size: 0.8rem;
    color: var(--ice-pale);
    margin-bottom: var(--space-lg);
  }

  .rep-upgrades-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-md);
  }

  .rep-upgrade-card {
    background: var(--arena-dark);
    border: 2px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    transition: all 0.2s ease;
  }

  .rep-upgrade-card.can-afford {
    border-color: var(--score-gold);
    box-shadow: 0 0 15px rgba(251, 191, 36, 0.2);
  }

  .rep-upgrade-card.purchased {
    border-color: var(--score-green);
    opacity: 0.8;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, transparent 100%);
  }

  .rep-upgrade-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .rep-upgrade-name {
    font-family: var(--font-display);
    font-size: 1rem;
    color: var(--ice-white);
    letter-spacing: 0.03em;
  }

  .rep-upgrade-cost {
    font-family: var(--font-score);
    font-size: 0.85rem;
    color: var(--ice-pale);
    padding: 2px 8px;
    background: var(--arena-surface);
    border-radius: var(--radius-sm);
  }

  .rep-upgrade-cost.affordable {
    color: var(--score-gold);
    background: rgba(251, 191, 36, 0.15);
  }

  .rep-upgrade-card.purchased .rep-upgrade-cost {
    color: var(--score-green);
    background: rgba(34, 197, 94, 0.15);
  }

  .rep-upgrade-desc {
    font-size: 0.8rem;
    color: var(--ice-pale);
    margin-bottom: var(--space-sm);
  }

  .rep-upgrade-btn {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: linear-gradient(135deg, var(--score-gold) 0%, #d97706 100%);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--arena-dark);
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .rep-upgrade-btn:disabled {
    background: var(--arena-elevated);
    color: var(--ice-pale);
    cursor: not-allowed;
    opacity: 0.5;
  }

  .rep-upgrade-btn:not(:disabled):hover {
    transform: scale(1.02);
    box-shadow: 0 0 15px rgba(251, 191, 36, 0.4);
  }

  @media (max-width: 768px) {
    .season-info {
      min-width: 100%;
    }

    .header-scoreboard {
      flex-wrap: wrap;
    }

    .reputation-display {
      border-left: none;
      border-top: 1px solid var(--arena-surface);
      padding-top: var(--space-sm);
    }

    .modal-content {
      padding: var(--space-lg);
    }

    .modal-title {
      font-size: 1.5rem;
    }

    .modal-actions {
      flex-direction: column;
    }

    .rep-upgrades-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
