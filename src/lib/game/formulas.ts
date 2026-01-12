/**
 * Game formulas and calculations for Ice Dynasty
 * All game math is centralized here for easy balancing
 */

import type { GameState, Era, Upgrade, MatchResult } from './types';

/**
 * Base training minutes per second when starting
 */
export const BASE_TRAINING_RATE = 1;

/**
 * Base click power (training minutes per click)
 */
export const BASE_CLICK_POWER = 1;

/**
 * Match cooldown in milliseconds (30 seconds base)
 */
export const MATCH_COOLDOWN = 30000;

/**
 * Calculate training minutes generated per second
 */
export function calculateTrainingRate(state: GameState): number {
  const baseRate = BASE_TRAINING_RATE;
  const eraMultiplier = getEraMultiplier(state.era);
  const upgradeBonus = getUpgradeBonus(state.upgrades, 'training');
  const trainingMult = getUpgradeMultiplier(state.upgrades, 'trainingMult');
  const devMultiplier = state.dev.speedMultiplier;

  return (baseRate + upgradeBonus) * eraMultiplier * trainingMult * devMultiplier;
}

/**
 * Calculate training minutes gained per click
 */
export function calculateClickPower(state: GameState): number {
  const basePower = BASE_CLICK_POWER;
  const upgradeBonus = getUpgradeBonus(state.upgrades, 'click');
  const clickMult = getUpgradeMultiplier(state.upgrades, 'clickMult');
  const eraMultiplier = getEraMultiplier(state.era);

  return (basePower + upgradeBonus) * clickMult * eraMultiplier;
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
  return state.training.totalMinutes >= calculateUpgradeCost(upgrade);
}

/**
 * Simulate a match and return results
 */
export function simulateMatch(state: GameState): MatchResult {
  // Base win chance starts at 40%, increases with training
  const trainingBonus = Math.min(0.3, state.training.totalMinutes / 10000);
  const winChanceBonus = getUpgradeBonus(state.upgrades, 'winChance');
  const winChance = Math.min(0.9, 0.4 + trainingBonus + winChanceBonus);

  const won = Math.random() < winChance;

  // Goals are somewhat random but influenced by training
  const baseGoals = won ? 3 : 1;
  const goalsFor = baseGoals + Math.floor(Math.random() * 3);
  const goalsAgainst = won
    ? Math.floor(Math.random() * goalsFor)
    : goalsFor + 1 + Math.floor(Math.random() * 2);

  // Calculate rewards
  const baseFanGain = won ? 15 : 5;
  const fanMultiplier = getUpgradeMultiplier(state.upgrades, 'fans');
  const comboMultiplier = getUpgradeMultiplier(state.upgrades, 'combo');
  const fansGained = Math.floor(
    baseFanGain * fanMultiplier * comboMultiplier * getEraMultiplier(state.era)
  );

  const baseMoneyAddition = getUpgradeBonus(state.upgrades, 'baseMoney');
  const baseMoneyGain = 50 + baseMoneyAddition + state.resources.fans * 2;
  const moneyMultiplier = getUpgradeMultiplier(state.upgrades, 'money');
  const winBonusMultiplier = won ? 1.5 + getUpgradeBonus(state.upgrades, 'winBonus') : 1;
  const moneyEarned = Math.floor(
    baseMoneyGain * moneyMultiplier * comboMultiplier * winBonusMultiplier
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
