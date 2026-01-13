/**
 * Game formulas and calculations for Ice Dynasty
 * All game math is centralized here for easy balancing
 */

import type { GameState, Era, Upgrade, MatchResult, MatchTactic, ReputationUpgrade, Challenge } from './types';

/**
 * Base training per second when starting
 */
export const BASE_TRAINING_RATE = 1;

/**
 * Base click power (training per click)
 */
export const BASE_CLICK_POWER = 1;

/**
 * Match cooldown in milliseconds (30 seconds base)
 */
export const MATCH_COOLDOWN = 30000;

/**
 * Morale constants
 */
export const MORALE_BASE_COST = 100;
export const MORALE_COST_MULTIPLIER = 1.5;
export const MORALE_EFFECT_PER_LEVEL = 0.05;

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

  return (baseRate + upgradeBonus) * eraMultiplier * trainingMult * moraleMult * devMultiplier * repTrainingBonus * challengeTrainingBonus;
}

/**
 * Base passive income rate per fan per second
 * Each fan generates $0.1 per second base
 */
export const BASE_INCOME_PER_FAN = 0.1;

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

  return (basePower + upgradeBonus) * clickMult * eraMultiplier * moraleMult * repClickBonus * challengeClickBonus;
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
 * Check if player can afford an upgrade
 */
export function canAffordUpgrade(state: GameState, upgradeId: string): boolean {
  const upgrade = state.upgrades.find((u) => u.id === upgradeId);
  if (!upgrade || upgrade.level >= upgrade.maxLevel) return false;

  const cost = calculateUpgradeCost(upgrade);
  return state.training.minutes >= cost;
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

  return Math.min(0.9, Math.max(0.1, 0.4 + trainingBonus + winChanceBonus + moraleBonus + tacticBonus + repWinBonus + challengeWinBonus));
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
  const challengeMoneyBonus = 1 + getChallengeBonus(state.challenges, 'baseMoney');

  // Calculate rewards with tactic modifiers
  const baseFanGain = won ? 15 : 5;
  const fanMultiplier = getUpgradeMultiplier(state.upgrades, 'fans');
  const comboMultiplier = getUpgradeMultiplier(state.upgrades, 'combo');
  const fansGained = Math.floor(
    baseFanGain * fanMultiplier * comboMultiplier * tactic.fanGain * getEraMultiplier(state.era) * challengeFanBonus
  );

  const baseMoneyAddition = getUpgradeBonus(state.upgrades, 'baseMoney');
  const baseMoneyGain = 50 + baseMoneyAddition + state.resources.fans * 2;
  const moneyMultiplier = getUpgradeMultiplier(state.upgrades, 'money');
  const winBonusMultiplier = won ? 1.5 + getUpgradeBonus(state.upgrades, 'winBonus') : 1;
  const moneyEarned = Math.floor(
    baseMoneyGain * moneyMultiplier * comboMultiplier * winBonusMultiplier * tactic.money * challengeMoneyBonus
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
export function canPlayMatch(state: GameState): boolean {
  const cooldown = MATCH_COOLDOWN / state.dev.speedMultiplier;
  return Date.now() - state.lastMatchTime >= cooldown;
}

/**
 * Get remaining cooldown time in milliseconds
 */
export function getMatchCooldown(state: GameState): number {
  const cooldown = MATCH_COOLDOWN / state.dev.speedMultiplier;
  const elapsed = Date.now() - state.lastMatchTime;
  return Math.max(0, cooldown - elapsed);
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

// ========== CHALLENGE REWARD HELPERS ==========

/**
 * Get bonus value from completed challenges of a specific reward type
 */
export function getChallengeBonus(
  challenges: Challenge[],
  rewardType: Challenge['rewardType']
): number {
  return challenges
    .filter((c) => c.completed && c.rewardType === rewardType)
    .reduce((total, c) => total + c.rewardValue, 0);
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

  const baseGain = winFactor * fanFactor * speedBonus * repGainBonus;

  return Math.max(1, Math.floor(baseGain));
}

/**
 * Check if player can end the current season (has reached goal)
 */
export function canEndSeason(state: GameState): boolean {
  return state.season.wins >= state.season.goalWins;
}
