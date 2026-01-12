/**
 * Game formulas and calculations for Ice Dynasty
 * All game math is centralized here for easy balancing
 */

import type { GameState, Era, Upgrade, MatchResult, TrainingType, MatchTactic } from './types';

/**
 * Base conditioning per second when starting
 */
export const BASE_CONDITIONING_RATE = 1;

/**
 * Base click power (conditioning per click)
 */
export const BASE_CLICK_POWER = 1;

/**
 * Base cascade rate (10% per second)
 * Conditioning -> Skating -> Shooting
 */
export const BASE_CASCADE_RATE = 0.1;

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
 * Calculate conditioning generated per second (base training rate)
 */
export function calculateConditioningRate(state: GameState): number {
  const baseRate = BASE_CONDITIONING_RATE;
  const eraMultiplier = getEraMultiplier(state.era);
  const upgradeBonus = getUpgradeBonusForType(state.upgrades, 'training', 'conditioning');
  const trainingMult = getUpgradeMultiplier(state.upgrades, 'trainingMult');
  const moraleMult = getMoraleMultiplier(state.morale);
  const devMultiplier = state.dev.speedMultiplier;

  return (baseRate + upgradeBonus) * eraMultiplier * trainingMult * moraleMult * devMultiplier;
}

/**
 * Legacy function for backward compatibility
 */
export function calculateTrainingRate(state: GameState): number {
  return calculateConditioningRate(state);
}

/**
 * Calculate conditioning gained per click
 */
export function calculateClickPower(state: GameState): number {
  const basePower = BASE_CLICK_POWER;
  const upgradeBonus = getUpgradeBonusForType(state.upgrades, 'click', 'conditioning');
  const clickMult = getUpgradeMultiplier(state.upgrades, 'clickMult');
  const eraMultiplier = getEraMultiplier(state.era);
  const moraleMult = getMoraleMultiplier(state.morale);

  return (basePower + upgradeBonus) * clickMult * eraMultiplier * moraleMult;
}

/**
 * Calculate cascade rates (how fast training types convert to the next tier)
 */
export function calculateCascadeRates(state: GameState): {
  conditioningToSkating: number;
  skatingToShooting: number;
} {
  const baseRate = BASE_CASCADE_RATE;
  const devMultiplier = state.dev.speedMultiplier;

  // Get cascade bonuses from upgrades
  const condToSkateCascade = 1 + getCascadeBonus(state.upgrades, 'skating');
  const skateToShootCascade = 1 + getCascadeBonus(state.upgrades, 'shooting');

  return {
    conditioningToSkating: baseRate * condToSkateCascade * devMultiplier,
    skatingToShooting: baseRate * skateToShootCascade * devMultiplier,
  };
}

/**
 * Get cascade bonus from upgrades affecting a specific training type
 */
export function getCascadeBonus(upgrades: Upgrade[], targetType: TrainingType): number {
  return upgrades
    .filter((u) => u.type === 'cascade' && u.affectsType === targetType)
    .reduce((total, u) => total + u.level * u.effect, 0);
}

/**
 * Get upgrade bonus for a specific upgrade type that affects a specific training type
 */
export function getUpgradeBonusForType(
  upgrades: Upgrade[],
  upgradeType: Upgrade['type'],
  trainingType: TrainingType
): number {
  return upgrades
    .filter((u) => u.type === upgradeType && (!u.affectsType || u.affectsType === trainingType))
    .reduce((total, u) => total + u.level * u.effect, 0);
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
 * Get the training amount for a specific cost type
 */
export function getTrainingForCostType(state: GameState, costType: TrainingType | undefined): number {
  const type = costType || 'conditioning'; // Default to conditioning
  return state.training[type];
}

/**
 * Check if player can afford an upgrade (using the correct training type)
 */
export function canAffordUpgrade(state: GameState, upgradeId: string): boolean {
  const upgrade = state.upgrades.find((u) => u.id === upgradeId);
  if (!upgrade || upgrade.level >= upgrade.maxLevel) return false;

  const cost = calculateUpgradeCost(upgrade);
  const available = getTrainingForCostType(state, upgrade.costType);

  return available >= cost;
}

/**
 * Calculate shooting win chance bonus (+1% per 100 shooting, max 20%)
 */
export function getShootingWinBonus(shooting: number): number {
  return Math.min(0.2, shooting / 10000);
}

/**
 * Calculate current win chance (without challenge modifications)
 * Now includes shooting bonus and tactic modifiers
 */
export function calculateWinChance(state: GameState): number {
  const trainingBonus = Math.min(0.3, state.training.totalMinutes / 10000);
  const shootingBonus = getShootingWinBonus(state.training.shooting);
  const winChanceBonus = getUpgradeBonus(state.upgrades, 'winChance');
  const shootingUpgradeBonus = getUpgradeBonus(state.upgrades, 'shootingWinChance');
  const moraleBonus = Math.floor(state.morale.level / 20) * 0.01; // +1% per 20 levels
  const tacticBonus = TACTIC_MODIFIERS[state.currentTactic].winChance;

  return Math.min(0.9, Math.max(0.1, 0.4 + trainingBonus + shootingBonus + winChanceBonus + shootingUpgradeBonus + moraleBonus + tacticBonus));
}

/**
 * Simulate a match and return results
 * Now includes tactic modifiers for rewards
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

  // Calculate rewards with tactic modifiers
  const baseFanGain = won ? 15 : 5;
  const fanMultiplier = getUpgradeMultiplier(state.upgrades, 'fans');
  const comboMultiplier = getUpgradeMultiplier(state.upgrades, 'combo');
  const fansGained = Math.floor(
    baseFanGain * fanMultiplier * comboMultiplier * tactic.fanGain * getEraMultiplier(state.era)
  );

  const baseMoneyAddition = getUpgradeBonus(state.upgrades, 'baseMoney');
  const baseMoneyGain = 50 + baseMoneyAddition + state.resources.fans * 2;
  const moneyMultiplier = getUpgradeMultiplier(state.upgrades, 'money');
  const winBonusMultiplier = won ? 1.5 + getUpgradeBonus(state.upgrades, 'winBonus') : 1;
  const moneyEarned = Math.floor(
    baseMoneyGain * moneyMultiplier * comboMultiplier * winBonusMultiplier * tactic.money
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
