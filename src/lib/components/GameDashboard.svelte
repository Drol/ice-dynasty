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

  // Training boost: when clicking, players rush across the ice
  let trainingBoost = $state(false);
  let boostTimeout: ReturnType<typeof setTimeout> | null = null;

  // Animation tick for skating frames (toggles every 250ms, faster when boosted)
  let skateTick = $state(0);
  $effect(() => {
    const interval = setInterval(() => {
      skateTick = (skateTick + 1) % 2;
    }, trainingBoost ? 100 : 250);
    return () => clearInterval(interval);
  });

  // Match clock countdown (5 seconds)
  let matchTimeRemaining = $state(0);
  let matchClockInterval: ReturnType<typeof setInterval> | null = null;

  // Match cost (training minutes)
  const currentMatchCost = $derived($matchCostStore);
  const canAffordMatch = $derived($canAffordMatchStore);

  function handleTrainClick(e: MouseEvent) {
    gameState.clickTrain();

    // Trigger training boost animation (players rush across ice)
    trainingBoost = true;
    if (boostTimeout) clearTimeout(boostTimeout);
    boostTimeout = setTimeout(() => {
      trainingBoost = false;
    }, 1200);

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
  // Players have multiple keyframe positions to create skating effect
  interface RinkPlayer {
    id: number;
    team: 'home' | 'away';
    isGoalie?: boolean;
    // Animation path: array of [x, y] positions (% of rink)
    path: [number, number][];
    animationDuration: number; // seconds
    animationDelay: number;
  }

  // Training: Practice scrimmage - same team split into primary/secondary color squads
  // 'home' = primary color squad, 'away' = secondary color squad (swapped jersey colors)
  const trainingPlayers: RinkPlayer[] = [
    // Primary squad goalie (left side)
    { id: 1, team: 'home', isGoalie: true, path: [[12, 40], [12, 55], [14, 50], [12, 45], [12, 55]], animationDuration: 3.5, animationDelay: 0 },
    // Secondary squad goalie (right side)
    { id: 2, team: 'away', isGoalie: true, path: [[88, 55], [88, 40], [86, 50], [88, 55], [88, 45]], animationDuration: 3.5, animationDelay: 0.2 },
    // Primary squad forwards
    { id: 3, team: 'home', path: [[25, 25], [50, 30], [75, 35], [60, 50], [35, 45], [25, 25]], animationDuration: 6, animationDelay: 0 },
    { id: 4, team: 'home', path: [[25, 75], [50, 70], [75, 65], [60, 50], [35, 55], [25, 75]], animationDuration: 6.2, animationDelay: 0.3 },
    { id: 5, team: 'home', path: [[35, 50], [55, 40], [70, 50], [55, 60], [35, 50]], animationDuration: 5.5, animationDelay: 0.2 },
    // Primary squad defense
    { id: 6, team: 'home', path: [[20, 30], [28, 45], [20, 55], [15, 40], [20, 30]], animationDuration: 5, animationDelay: 0.4 },
    { id: 7, team: 'home', path: [[20, 70], [28, 55], [20, 45], [15, 60], [20, 70]], animationDuration: 5.2, animationDelay: 0.5 },
    // Secondary squad forwards
    { id: 8, team: 'away', path: [[75, 25], [50, 30], [25, 35], [40, 50], [65, 45], [75, 25]], animationDuration: 6, animationDelay: 0.2 },
    { id: 9, team: 'away', path: [[75, 75], [50, 70], [25, 65], [40, 50], [65, 55], [75, 75]], animationDuration: 6.2, animationDelay: 0.4 },
    { id: 10, team: 'away', path: [[65, 50], [45, 40], [30, 50], [45, 60], [65, 50]], animationDuration: 5.5, animationDelay: 0.3 },
    // Secondary squad defense
    { id: 11, team: 'away', path: [[80, 30], [72, 45], [80, 55], [85, 40], [80, 30]], animationDuration: 5, animationDelay: 0.5 },
    { id: 12, team: 'away', path: [[80, 70], [72, 55], [80, 45], [85, 60], [80, 70]], animationDuration: 5.2, animationDelay: 0.6 },
  ];

  // Match: 5v5 + goalies skating with wider movements
  const matchPlayers: RinkPlayer[] = [
    // Home team goalie - moves side to side in crease
    { id: 1, team: 'home', isGoalie: true, path: [[15, 40], [15, 60], [17, 50], [15, 45], [15, 55]], animationDuration: 3, animationDelay: 0 },
    // Home forwards - wide skating patterns
    { id: 2, team: 'home', path: [[30, 25], [50, 30], [65, 35], [55, 50], [40, 40], [30, 25]], animationDuration: 4, animationDelay: 0.1 },
    { id: 3, team: 'home', path: [[30, 75], [50, 70], [65, 65], [55, 50], [40, 60], [30, 75]], animationDuration: 4.2, animationDelay: 0.3 },
    { id: 4, team: 'home', path: [[40, 50], [55, 40], [70, 50], [55, 60], [40, 50]], animationDuration: 3.5, animationDelay: 0.2 },
    // Home defense - patrol blue line area
    { id: 5, team: 'home', path: [[22, 30], [28, 45], [22, 55], [18, 40], [22, 30]], animationDuration: 4.5, animationDelay: 0.4 },
    { id: 6, team: 'home', path: [[22, 70], [28, 55], [22, 45], [18, 60], [22, 70]], animationDuration: 4.8, animationDelay: 0.5 },
    // Away team goalie
    { id: 7, team: 'away', isGoalie: true, path: [[85, 60], [85, 40], [83, 50], [85, 55], [85, 45]], animationDuration: 3, animationDelay: 0.1 },
    // Away forwards - wide skating patterns
    { id: 8, team: 'away', path: [[70, 25], [50, 30], [35, 35], [45, 50], [60, 40], [70, 25]], animationDuration: 4, animationDelay: 0.2 },
    { id: 9, team: 'away', path: [[70, 75], [50, 70], [35, 65], [45, 50], [60, 60], [70, 75]], animationDuration: 4.2, animationDelay: 0.4 },
    { id: 10, team: 'away', path: [[60, 50], [45, 40], [30, 50], [45, 60], [60, 50]], animationDuration: 3.5, animationDelay: 0.3 },
    // Away defense - patrol blue line area
    { id: 11, team: 'away', path: [[78, 30], [72, 45], [78, 55], [82, 40], [78, 30]], animationDuration: 4.5, animationDelay: 0.5 },
    { id: 12, team: 'away', path: [[78, 70], [72, 55], [78, 45], [82, 60], [78, 70]], animationDuration: 4.8, animationDelay: 0.6 },
  ];

  const rinkPlayers = $derived(rinkMode === 'match' ? matchPlayers : trainingPlayers);

  // Puck center position (animation handles the passing movement)
  const puckPath = $derived(rinkMode === 'match' ? [[50, 50]] : [[45, 50]]);

  // Training click handler for Train button
  function handleTrainButtonClick() {
    if (rinkMode === 'training' && !isPlayingMatch) {
      gameState.clickTrain();

      // Trigger training boost animation
      trainingBoost = true;
      if (boostTimeout) clearTimeout(boostTimeout);
      boostTimeout = setTimeout(() => {
        trainingBoost = false;
      }, 1200);
    }
  }

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
    lastMatchResult = null; // Clear previous result

    // Start match clock countdown (5 seconds)
    matchTimeRemaining = 5.0;
    if (matchClockInterval) clearInterval(matchClockInterval);
    matchClockInterval = setInterval(() => {
      matchTimeRemaining = Math.max(0, matchTimeRemaining - 0.1);
    }, 100);

    // Play match after animation delay (5 seconds of gameplay)
    matchAnimationTimer = setTimeout(() => {
      // Stop match clock
      if (matchClockInterval) {
        clearInterval(matchClockInterval);
        matchClockInterval = null;
      }
      matchTimeRemaining = 0;

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

      // Return to training mode after showing result (2.5s to read result)
      setTimeout(() => {
        rinkMode = 'training';
        isPlayingMatch = false;
      }, 2500);
    }, 5000); // 5 seconds of match animation
  }

  // Cleanup timers on component destroy
  $effect(() => {
    return () => {
      if (matchAnimationTimer) {
        clearTimeout(matchAnimationTimer);
      }
      if (matchClockInterval) {
        clearInterval(matchClockInterval);
      }
      if (boostTimeout) {
        clearTimeout(boostTimeout);
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
      <!-- Lagmoral (Global Multiplier) - Compact single row -->
      <section class="morale-panel-compact">
        <svg class="morale-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        <span class="morale-label">Morale</span>
        <span class="morale-stat">{game.morale.level}/{game.morale.maxLevel}</span>
        <span class="morale-mult">{moraleMult.toFixed(2)}x</span>
        <div class="morale-progress-compact">
          <div class="morale-progress-fill" style="width: {moraleProgress}%"></div>
        </div>
        <button
          class="morale-boost-btn-compact"
          class:affordable={canAffordMorale}
          class:maxed={moraleMaxed}
          onclick={handleBoostMorale}
          disabled={!canAffordMorale || moraleMaxed}
        >
          {#if moraleMaxed}
            <span>MAX</span>
          {:else}
            <span>Boost {formatMoney(moraleCost)}</span>
          {/if}
        </button>
      </section>
      <!-- Unified Rink Panel -->
      <section class="panel unified-rink-panel">
        <!-- Action Buttons - Training and Match groups -->
        <div class="rink-actions">
          <!-- Training Group -->
          <div class="action-group training-group">
            <span class="action-group-label">Practice</span>
            <button
              class="action-btn training-btn"
              class:active={rinkMode === 'training' && !isPlayingMatch}
              onclick={handleTrainButtonClick}
              disabled={isPlayingMatch}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="action-icon">
                <path d="M12 2L8 6H4v4l-2 2 2 2v4h4l4 4 4-4h4v-4l2-2-2-2V6h-4l-4-4z"/>
              </svg>
              <span class="action-label">Train</span>
              <span class="action-value">+{formatNumber(clickPwr)}/click</span>
            </button>
          </div>

          <!-- Separator -->
          <div class="action-separator"></div>

          <!-- Match Group -->
          <div class="action-group match-group">
            <span class="action-group-label">Play Match</span>
            {#if matchUnlocked}
              <div class="match-tactics">
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
              </div>
            {:else}
              <div class="match-locked-info">
                <svg class="lock-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/>
                </svg>
                <span>Train {formatNumber(MATCH_UNLOCK_THRESHOLD - minutes)} more min to unlock matches</span>
              </div>
            {/if}
          </div>
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

        <!-- Unified Rink with NES-style scoreboard -->
        <div
          class="rink-container"
          style="--team-primary: {game.club?.colors?.primary || '#dc2626'}; --team-secondary: {game.club?.colors?.secondary || '#ffffff'}; --opponent-primary: {opponentColors.primary}; --opponent-secondary: {opponentColors.secondary};"
        >
          <!-- NES-style Scoreboard above rink -->
          <div class="nes-scoreboard" class:training-mode={rinkMode === 'training'}>
            {#if rinkMode === 'match'}
              <!-- Match mode: show teams and score -->
              <div class="scoreboard-team home">
                <svg class="scoreboard-jersey" viewBox="0 0 24 24" style="--primary: var(--team-primary); --secondary: var(--team-secondary);">
                  <path class="jersey-body" d="M6 4L4 6v14h16V6l-2-2h-3v2a3 3 0 01-6 0V4H6z" fill="var(--primary)"/>
                  <path class="jersey-collar" d="M9 4v2a3 3 0 006 0V4" fill="none" stroke="var(--secondary)" stroke-width="1.5"/>
                  <path class="jersey-sleeves" d="M4 6L2 8v4l2-1V6zM20 6l2 2v4l-2-1V6z" fill="var(--secondary)"/>
                </svg>
                <span class="team-name">{game.club?.name || 'HOME'}</span>
              </div>
              <!-- Match clock countdown (between team and score) -->
              {#if isPlayingMatch && !lastMatchResult}
                <div class="match-clock">
                  <span class="clock-time">{matchTimeRemaining.toFixed(1)}</span>
                </div>
              {/if}
              <div class="scoreboard-score">
                {#if lastMatchResult}
                  <span class="score home">{lastMatchResult.goalsFor}</span>
                  <span class="score-separator">-</span>
                  <span class="score away">{lastMatchResult.goalsAgainst}</span>
                {:else}
                  <span class="score home">0</span>
                  <span class="score-separator">-</span>
                  <span class="score away">0</span>
                {/if}
              </div>
              <div class="scoreboard-team away">
                <span class="team-name">Opponent</span>
                <svg class="scoreboard-jersey" viewBox="0 0 24 24" style="--primary: var(--opponent-primary); --secondary: var(--opponent-secondary);">
                  <path class="jersey-body" d="M6 4L4 6v14h16V6l-2-2h-3v2a3 3 0 01-6 0V4H6z" fill="var(--primary)"/>
                  <path class="jersey-collar" d="M9 4v2a3 3 0 006 0V4" fill="none" stroke="var(--secondary)" stroke-width="1.5"/>
                  <path class="jersey-sleeves" d="M4 6L2 8v4l2-1V6zM20 6l2 2v4l-2-1V6z" fill="var(--secondary)"/>
                </svg>
              </div>
              {#if lastMatchResult}
                <div class="scoreboard-result" class:won={lastMatchResult.won}>
                  {lastMatchResult.won ? 'WIN!' : 'LOSS'}
                  <span class="result-rewards">+{lastMatchResult.fansGained} fans, +{formatMoney(lastMatchResult.moneyEarned)}</span>
                </div>
              {/if}
            {:else}
              <!-- Training mode: show training rate -->
              <div class="training-scoreboard">
                <svg class="training-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
                </svg>
                <span class="training-label">Training</span>
                <span class="training-rate">+{formatNumber(rate)}/s</span>
              </div>
            {/if}
          </div>

          <div
            class="unified-rink-container"
            class:match-mode={rinkMode === 'match'}
            class:training-boost={trainingBoost}
          >
            <div class="unified-rink">
              <!-- SVG Hockey Rink - NHL dimensions (200ft x 85ft) -->
              <svg class="rink-svg" viewBox="0 0 200 85" preserveAspectRatio="xMidYMid meet">
                <!-- Ice surface with rounded corners (smaller radius for better look) -->
                <rect x="0" y="0" width="200" height="85" rx="12" ry="12" fill="#e8f4fc" />

                <!-- Boards (red outline) -->
                <rect x="0.5" y="0.5" width="199" height="84" rx="12" ry="12" fill="none" stroke="#c41e3a" stroke-width="1" />

                <!-- Goal lines (red, at 11ft from each end - extend to boards) -->
                <line x1="11" y1="0" x2="11" y2="85" stroke="#c41e3a" stroke-width="0.5" />
                <line x1="189" y1="0" x2="189" y2="85" stroke="#c41e3a" stroke-width="0.5" />

                <!-- Blue lines (25ft from center = x=75 and x=125) -->
                <line x1="75" y1="0" x2="75" y2="85" stroke="#2563eb" stroke-width="1" />
                <line x1="125" y1="0" x2="125" y2="85" stroke="#2563eb" stroke-width="1" />

                <!-- Center red line -->
                <line x1="100" y1="0" x2="100" y2="85" stroke="#c41e3a" stroke-width="1" />

                <!-- Center ice faceoff circle (15ft radius) -->
                <circle cx="100" cy="42.5" r="15" fill="none" stroke="#2563eb" stroke-width="0.5" />
                <circle cx="100" cy="42.5" r="1" fill="#2563eb" />

                <!-- Left zone faceoff circles (20ft from goal line, 22ft from side) -->
                <circle cx="31" cy="20.5" r="15" fill="none" stroke="#c41e3a" stroke-width="0.5" />
                <circle cx="31" cy="20.5" r="1" fill="#c41e3a" />
                <circle cx="31" cy="64.5" r="15" fill="none" stroke="#c41e3a" stroke-width="0.5" />
                <circle cx="31" cy="64.5" r="1" fill="#c41e3a" />

                <!-- Right zone faceoff circles -->
                <circle cx="169" cy="20.5" r="15" fill="none" stroke="#c41e3a" stroke-width="0.5" />
                <circle cx="169" cy="20.5" r="1" fill="#c41e3a" />
                <circle cx="169" cy="64.5" r="15" fill="none" stroke="#c41e3a" stroke-width="0.5" />
                <circle cx="169" cy="64.5" r="1" fill="#c41e3a" />

                <!-- Neutral zone faceoff dots (5ft from blue lines) -->
                <circle cx="80" cy="20.5" r="1" fill="#c41e3a" />
                <circle cx="80" cy="64.5" r="1" fill="#c41e3a" />
                <circle cx="120" cy="20.5" r="1" fill="#c41e3a" />
                <circle cx="120" cy="64.5" r="1" fill="#c41e3a" />

                <!-- Left goal crease (6ft radius semicircle, facing center) -->
                <path d="M 11 36.5 A 6 6 0 0 1 17 42.5 A 6 6 0 0 1 11 48.5" fill="rgba(135, 206, 250, 0.5)" stroke="#c41e3a" stroke-width="0.4" />

                <!-- Right goal crease (6ft radius semicircle, facing center) -->
                <path d="M 189 48.5 A 6 6 0 0 1 183 42.5 A 6 6 0 0 1 189 36.5" fill="rgba(135, 206, 250, 0.5)" stroke="#c41e3a" stroke-width="0.4" />

                <!-- Left goal (4ft deep x 6ft wide, opening faces center at goal line x=11) -->
                <rect x="7" y="39.5" width="4" height="6" fill="#fff" stroke="#c41e3a" stroke-width="0.4" />
                <!-- Goal net mesh (vertical lines) -->
                <line x1="8" y1="40" x2="8" y2="45" stroke="#ccc" stroke-width="0.2" />
                <line x1="9.5" y1="40" x2="9.5" y2="45" stroke="#ccc" stroke-width="0.2" />

                <!-- Right goal (4ft deep x 6ft wide, opening faces center at goal line x=189) -->
                <rect x="189" y="39.5" width="4" height="6" fill="#fff" stroke="#c41e3a" stroke-width="0.4" />
                <!-- Goal net mesh (vertical lines) -->
                <line x1="190.5" y1="40" x2="190.5" y2="45" stroke="#ccc" stroke-width="0.2" />
                <line x1="192" y1="40" x2="192" y2="45" stroke="#ccc" stroke-width="0.2" />
              </svg>

              <!-- SVG Pixel Players - NES Ice Hockey style (side view) -->
              {#each rinkPlayers as player (player.id)}
                <svg
                  class="pixel-player {player.team} {player.isGoalie ? 'goalie' : ''} {skateTick === 0 ? 'skate1' : 'skate2'}"
                  class:match-mode={rinkMode === 'match'}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  style="left: {player.path[0][0]}%; top: {player.path[0][1]}%; --duration: {player.animationDuration}s; animation-delay: {player.animationDelay}s; --jersey: {player.team === 'home' ? 'var(--team-primary)' : 'var(--opponent-primary)'}; --stripe: {player.team === 'home' ? 'var(--team-secondary)' : 'var(--opponent-secondary)'};"
                >
                  {#if player.isGoalie}
                    <!-- Goalie - wider stance, bigger pads -->
                    <g class="frame skate1">
                      <!-- Helmet (round with cage) -->
                      <rect x="8" y="1" width="8" height="6" fill="var(--jersey)"/>
                      <rect x="6" y="3" width="2" height="3" fill="var(--jersey)"/>
                      <rect x="7" y="4" width="3" height="2" fill="#f5d0c5"/>
                      <!-- Body/Jersey with stripes -->
                      <rect x="6" y="7" width="10" height="6" fill="var(--jersey)"/>
                      <rect x="6" y="8" width="10" height="1" fill="var(--stripe)"/>
                      <rect x="6" y="10" width="10" height="1" fill="var(--stripe)"/>
                      <!-- Blocker arm -->
                      <rect x="15" y="8" width="4" height="3" fill="var(--jersey)"/>
                      <rect x="18" y="7" width="3" height="5" fill="#f0f0f0"/>
                      <!-- Glove arm -->
                      <rect x="3" y="8" width="4" height="3" fill="var(--jersey)"/>
                      <rect x="1" y="7" width="3" height="4" fill="#8B4513"/>
                      <!-- Pads -->
                      <rect x="4" y="13" width="6" height="8" fill="#f0f0f0"/>
                      <rect x="12" y="13" width="6" height="8" fill="#f0f0f0"/>
                      <rect x="5" y="14" width="2" height="6" fill="var(--jersey)"/>
                      <rect x="15" y="14" width="2" height="6" fill="var(--jersey)"/>
                      <!-- Skates -->
                      <rect x="3" y="21" width="7" height="2" fill="#222"/>
                      <rect x="12" y="21" width="7" height="2" fill="#222"/>
                      <!-- Stick -->
                      <rect x="16" y="11" width="1" height="10" fill="#8d6e63"/>
                      <rect x="16" y="20" width="4" height="2" fill="#8d6e63"/>
                    </g>
                    <g class="frame skate2">
                      <!-- Same as frame1 but slightly shifted -->
                      <rect x="8" y="1" width="8" height="6" fill="var(--jersey)"/>
                      <rect x="6" y="3" width="2" height="3" fill="var(--jersey)"/>
                      <rect x="7" y="4" width="3" height="2" fill="#f5d0c5"/>
                      <rect x="6" y="7" width="10" height="6" fill="var(--jersey)"/>
                      <rect x="6" y="8" width="10" height="1" fill="var(--stripe)"/>
                      <rect x="6" y="10" width="10" height="1" fill="var(--stripe)"/>
                      <rect x="15" y="8" width="4" height="3" fill="var(--jersey)"/>
                      <rect x="18" y="7" width="3" height="5" fill="#f0f0f0"/>
                      <rect x="3" y="8" width="4" height="3" fill="var(--jersey)"/>
                      <rect x="1" y="7" width="3" height="4" fill="#8B4513"/>
                      <!-- Pads shifted -->
                      <rect x="5" y="13" width="6" height="8" fill="#f0f0f0"/>
                      <rect x="11" y="13" width="6" height="8" fill="#f0f0f0"/>
                      <rect x="6" y="14" width="2" height="6" fill="var(--jersey)"/>
                      <rect x="14" y="14" width="2" height="6" fill="var(--jersey)"/>
                      <rect x="4" y="21" width="7" height="2" fill="#222"/>
                      <rect x="11" y="21" width="7" height="2" fill="#222"/>
                      <rect x="16" y="11" width="1" height="10" fill="#8d6e63"/>
                      <rect x="16" y="20" width="4" height="2" fill="#8d6e63"/>
                    </g>
                  {:else}
                    <!-- Skater - NES Ice Hockey side view style -->
                    <!-- Frame 1: Back leg extended -->
                    <g class="frame skate1">
                      <!-- Helmet (round dome with visor) -->
                      <rect x="9" y="1" width="7" height="5" fill="var(--jersey)"/>
                      <rect x="8" y="2" width="2" height="4" fill="var(--jersey)"/>
                      <rect x="6" y="3" width="3" height="2" fill="var(--jersey)"/>
                      <!-- Face (side view) -->
                      <rect x="7" y="4" width="3" height="3" fill="#f5d0c5"/>
                      <!-- Eye -->
                      <rect x="7" y="5" width="1" height="1" fill="#000"/>
                      <!-- Body/Jersey - leaning forward -->
                      <rect x="8" y="7" width="8" height="6" fill="var(--jersey)"/>
                      <!-- Horizontal stripes on jersey -->
                      <rect x="8" y="8" width="8" height="1" fill="var(--stripe)"/>
                      <rect x="8" y="10" width="8" height="1" fill="var(--stripe)"/>
                      <!-- Arm holding stick -->
                      <rect x="14" y="8" width="4" height="3" fill="var(--jersey)"/>
                      <rect x="17" y="10" width="2" height="2" fill="#f5d0c5"/>
                      <!-- Pants -->
                      <rect x="9" y="13" width="6" height="4" fill="#1a1a1a"/>
                      <!-- Back leg (extended) -->
                      <rect x="6" y="16" width="3" height="4" fill="#1a1a1a"/>
                      <rect x="4" y="19" width="4" height="2" fill="#222"/>
                      <rect x="3" y="21" width="5" height="1" fill="#666"/>
                      <!-- Front leg (bent) -->
                      <rect x="12" y="16" width="3" height="3" fill="#1a1a1a"/>
                      <rect x="13" y="19" width="3" height="2" fill="#222"/>
                      <rect x="13" y="21" width="4" height="1" fill="#666"/>
                      <!-- Stick (diagonal) -->
                      <rect x="17" y="11" width="1" height="2" fill="#8d6e63"/>
                      <rect x="18" y="12" width="1" height="2" fill="#8d6e63"/>
                      <rect x="19" y="13" width="1" height="3" fill="#8d6e63"/>
                      <rect x="20" y="15" width="1" height="3" fill="#8d6e63"/>
                      <rect x="19" y="17" width="3" height="2" fill="#8d6e63"/>
                    </g>
                    <!-- Frame 2: Legs crossed/together -->
                    <g class="frame skate2">
                      <!-- Helmet -->
                      <rect x="9" y="1" width="7" height="5" fill="var(--jersey)"/>
                      <rect x="8" y="2" width="2" height="4" fill="var(--jersey)"/>
                      <rect x="6" y="3" width="3" height="2" fill="var(--jersey)"/>
                      <!-- Face -->
                      <rect x="7" y="4" width="3" height="3" fill="#f5d0c5"/>
                      <rect x="7" y="5" width="1" height="1" fill="#000"/>
                      <!-- Body -->
                      <rect x="8" y="7" width="8" height="6" fill="var(--jersey)"/>
                      <rect x="8" y="8" width="8" height="1" fill="var(--stripe)"/>
                      <rect x="8" y="10" width="8" height="1" fill="var(--stripe)"/>
                      <!-- Arm -->
                      <rect x="14" y="8" width="4" height="3" fill="var(--jersey)"/>
                      <rect x="17" y="10" width="2" height="2" fill="#f5d0c5"/>
                      <!-- Pants -->
                      <rect x="9" y="13" width="6" height="4" fill="#1a1a1a"/>
                      <!-- Legs together (gliding) -->
                      <rect x="9" y="16" width="3" height="4" fill="#1a1a1a"/>
                      <rect x="11" y="16" width="3" height="4" fill="#1a1a1a"/>
                      <rect x="8" y="19" width="4" height="2" fill="#222"/>
                      <rect x="11" y="19" width="4" height="2" fill="#222"/>
                      <rect x="7" y="21" width="5" height="1" fill="#666"/>
                      <rect x="11" y="21" width="5" height="1" fill="#666"/>
                      <!-- Stick -->
                      <rect x="17" y="11" width="1" height="2" fill="#8d6e63"/>
                      <rect x="18" y="12" width="1" height="2" fill="#8d6e63"/>
                      <rect x="19" y="13" width="1" height="3" fill="#8d6e63"/>
                      <rect x="20" y="15" width="1" height="3" fill="#8d6e63"/>
                      <rect x="19" y="17" width="3" height="2" fill="#8d6e63"/>
                    </g>
                  {/if}
                </svg>
              {/each}

              <!-- Referee (only during match) - NES style -->
              {#if rinkMode === 'match'}
                <svg
                  class="pixel-referee {skateTick === 0 ? 'skate1' : 'skate2'}"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  style="left: 50%; top: 30%;"
                >
                  <g class="frame skate1">
                    <!-- Helmet (black) -->
                    <rect x="9" y="1" width="7" height="5" fill="#222"/>
                    <rect x="8" y="2" width="2" height="4" fill="#222"/>
                    <rect x="6" y="3" width="3" height="2" fill="#222"/>
                    <!-- Face -->
                    <rect x="7" y="4" width="3" height="3" fill="#f5d0c5"/>
                    <rect x="7" y="5" width="1" height="1" fill="#000"/>
                    <!-- Striped jersey -->
                    <rect x="8" y="7" width="8" height="6" fill="#000"/>
                    <rect x="8" y="8" width="8" height="1" fill="#fff"/>
                    <rect x="8" y="10" width="8" height="1" fill="#fff"/>
                    <rect x="8" y="12" width="8" height="1" fill="#fff"/>
                    <!-- Arm -->
                    <rect x="14" y="8" width="3" height="3" fill="#000"/>
                    <!-- Pants -->
                    <rect x="9" y="13" width="6" height="4" fill="#1a1a1a"/>
                    <!-- Legs -->
                    <rect x="6" y="16" width="3" height="4" fill="#1a1a1a"/>
                    <rect x="4" y="19" width="4" height="2" fill="#222"/>
                    <rect x="3" y="21" width="5" height="1" fill="#666"/>
                    <rect x="12" y="16" width="3" height="3" fill="#1a1a1a"/>
                    <rect x="13" y="19" width="3" height="2" fill="#222"/>
                    <rect x="13" y="21" width="4" height="1" fill="#666"/>
                  </g>
                  <g class="frame skate2">
                    <rect x="9" y="1" width="7" height="5" fill="#222"/>
                    <rect x="8" y="2" width="2" height="4" fill="#222"/>
                    <rect x="6" y="3" width="3" height="2" fill="#222"/>
                    <rect x="7" y="4" width="3" height="3" fill="#f5d0c5"/>
                    <rect x="7" y="5" width="1" height="1" fill="#000"/>
                    <rect x="8" y="7" width="8" height="6" fill="#000"/>
                    <rect x="8" y="8" width="8" height="1" fill="#fff"/>
                    <rect x="8" y="10" width="8" height="1" fill="#fff"/>
                    <rect x="8" y="12" width="8" height="1" fill="#fff"/>
                    <rect x="14" y="8" width="3" height="3" fill="#000"/>
                    <rect x="9" y="13" width="6" height="4" fill="#1a1a1a"/>
                    <rect x="9" y="16" width="3" height="4" fill="#1a1a1a"/>
                    <rect x="11" y="16" width="3" height="4" fill="#1a1a1a"/>
                    <rect x="8" y="19" width="4" height="2" fill="#222"/>
                    <rect x="11" y="19" width="4" height="2" fill="#222"/>
                    <rect x="7" y="21" width="5" height="1" fill="#666"/>
                    <rect x="11" y="21" width="5" height="1" fill="#666"/>
                  </g>
                </svg>
              {/if}

              <!-- Coach (only during training) -->
              {#if rinkMode === 'training' && !isPlayingMatch}
                <svg
                  class="pixel-coach"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  style="left: 88%; top: 85%;"
                >
                  <!-- Cap -->
                  <rect x="9" y="1" width="7" height="3" fill="var(--team-primary)"/>
                  <rect x="6" y="3" width="4" height="2" fill="var(--team-primary)"/>
                  <!-- Face -->
                  <rect x="7" y="4" width="5" height="4" fill="#f5d0c5"/>
                  <rect x="8" y="5" width="1" height="1" fill="#000"/>
                  <!-- Jacket -->
                  <rect x="7" y="8" width="9" height="7" fill="#1a1a1a"/>
                  <rect x="9" y="9" width="5" height="3" fill="var(--team-primary)"/>
                  <!-- Arms -->
                  <rect x="5" y="9" width="3" height="4" fill="#1a1a1a"/>
                  <rect x="15" y="9" width="3" height="4" fill="#1a1a1a"/>
                  <!-- Clipboard -->
                  <rect x="17" y="10" width="4" height="5" fill="#d4a574"/>
                  <rect x="18" y="11" width="2" height="3" fill="#fff"/>
                  <!-- Pants -->
                  <rect x="8" y="15" width="7" height="4" fill="#1a1a1a"/>
                  <!-- Legs -->
                  <rect x="8" y="19" width="3" height="3" fill="#1a1a1a"/>
                  <rect x="12" y="19" width="3" height="3" fill="#1a1a1a"/>
                  <!-- Shoes -->
                  <rect x="7" y="22" width="4" height="1" fill="#333"/>
                  <rect x="12" y="22" width="4" height="1" fill="#333"/>
                </svg>
              {/if}

              <!-- Puck with path animation -->
              <div class="pixel-puck" class:match-mode={rinkMode === 'match'}></div>
            </div>
          </div>
        </div>
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

  /* Morale Panel - Compact single row */
  .morale-panel-compact {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    background: var(--arena-surface);
    border: 1px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    margin-bottom: var(--space-md);
  }

  .morale-panel-compact .morale-icon {
    width: 20px;
    height: 20px;
    color: var(--score-red);
    flex-shrink: 0;
  }

  .morale-panel-compact .morale-label {
    font-size: 0.75rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .morale-panel-compact .morale-stat {
    font-family: var(--font-score);
    font-size: 0.85rem;
    color: var(--ice-white);
    white-space: nowrap;
  }

  .morale-panel-compact .morale-mult {
    font-family: var(--font-score);
    font-size: 0.9rem;
    color: var(--score-gold);
    font-weight: bold;
    white-space: nowrap;
  }

  .morale-progress-compact {
    flex: 1;
    height: 8px;
    min-width: 80px;
    background: var(--arena-deep);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .morale-progress-compact .morale-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--score-red) 0%, var(--score-gold) 50%, var(--score-green) 100%);
    transition: width 0.3s ease;
  }

  .morale-boost-btn-compact {
    padding: var(--space-xs) var(--space-md);
    background: var(--arena-elevated);
    border: 1px solid var(--arena-elevated);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 0.85rem;
    color: var(--ice-white);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .morale-boost-btn-compact:hover:not(:disabled) {
    background: var(--arena-card);
  }

  .morale-boost-btn-compact:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .morale-boost-btn-compact.affordable {
    background: var(--score-gold);
    border-color: var(--score-gold);
    color: var(--arena-deep);
  }

  .morale-boost-btn-compact.affordable:hover:not(:disabled) {
    background: #d97706;
  }

  .morale-boost-btn-compact.maxed {
    background: var(--score-green);
    border-color: var(--score-green);
    color: var(--arena-deep);
    cursor: default;
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
    gap: var(--space-md);
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
    justify-content: center;
    align-items: stretch;
  }

  /* Action groups - Training vs Match */
  .action-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    background: var(--arena-surface);
    border: 1px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    justify-content: flex-start;
  }

  .action-group-label {
    font-size: 0.65rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.7;
  }

  .training-group {
    border-color: var(--ice-blue);
    border-width: 2px;
  }

  .match-group {
    border-color: var(--score-gold);
    border-width: 2px;
  }

  .match-tactics {
    display: flex;
    gap: var(--space-sm);
  }

  /* Separator between groups */
  .action-separator {
    width: 2px;
    height: 60px;
    background: linear-gradient(to bottom, transparent, var(--arena-elevated), transparent);
    align-self: center;
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
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-md);
    color: var(--ice-pale);
    font-size: 0.75rem;
    flex: 1;
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

  /* NES-style Scoreboard */
  .rink-container {
    width: 100%;
  }

  .nes-scoreboard {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-lg);
    padding: var(--space-sm) var(--space-lg);
    background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
  }

  .scoreboard-team {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .scoreboard-jersey {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  .team-name {
    font-family: var(--font-score);
    font-size: 0.8rem;
    color: var(--ice-white);
    letter-spacing: 0.1em;
  }

  .scoreboard-score {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 0 var(--space-md);
    background: #000;
    border-radius: var(--radius-sm);
  }

  .scoreboard-score .score {
    font-family: var(--font-score);
    font-size: 1.5rem;
    color: var(--score-gold);
    min-width: 24px;
    text-align: center;
  }

  .scoreboard-score .score-separator {
    color: var(--ice-pale);
    font-size: 1.2rem;
  }

  .scoreboard-result {
    position: absolute;
    right: var(--space-md);
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-family: var(--font-score);
    font-size: 0.9rem;
    color: var(--score-red);
  }

  .scoreboard-result.won {
    color: var(--score-green);
  }

  .scoreboard-result .result-rewards {
    font-size: 0.65rem;
    color: var(--score-gold);
  }

  /* Match Clock - inline in scoreboard */
  .match-clock {
    display: flex;
    align-items: center;
    background: #000;
    border: 1px solid var(--score-red);
    border-radius: var(--radius-sm);
    padding: var(--space-xs) var(--space-sm);
    margin: 0 var(--space-sm);
  }

  .match-clock .clock-time {
    font-family: var(--font-score);
    font-size: 1.1rem;
    color: var(--score-red);
    text-shadow: 0 0 8px var(--score-red);
    animation: clock-pulse 0.5s ease-in-out infinite alternate;
  }

  @keyframes clock-pulse {
    from { opacity: 1; }
    to { opacity: 0.7; }
  }

  /* Training mode scoreboard */
  .nes-scoreboard.training-mode {
    justify-content: center;
  }

  .training-scoreboard {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    background: #000;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sm);
  }

  .training-scoreboard .training-icon {
    width: 24px;
    height: 24px;
    color: var(--score-gold);
  }

  .training-scoreboard .training-label {
    font-family: var(--font-display);
    font-size: 0.9rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .training-scoreboard .training-rate {
    font-family: var(--font-score);
    font-size: 1.3rem;
    color: var(--score-green);
    text-shadow: 0 0 8px var(--score-green);
  }

  /* Unified Rink Container */
  .unified-rink-container {
    display: block;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Training boost - players rush across ice when clicking */
  .unified-rink-container.training-boost .pixel-player {
    animation-duration: 1.2s !important;
    animation-timing-function: ease-out !important;
  }

  .unified-rink-container.training-boost .pixel-player.goalie {
    animation-duration: 0.8s !important;
  }

  /* Training mode: secondary squad uses swapped team colors */
  .unified-rink-container:not(.match-mode) .pixel-player.away {
    --jersey: var(--team-secondary) !important;
    --stripe: var(--team-primary) !important;
  }

  /* NHL Rink: 200ft x 85ft = 2.35:1 ratio - FULL WIDTH */
  .unified-rink {
    width: 100%;
    aspect-ratio: 2.35 / 1;
    max-width: 1400px; /* Very large max */
    margin: 0 auto;
    position: relative;
    overflow: hidden;
    transition: transform 0.1s, box-shadow 0.2s;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }

  .rink-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }

  .unified-rink-container.match-mode .rink-svg rect:first-of-type {
    fill: #d8ecff;
  }

  /* SVG Pixel Art Players - NES Ice Hockey style */
  .pixel-player {
    position: absolute;
    width: 36px;
    height: 36px;
    transform: translate(-50%, -50%);
    z-index: 10;
    shape-rendering: crispEdges;
    image-rendering: pixelated;
    animation: skate var(--duration, 4s) ease-in-out infinite;
  }

  .pixel-player.goalie {
    width: 42px;
    height: 42px;
    animation: goalie-sway 2s ease-in-out infinite;
  }

  /* Frame visibility - NES-style animation */
  .pixel-player .frame,
  .pixel-referee .frame {
    display: none;
  }

  .pixel-player.skate1 .frame.skate1,
  .pixel-player.skate2 .frame.skate2,
  .pixel-referee.skate1 .frame.skate1,
  .pixel-referee.skate2 .frame.skate2 {
    display: block;
  }

  /* Training skating - wide movement across the rink */
  @keyframes skate {
    0% { transform: translate(-50%, -50%) translate(0, 0); }
    15% { transform: translate(-50%, -50%) translate(25%, 10%); }
    30% { transform: translate(-50%, -50%) translate(45%, 5%); }
    45% { transform: translate(-50%, -50%) translate(30%, 20%); }
    60% { transform: translate(-50%, -50%) translate(10%, 15%); }
    75% { transform: translate(-50%, -50%) translate(-5%, 5%); }
    90% { transform: translate(-50%, -50%) translate(5%, -5%); }
    100% { transform: translate(-50%, -50%) translate(0, 0); }
  }

  .pixel-player.match-mode {
    animation: skate-fast var(--duration, 4s) ease-in-out infinite;
  }

  /* Match skating - faster, more aggressive movement */
  @keyframes skate-fast {
    0% { transform: translate(-50%, -50%) translate(0, 0); }
    12% { transform: translate(-50%, -50%) translate(20%, 15%); }
    25% { transform: translate(-50%, -50%) translate(35%, 5%); }
    37% { transform: translate(-50%, -50%) translate(25%, -10%); }
    50% { transform: translate(-50%, -50%) translate(10%, 5%); }
    62% { transform: translate(-50%, -50%) translate(-5%, 15%); }
    75% { transform: translate(-50%, -50%) translate(5%, 20%); }
    87% { transform: translate(-50%, -50%) translate(15%, 10%); }
    100% { transform: translate(-50%, -50%) translate(0, 0); }
  }

  /* Goalie moves side to side tracking the puck */
  @keyframes goalie-sway {
    0%, 100% { transform: translate(-50%, -50%) translate(0, 0); }
    25% { transform: translate(-50%, -50%) translate(0, -8px); }
    50% { transform: translate(-50%, -50%) translate(3px, 5px); }
    75% { transform: translate(-50%, -50%) translate(-3px, -3px); }
  }

  /* Referee SVG */
  .pixel-referee {
    position: absolute;
    width: 36px;
    height: 36px;
    transform: translate(-50%, -50%);
    z-index: 9;
    shape-rendering: crispEdges;
    image-rendering: pixelated;
    animation: referee-follow 4s ease-in-out infinite;
  }

  /* Referee follows the play action */
  @keyframes referee-follow {
    0%, 100% { transform: translate(-50%, -50%) translate(0, 0); }
    20% { transform: translate(-50%, -50%) translate(15%, 8%); }
    40% { transform: translate(-50%, -50%) translate(25%, 12%); }
    60% { transform: translate(-50%, -50%) translate(10%, 18%); }
    80% { transform: translate(-50%, -50%) translate(-5%, 10%); }
  }

  /* Coach SVG */
  .pixel-coach {
    position: absolute;
    width: 36px;
    height: 36px;
    shape-rendering: crispEdges;
    image-rendering: pixelated;
    transform: translate(-50%, -50%);
    z-index: 8;
    animation: coach-gesture 4s ease-in-out infinite;
  }

  /* Coach gestures and occasionally walks along bench */
  @keyframes coach-gesture {
    0%, 30%, 100% { transform: translate(-50%, -50%) scale(1) translate(0, 0); }
    35%, 45% { transform: translate(-50%, -50%) scale(1.08) translate(0, 0); }
    50%, 70% { transform: translate(-50%, -50%) scale(1) translate(-10px, 0); }
    75%, 95% { transform: translate(-50%, -50%) scale(1) translate(5px, 0); }
  }

  /* Pixel Puck - scaled for larger rink */
  .pixel-puck {
    position: absolute;
    width: 12px;
    height: 12px;
    background: radial-gradient(circle at 30% 30%, #333, #000);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 15;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
    animation: puck-pass 8s linear infinite;
  }

  /* Training puck - wide passes across the whole rink between players */
  @keyframes puck-pass {
    0% { left: 25%; top: 30%; }
    8% { left: 35%; top: 50%; }
    16% { left: 20%; top: 65%; }
    24% { left: 45%; top: 40%; }
    32% { left: 65%; top: 55%; }
    40% { left: 80%; top: 35%; }
    48% { left: 75%; top: 70%; }
    56% { left: 55%; top: 50%; }
    64% { left: 40%; top: 75%; }
    72% { left: 30%; top: 45%; }
    80% { left: 50%; top: 25%; }
    88% { left: 70%; top: 50%; }
    100% { left: 25%; top: 30%; }
  }

  .pixel-puck.match-mode {
    animation: puck-battle 5s linear infinite;
  }

  /* Match puck - fast back and forth between teams */
  @keyframes puck-battle {
    0% { left: 50%; top: 50%; }
    6% { left: 35%; top: 35%; }
    12% { left: 25%; top: 55%; }
    18% { left: 20%; top: 40%; }
    24% { left: 40%; top: 60%; }
    30% { left: 55%; top: 45%; }
    36% { left: 70%; top: 55%; }
    42% { left: 80%; top: 35%; }
    48% { left: 75%; top: 65%; }
    54% { left: 60%; top: 50%; }
    60% { left: 45%; top: 40%; }
    66% { left: 30%; top: 60%; }
    72% { left: 25%; top: 45%; }
    78% { left: 40%; top: 55%; }
    84% { left: 60%; top: 40%; }
    90% { left: 75%; top: 50%; }
    96% { left: 55%; top: 45%; }
    100% { left: 50%; top: 50%; }
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
