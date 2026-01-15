/**
 * Game formulas and calculations for Ice Dynasty
 * All game math is centralized here for easy balancing
 */

import type { GameState, Era, Upgrade, MatchResult, MatchTactic, ReputationUpgrade, Challenge, ChallengeRewardType, ChallengeRestriction } from './types';

/**
 * Base training per second when starting
 * Target: First season ~6-12 hours, like AD's first Infinity
 * With active clicking, first match takes ~5-10 min
 * Without clicking, first match takes ~50 min
 */
export const BASE_TRAINING_RATE = 1;

/**
 * Base click power (training per click)
 */
export const BASE_CLICK_POWER = 30;

/**
 * Base match cost in training minutes (matches cost training, no cooldown)
 */
export const BASE_MATCH_COST = 3000;

/**
 * Morale constants
 */
export const MORALE_BASE_COST = 100;
export const MORALE_COST_MULTIPLIER = 1.5;
export const MORALE_EFFECT_PER_LEVEL = 0.05;

/**
 * Training boost constants (click to boost mechanic)
 */
export const BOOST_DURATION_MS = 5000;  // 5 seconds per click
export const BOOST_MAX_DURATION_MS = 15000;  // Max 15 seconds stacked
export const BOOST_MULTIPLIER = 5;  // 5x training rate during boost

/**
 * Tactic modifiers for matches
 */
export const TACTIC_MODIFIERS: Record<MatchTactic, {
  winChance: number;
  fanGain: number;
  money: number;
}> = {
  offensive: { winChance: -0.15, fanGain: 1.0, money: 1.5 },
  balanced: { winChance: 0, fanGain: 1.0, money: 1.0 },
  defensive: { winChance: 0.10, fanGain: 1.5, money: 0.7 },
};

/**
 * Calculate morale multiplier (1.0 + level * 0.05)
 */
export function getMoraleMultiplier(morale: { level: number }): number {
  return 1.0 + morale.level * MORALE_EFFECT_PER_LEVEL;
}

/**
 * Calculate cost for next morale level
 */
export function calculateMoraleCost(currentLevel: number): number {
  return Math.floor(MORALE_BASE_COST * Math.pow(MORALE_COST_MULTIPLIER, currentLevel));
}

/**
 * Calculate training generated per second
 */
export function calculateTrainingRate(state: GameState): number {
  const baseRate = BASE_TRAINING_RATE;
  const eraMultiplier = getEraMultiplier(state.era);
  const upgradeBonus = getUpgradeBonus(state.upgrades, 'training');
  const trainingMult = getUpgradeMultiplier(state.upgrades, 'trainingMult');
  const moraleMult = getMoraleMultiplier(state.morale);
  const devMultiplier = state.dev.speedMultiplier;

  // Reputation upgrade bonus (permanent)
  const repTrainingBonus = 1 + getReputationUpgradeBonus(state.reputationUpgrades, 'trainingRate');

  // Challenge reward bonus (permanent)
  const challengeTrainingBonus = 1 + getChallengeBonus(state.challenges, 'trainingRate');
  const allStatsBonus = 1 + getChallengeAllStatsBonus(state.challenges);

  return (baseRate + upgradeBonus) * eraMultiplier * trainingMult * moraleMult * devMultiplier * repTrainingBonus * challengeTrainingBonus * allStatsBonus;
}

/**
 * Base passive income rate per fan per second
 * Each fan generates $0.01 per second base (slowed down)
 */
export const BASE_INCOME_PER_FAN = 0.01;

/**
 * Calculate passive money income per second from fans
 * This is the economy cascade: Fans → Money
 */
export function calculatePassiveIncome(state: GameState): number {
  const fans = state.resources.fans;
  if (fans <= 0) return 0;

  const baseIncome = fans * BASE_INCOME_PER_FAN;
  const moneyMultiplier = getUpgradeMultiplier(state.upgrades, 'money');
  const eraMultiplier = getEraMultiplier(state.era);
  const devMultiplier = state.dev.speedMultiplier;

  // Reputation upgrade bonus (permanent)
  const repIncomeBonus = 1 + getReputationUpgradeBonus(state.reputationUpgrades, 'incomeRate');

  return baseIncome * moneyMultiplier * eraMultiplier * devMultiplier * repIncomeBonus;
}

/**
 * Calculate training gained per click
 */
export function calculateClickPower(state: GameState): number {
  const basePower = BASE_CLICK_POWER;
  const upgradeBonus = getUpgradeBonus(state.upgrades, 'click');
  const clickMult = getUpgradeMultiplier(state.upgrades, 'clickMult');
  const eraMultiplier = getEraMultiplier(state.era);
  const moraleMult = getMoraleMultiplier(state.morale);

  // Reputation upgrade bonus (permanent)
  const repClickBonus = 1 + getReputationUpgradeBonus(state.reputationUpgrades, 'clickPower');

  // Challenge reward bonus (permanent)
  const challengeClickBonus = 1 + getChallengeBonus(state.challenges, 'clickPower');
  const allStatsBonus = 1 + getChallengeAllStatsBonus(state.challenges);

  return (basePower + upgradeBonus) * clickMult * eraMultiplier * moraleMult * repClickBonus * challengeClickBonus * allStatsBonus;
}

/**
 * Era multiplier - increases with prestige
 */
export function getEraMultiplier(era: Era): number {
  // Each era point gives +10% bonus
  return 1 + era.points * 0.1;
}

/**
 * Get total bonus from upgrades of a specific type
 */
export function getUpgradeBonus(upgrades: Upgrade[], type: Upgrade['type']): number {
  return upgrades
    .filter((u) => u.type === type)
    .reduce((total, u) => total + u.level * u.effect, 0);
}

/**
 * Get multiplier from upgrades of a specific type (for percentage-based bonuses)
 */
export function getUpgradeMultiplier(upgrades: Upgrade[], type: Upgrade['type']): number {
  const bonus = getUpgradeBonus(upgrades, type);
  return 1 + bonus;
}

/**
 * Calculate cost for next upgrade level
 */
export function calculateUpgradeCost(upgrade: Upgrade): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level));
}

/**
 * Check if player can afford an upgrade (costs Money)
 */
export function canAffordUpgrade(state: GameState, upgradeId: string): boolean {
  const upgrade = state.upgrades.find((u) => u.id === upgradeId);
  if (!upgrade || upgrade.level >= upgrade.maxLevel) return false;

  const cost = calculateUpgradeCost(upgrade);
  return state.resources.money >= cost;
}

/**
 * Calculate current win chance (without active challenge modifications)
 */
export function calculateWinChance(state: GameState): number {
  const trainingBonus = Math.min(0.3, state.training.minutes / 10000);
  const winChanceBonus = getUpgradeBonus(state.upgrades, 'winChance');
  const moraleBonus = Math.floor(state.morale.level / 20) * 0.01; // +1% per 20 levels
  const tacticBonus = TACTIC_MODIFIERS[state.currentTactic].winChance;

  // Reputation upgrade bonus (permanent)
  const repWinBonus = getReputationUpgradeBonus(state.reputationUpgrades, 'winChance');

  // Challenge reward bonus (permanent)
  const challengeWinBonus = getChallengeBonus(state.challenges, 'winChance');

  // All stats bonus from challenges
  const allStatsBonus = getChallengeAllStatsBonus(state.challenges);

  return Math.min(0.9, Math.max(0.1, 0.4 + trainingBonus + winChanceBonus + moraleBonus + tacticBonus + repWinBonus + challengeWinBonus + allStatsBonus));
}

/**
 * Simulate a match and return results
 */
export function simulateMatch(state: GameState): MatchResult {
  // Get win chance with all bonuses
  const winChance = calculateWinChance(state);
  const won = Math.random() < winChance;

  // Goals are somewhat random but influenced by training
  const baseGoals = won ? 3 : 1;
  const goalsFor = baseGoals + Math.floor(Math.random() * 3);
  const goalsAgainst = won
    ? Math.floor(Math.random() * goalsFor)
    : goalsFor + 1 + Math.floor(Math.random() * 2);

  // Get tactic modifiers
  const tactic = TACTIC_MODIFIERS[state.currentTactic];

  // Challenge reward bonuses (permanent)
  const challengeFanBonus = 1 + getChallengeBonus(state.challenges, 'fanGain');
  const challengeMoneyBonus = 1 + getChallengeBonus(state.challenges, 'moneyGain');
  const allStatsBonus = 1 + getChallengeAllStatsBonus(state.challenges);

  // Calculate rewards with tactic modifiers
  const baseFanGain = won ? 15 : 5;
  const fanMultiplier = getUpgradeMultiplier(state.upgrades, 'fans');
  const comboMultiplier = getUpgradeMultiplier(state.upgrades, 'combo');
  const fansGained = Math.floor(
    baseFanGain * fanMultiplier * comboMultiplier * tactic.fanGain * getEraMultiplier(state.era) * challengeFanBonus * allStatsBonus
  );

  const baseMoneyAddition = getUpgradeBonus(state.upgrades, 'baseMoney');
  const baseMoneyGain = 50 + baseMoneyAddition + state.resources.fans * 2;
  const moneyMultiplier = getUpgradeMultiplier(state.upgrades, 'money');
  const winBonusMultiplier = won ? 1.5 + getUpgradeBonus(state.upgrades, 'winBonus') : 1;
  const moneyEarned = Math.floor(
    baseMoneyGain * moneyMultiplier * comboMultiplier * winBonusMultiplier * tactic.money * challengeMoneyBonus * allStatsBonus
  );

  return {
    won,
    goalsFor,
    goalsAgainst,
    fansGained,
    moneyEarned,
  };
}

/**
 * Check if enough time has passed to play another match
 */
/**
 * Calculate match cost in training minutes
 * Cost increases with season number
 */
export function getMatchCost(state: GameState): number {
  const baseCost = BASE_MATCH_COST;
  const seasonScaling = (state.season.number - 1) * 300; // +300 per season after first (~10%)
  return baseCost + seasonScaling;
}

/**
 * Check if player can afford to play a match
 */
export function canPlayMatch(state: GameState): boolean {
  const cost = getMatchCost(state);
  return state.training.minutes >= cost;
}

/**
 * Calculate reputation earned on prestige
 */
export function calculatePrestigeGain(state: GameState): number {
  // Based on total fans and era
  const fanFactor = Math.log10(state.resources.fans + 1);
  const eraFactor = state.era.current;

  return Math.floor(fanFactor * eraFactor);
}

/**
 * Check if player can prestige
 */
export function canPrestige(state: GameState): boolean {
  // Require minimum fans to prestige
  const minimumFans = 1000 * Math.pow(10, state.era.totalPrestiges);
  return state.resources.fans >= minimumFans;
}

// ========== REPUTATION UPGRADE HELPERS ==========

/**
 * Get bonus value from purchased reputation upgrades of a specific type
 */
export function getReputationUpgradeBonus(
  repUpgrades: ReputationUpgrade[],
  effectType: ReputationUpgrade['effect']['type']
): number {
  return repUpgrades
    .filter((u) => u.purchased && u.effect.type === effectType)
    .reduce((total, u) => total + u.effect.value, 0);
}

/**
 * Get starting fans from reputation upgrades
 */
export function getStartingFans(state: GameState): number {
  return getReputationUpgradeBonus(state.reputationUpgrades, 'startFans');
}

/**
 * Get starting money from reputation upgrades
 */
export function getStartingMoney(state: GameState): number {
  return getReputationUpgradeBonus(state.reputationUpgrades, 'startMoney');
}

// ========== CHALLENGE LEVEL SYSTEM HELPERS ==========

/**
 * Get the total reward from all completed levels of a challenge
 * Each level stacks: total = sum of (baseValue * rewardScaling[i]) for levels 1 to currentLevel
 */
export function getTotalChallengeReward(challenge: Challenge): number {
  if (challenge.currentLevel === 0) return 0;

  let total = 0;
  for (let i = 0; i < challenge.currentLevel; i++) {
    total += challenge.baseReward.value * challenge.rewardScaling[i];
  }
  return total;
}

/**
 * Get the reward value for a specific level (preview)
 */
export function getLevelReward(challenge: Challenge, level: number): number {
  if (level < 1 || level > challenge.maxLevel) return 0;
  return challenge.baseReward.value * challenge.rewardScaling[level - 1];
}

/**
 * Get the reward for the next uncompleted level
 */
export function getNextLevelReward(challenge: Challenge): number {
  const nextLevel = challenge.currentLevel + 1;
  if (nextLevel > challenge.maxLevel) return 0;
  return getLevelReward(challenge, nextLevel);
}

/**
 * Get goal wins for a specific level
 * goalWinsScaling contains multipliers (e.g., [1.0, 1.5, 2.0, 3.0, 4.0])
 */
export function getChallengeGoalWins(challenge: Challenge, level: number): number {
  if (challenge.goalWinsScaling) {
    const scaling = challenge.goalWinsScaling[level - 1] ?? 1;
    return Math.round(challenge.baseGoalWins * scaling);
  }
  return challenge.baseGoalWins;
}

/**
 * Get scaled restriction for a specific level
 * Applies difficulty scaling to the base restriction value
 */
export function getChallengeRestriction(challenge: Challenge, level: number): ChallengeRestriction {
  const scaling = challenge.difficultyScaling[level - 1] || 1;
  const base = challenge.baseRestriction;

  // For non-numeric restrictions, return as-is
  if (base.value === undefined || typeof base.value === 'string') {
    return { type: base.type, value: base.value };
  }

  // Scale the numeric restriction value based on difficulty
  // Higher scaling = harder restriction
  const baseValue = base.value as number;
  let scaledValue: number;

  switch (base.type) {
    case 'winChanceCap':
      // Lower cap = harder (0.50 → 0.45 → 0.40 → 0.35 → 0.30)
      scaledValue = baseValue - (scaling - 1) * 0.05;
      break;
    case 'winChanceReduction':
      // Flat reduction increases with level (10% → 15% → 20% → 25% → 30%)
      scaledValue = baseValue * scaling;
      break;
    case 'noMoney':
      // Additional training penalty at higher levels (0 → 25% → 50% → 75% → 100%)
      scaledValue = baseValue + (scaling - 1) * 0.25;
      break;
    case 'trainingDecay':
      // Higher decay = harder (5% → 7% → 10% → 15% → 25%)
      scaledValue = baseValue * (1 + (scaling - 1) * 0.5);
      break;
    case 'forcedTactic':
      // For forced tactic with numeric penalty (e.g., additional win penalty)
      scaledValue = baseValue + (scaling - 1) * 0.1;
      break;
    case 'noUpgrades':
      // Additional match cost multiplier at higher levels (1x → 2x → 3x → 4x → 5x)
      scaledValue = baseValue + (scaling - 1);
      break;
    case 'timeLimit':
      // Shorter time = harder (180 → 120 → 90 → 60 → 30)
      scaledValue = baseValue / scaling;
      break;
    case 'highGoal':
      // Higher goal wins scaling (50 → 75 → 100 → 150 → 200)
      scaledValue = baseValue * scaling;
      break;
    default:
      scaledValue = baseValue;
  }

  return {
    type: base.type,
    value: scaledValue,
  };
}

/**
 * Get bonus value from completed challenges of a specific reward type
 * Sums rewards from ALL completed levels across ALL challenges
 */
export function getChallengeBonus(
  challenges: Challenge[],
  rewardType: ChallengeRewardType
): number {
  return challenges
    .filter((c) => c.currentLevel > 0 && c.baseReward.type === rewardType)
    .reduce((total, c) => total + getTotalChallengeReward(c), 0);
}

/**
 * Get bonus from 'allStats' challenge rewards (applies to everything)
 */
export function getChallengeAllStatsBonus(challenges: Challenge[]): number {
  return challenges
    .filter((c) => c.currentLevel > 0 && c.baseReward.type === 'allStats')
    .reduce((total, c) => total + getTotalChallengeReward(c), 0);
}

// ========== SEASON SYSTEM ==========

/**
 * Calculate reputation earned when ending a season
 * Based on: wins, fans, and season speed
 */
export function calculateReputationGain(state: GameState): number {
  const winFactor = Math.sqrt(state.season.wins);
  const fanFactor = Math.log10(Math.max(1, state.resources.fans));

  // Bonus for completing season quickly (under 5 real minutes = 300 seconds, adjusted for speed)
  const seasonDuration = (Date.now() - state.season.startTime) / 1000;
  const adjustedDuration = seasonDuration * state.dev.speedMultiplier; // Account for speed
  const speedBonus = adjustedDuration < 300 ? 1.5 : 1;

  // Reputation upgrade bonus
  const repGainBonus = 1 + getReputationUpgradeBonus(state.reputationUpgrades, 'reputationGain');

  // Challenge reward bonus (permanent)
  const challengeRepBonus = 1 + getChallengeBonus(state.challenges, 'reputationGain');

  const baseGain = winFactor * fanFactor * speedBonus * repGainBonus * challengeRepBonus;

  return Math.max(1, Math.floor(baseGain));
}

/**
 * Check if player can end the current season (has reached goal)
 */
export function canEndSeason(state: GameState): boolean {
  return state.season.wins >= state.season.goalWins;
}
