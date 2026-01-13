/**
 * Main game state store for Ice Dynasty
 */

import { writable, derived, get } from 'svelte/store';
import type { GameState, MatchResult, Upgrade, Achievement, Challenge, MatchTactic, ReputationUpgrade } from '$lib/game/types';
import { INITIAL_GAME_STATE, INITIAL_UPGRADES, INITIAL_ACHIEVEMENTS, INITIAL_CHALLENGES, INITIAL_REPUTATION_UPGRADES, getSeasonGoal } from '$lib/game/types';
import {
  calculateTrainingRate,
  calculatePassiveIncome,
  calculateClickPower,
  calculateUpgradeCost,
  calculateMoraleCost,
  getMoraleMultiplier,
  calculateWinChance,
  simulateMatch,
  canPlayMatch,
  calculateReputationGain,
  canEndSeason,
  getStartingFans,
  getStartingMoney,
} from '$lib/game/formulas';

const STORAGE_KEY = 'ice-dynasty-save';

/**
 * Check if an upgrade's unlock condition is met
 */
function isUpgradeUnlocked(upgrade: Upgrade, state: GameState): boolean {
  if (!upgrade.unlockCondition) return true;

  const { type, value } = upgrade.unlockCondition;

  switch (type) {
    case 'fans':
      return state.resources.fans >= value;
    case 'matchesPlayed':
      return state.stats.matchesPlayed >= value;
    case 'matchesWon':
      return state.stats.matchesWon >= value;
    case 'money':
      return state.resources.money >= value;
    case 'trainingMinutes':
      return state.training.minutes >= value;
    default:
      return true;
  }
}

/**
 * Check if an achievement should be unlocked
 * Returns array of newly unlocked achievement IDs
 */
function checkAchievements(state: GameState, context?: {
  lastMatchResult?: MatchResult;
  lastMatchWinChance?: number;
}): string[] {
  const newlyUnlocked: string[] = [];
  const now = Date.now();
  const hour = new Date(now).getHours();

  for (const achievement of state.achievements) {
    if (achievement.unlocked) continue;

    let shouldUnlock = false;

    switch (achievement.id) {
      // Bonus achievements
      case 'hot_streak':
        shouldUnlock = state.stats.consecutiveWins >= 5;
        break;
      case 'clutch_player':
        shouldUnlock = !!(context?.lastMatchResult?.won && context?.lastMatchWinChance && context.lastMatchWinChance < 0.45);
        break;
      case 'the_comeback':
        shouldUnlock = state.stats.consecutiveLosses >= 5 && !!context?.lastMatchResult?.won;
        break;
      case 'century':
        shouldUnlock = state.stats.matchesWon >= 100;
        break;
      case 'devoted_coach':
        shouldUnlock = state.training.minutes >= 10000;
        break;
      case 'sellout':
        shouldUnlock = state.stats.totalMoneyEarned >= 25000;
        break;
      case 'viral_moment':
        shouldUnlock = state.resources.fans >= 5000;
        break;
      case 'lucky_number':
        shouldUnlock = !!(context?.lastMatchResult?.won &&
          context.lastMatchResult.goalsFor === 7 &&
          context.lastMatchResult.goalsAgainst === 0);
        break;

      // Cosmetic achievements
      case 'speed_demon':
        // Check if 20 clicks in last 3 seconds
        const recentClicks3s = state.stats.clickTimestamps.filter(
          t => now - t <= 3000
        ).length;
        shouldUnlock = recentClicks3s >= 20;
        break;
      case 'night_owl':
        shouldUnlock = hour >= 0 && hour < 4 && state.club !== null;
        break;
      case 'hyperactive':
        // Check if 100 clicks in last 10 seconds
        const recentClicks10s = state.stats.clickTimestamps.filter(
          t => now - t <= 10000
        ).length;
        shouldUnlock = recentClicks10s >= 100;
        break;
      case 'patience':
        // Check if 5 minutes since last click
        shouldUnlock = state.stats.lastClickTime > 0 &&
          now - state.stats.lastClickTime >= 300000;
        break;
      case 'marathon_runner':
        shouldUnlock = state.stats.sessionMatchesPlayed >= 100;
        break;
      case 'first_steps':
        shouldUnlock = state.club !== null;
        break;
      case 'first_blood':
        shouldUnlock = state.stats.matchesWon >= 1;
        break;
    }

    if (shouldUnlock) {
      newlyUnlocked.push(achievement.id);
    }
  }

  return newlyUnlocked;
}

/**
 * Check if a challenge's unlock condition is met
 */
function isChallengeUnlocked(challenge: Challenge, state: GameState): boolean {
  if (challenge.unlocked || challenge.completed) return true;

  const { type, value } = challenge.unlockCondition;

  switch (type) {
    case 'matchesPlayed':
      return state.stats.matchesPlayed >= value;
    case 'fans':
      return state.resources.fans >= value;
    case 'money':
      return state.resources.money >= value;
    case 'matchesWon':
      return state.stats.matchesWon >= value;
    default:
      return false;
  }
}

/**
 * Get the currently active challenge (if any)
 */
function getActiveChallenge(state: GameState): Challenge | null {
  return state.challenges.find((c) => c.active) || null;
}

/**
 * Load game state from localStorage
 */
function loadState(): GameState {
  if (typeof window === 'undefined') {
    return INITIAL_GAME_STATE;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<GameState>;

      // Merge upgrades: keep saved progress but add any new upgrades from INITIAL_UPGRADES
      let mergedUpgrades = [...INITIAL_UPGRADES];
      if (parsed.upgrades?.length) {
        mergedUpgrades = INITIAL_UPGRADES.map((initialUpgrade) => {
          const savedUpgrade = parsed.upgrades!.find((u) => u.id === initialUpgrade.id);
          return savedUpgrade || initialUpgrade;
        });
      }

      // Merge achievements: keep unlocked status but add any new achievements
      let mergedAchievements = [...INITIAL_ACHIEVEMENTS];
      if (parsed.achievements?.length) {
        mergedAchievements = INITIAL_ACHIEVEMENTS.map((initialAchievement) => {
          const savedAchievement = parsed.achievements!.find((a) => a.id === initialAchievement.id);
          return savedAchievement || initialAchievement;
        });
      }

      // Merge challenges: keep progress/completed status but add any new challenges
      let mergedChallenges = [...INITIAL_CHALLENGES];
      if (parsed.challenges?.length) {
        mergedChallenges = INITIAL_CHALLENGES.map((initialChallenge) => {
          const savedChallenge = parsed.challenges!.find((c) => c.id === initialChallenge.id);
          return savedChallenge || initialChallenge;
        });
      }

      // Merge reputation upgrades: keep purchased status but add any new upgrades
      let mergedRepUpgrades = [...INITIAL_REPUTATION_UPGRADES];
      if (parsed.reputationUpgrades?.length) {
        mergedRepUpgrades = INITIAL_REPUTATION_UPGRADES.map((initialUpgrade) => {
          const savedUpgrade = parsed.reputationUpgrades!.find((u) => u.id === initialUpgrade.id);
          return savedUpgrade || initialUpgrade;
        });
      }

      // Ensure season exists (migrate from older saves)
      const migratedSeason = parsed.season || {
        number: 1,
        wins: 0,
        losses: 0,
        startTime: Date.now(),
        goalWins: 10,
        completed: false,
      };

      // Migrate old training format to new simplified format
      let migratedTraining = { minutes: 0 };
      if (parsed.training) {
        if ('minutes' in parsed.training) {
          // Already in new format
          migratedTraining = { minutes: parsed.training.minutes };
        } else if ('totalMinutes' in parsed.training) {
          // Old format with totalMinutes
          migratedTraining = { minutes: (parsed.training as { totalMinutes: number }).totalMinutes };
        } else if ('conditioning' in parsed.training) {
          // Old cascade format - sum all types
          const oldTraining = parsed.training as { conditioning?: number; skating?: number; shooting?: number };
          migratedTraining = {
            minutes: (oldTraining.conditioning || 0) + (oldTraining.skating || 0) + (oldTraining.shooting || 0)
          };
        }
      }

      // Ensure currentTactic exists
      const currentTactic = parsed.currentTactic || 'balanced';

      // Merge with initial state to handle new fields
      return {
        ...INITIAL_GAME_STATE,
        ...parsed,
        // Ensure nested objects are properly merged
        resources: { ...INITIAL_GAME_STATE.resources, ...parsed.resources },
        training: migratedTraining,
        morale: { ...INITIAL_GAME_STATE.morale, ...parsed.morale },
        currentTactic,
        season: migratedSeason,
        era: { ...INITIAL_GAME_STATE.era, ...parsed.era },
        stats: { ...INITIAL_GAME_STATE.stats, ...parsed.stats },
        settings: { ...INITIAL_GAME_STATE.settings, ...parsed.settings },
        dev: { ...INITIAL_GAME_STATE.dev, ...parsed.dev },
        upgrades: mergedUpgrades,
        achievements: mergedAchievements,
        challenges: mergedChallenges,
        reputationUpgrades: mergedRepUpgrades,
      };
    }
  } catch (e) {
    console.error('Failed to load save:', e);
  }

  return INITIAL_GAME_STATE;
}

/**
 * Save game state to localStorage
 */
function saveState(state: GameState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save:', e);
  }
}

/**
 * Create the main game state store
 */
function createGameStore() {
  const { subscribe, set, update } = writable<GameState>(INITIAL_GAME_STATE);

  /**
   * Helper to unlock achievements
   */
  const unlockAchievements = (achievementIds: string[]) => {
    if (achievementIds.length === 0) return;

    update((state) => {
      const newAchievements = state.achievements.map((a) =>
        achievementIds.includes(a.id)
          ? { ...a, unlocked: true, unlockedAt: Date.now() }
          : a
      );

      return {
        ...state,
        achievements: newAchievements,
      };
    });
  };

  return {
    subscribe,
    set,
    update,

    /**
     * Initialize store (call on mount)
     */
    init() {
      const loaded = loadState();
      set(loaded);

      // Calculate offline progress
      if (loaded.club && loaded.lastTick) {
        const now = Date.now();
        const offlineSeconds = (now - loaded.lastTick) / 1000;

        if (offlineSeconds > 1) {
          update((state) => {
            const trainingRate = calculateTrainingRate(state);
            const offlineMinutes = trainingRate * offlineSeconds;

            return {
              ...state,
              training: {
                minutes: state.training.minutes + offlineMinutes,
              },
              lastTick: now,
            };
          });
        }
      }
    },

    /**
     * Save current state
     */
    save() {
      const state = get({ subscribe });
      saveState({ ...state, lastTick: Date.now() });
    },

    /**
     * Create a new club
     */
    createClub(name: string, primaryColor: string, secondaryColor: string) {
      update((state) => ({
        ...state,
        club: {
          name,
          founded: Date.now(),
          colors: {
            primary: primaryColor,
            secondary: secondaryColor,
          },
        },
        training: {
          minutes: 0,
        },
        currentTactic: 'balanced',
        resources: {
          ...state.resources,
          fans: 10,
          money: 0,
        },
        season: {
          number: 1,
          wins: 0,
          losses: 0,
          startTime: Date.now(),
          goalWins: 10,
          completed: false,
        },
        upgrades: [...INITIAL_UPGRADES],
        lastTick: Date.now(),
        lastMatchTime: 0,
      }));

      // Check achievements after club creation
      const state = get({ subscribe });
      const newAchievements = checkAchievements(state);
      unlockAchievements(newAchievements);

      this.save();
    },

    /**
     * Game tick - called every frame
     * Handles passive training generation
     */
    tick(deltaSeconds: number) {
      update((state) => {
        if (!state.club) return state;

        // Check for active challenge restrictions
        const activeChallenge = getActiveChallenge(state);
        const hasPassiveTraining = activeChallenge?.id !== 'fatigue_test';
        const hasPassiveIncome = activeChallenge?.id !== 'budget_season';

        // Calculate training gained this tick
        const trainingRate = hasPassiveTraining ? calculateTrainingRate(state) : 0;
        const trainingGained = trainingRate * deltaSeconds;

        // Calculate passive income from fans (economy cascade)
        const incomeRate = hasPassiveIncome ? calculatePassiveIncome(state) : 0;
        const incomeGained = incomeRate * deltaSeconds;

        return {
          ...state,
          training: {
            minutes: state.training.minutes + trainingGained,
          },
          resources: {
            ...state.resources,
            money: state.resources.money + incomeGained,
          },
          stats: {
            ...state.stats,
            timePlayed: state.stats.timePlayed + deltaSeconds,
            totalMoneyEarned: state.stats.totalMoneyEarned + incomeGained,
          },
          lastTick: Date.now(),
        };
      });

      // Check time-based achievements and challenge unlocks periodically (every ~5 seconds)
      if (Math.random() < deltaSeconds / 5) {
        const state = get({ subscribe });
        const newAchievements = checkAchievements(state);
        unlockAchievements(newAchievements);
        this.updateChallengeUnlocks();
      }
    },

    /**
     * Handle click on training area
     */
    clickTrain() {
      const now = Date.now();

      update((state) => {
        if (!state.club) return state;

        // Check for underdog challenge - disables click upgrades
        const activeChallenge = getActiveChallenge(state);
        let clickPower: number;

        if (activeChallenge?.id === 'underdog') {
          // Base click power only (no upgrades)
          clickPower = 1;
        } else {
          clickPower = calculateClickPower(state);
        }

        // Keep only clicks from the last 10 seconds for achievement tracking
        const recentClicks = state.stats.clickTimestamps.filter(
          t => now - t <= 10000
        );

        return {
          ...state,
          training: {
            minutes: state.training.minutes + clickPower,
          },
          stats: {
            ...state.stats,
            lastClickTime: now,
            clickTimestamps: [...recentClicks, now],
          },
        };
      });

      // Check achievements after click
      const state = get({ subscribe });
      const newAchievements = checkAchievements(state);
      unlockAchievements(newAchievements);
    },

    /**
     * Purchase an upgrade
     */
    buyUpgrade(upgradeId: string): boolean {
      let success = false;

      update((state) => {
        const upgradeIndex = state.upgrades.findIndex((u) => u.id === upgradeId);
        if (upgradeIndex === -1) return state;

        const upgrade = state.upgrades[upgradeIndex];
        if (upgrade.level >= upgrade.maxLevel) return state;

        const cost = calculateUpgradeCost(upgrade);

        if (state.training.minutes < cost) return state;

        success = true;
        const newUpgrades = [...state.upgrades];
        newUpgrades[upgradeIndex] = { ...upgrade, level: upgrade.level + 1 };

        return {
          ...state,
          training: {
            minutes: state.training.minutes - cost,
          },
          upgrades: newUpgrades,
        };
      });

      if (success) this.save();
      return success;
    },

    /**
     * Play a match
     */
    playMatch(): MatchResult | null {
      const state = get({ subscribe });
      if (!canPlayMatch(state)) return null;

      const activeChallenge = getActiveChallenge(state);

      // Calculate win chance for achievement checking
      const winChanceFromUpgrades = state.upgrades
        .filter((u) => u.type === 'winChance')
        .reduce((total, u) => total + u.level * u.effect, 0);
      const trainingBonus = Math.min(0.3, state.training.minutes / 10000);
      const moraleBonus = Math.floor(state.morale.level / 20) * 0.01;
      let winChance = Math.min(0.9, 0.4 + trainingBonus + winChanceFromUpgrades + moraleBonus);

      // Apply challenge restrictions to win chance
      if (activeChallenge?.id === 'rookie_mode') {
        winChance = Math.min(0.5, winChance); // Cap at 50%
      }

      // Simulate match with potentially modified win chance
      let result = simulateMatch(state);

      // Re-simulate if challenge caps win chance (override the result based on capped chance)
      if (activeChallenge?.id === 'rookie_mode') {
        const roll = Math.random();
        const won = roll < winChance;
        result = {
          ...result,
          won,
          goalsFor: won ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 2),
          goalsAgainst: won ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 4) + 2,
        };
      }

      // Apply challenge restrictions to rewards
      let moneyEarned = result.moneyEarned;
      if (activeChallenge?.id === 'budget_season') {
        moneyEarned = 0; // No money during budget season
      }

      update((s) => {
        let newChallenges = s.challenges;

        // Update challenge progress if active
        if (activeChallenge) {
          newChallenges = s.challenges.map((c) => {
            if (!c.active) return c;

            let newProgress = c.progress;
            let completed = false;

            switch (c.completionType) {
              case 'winMatches':
                if (result.won) {
                  newProgress = c.progress + 1;
                  completed = newProgress >= c.completionValue;
                }
                break;
              case 'consecutiveWins':
                if (result.won) {
                  newProgress = c.progress + 1;
                  completed = newProgress >= c.completionValue;
                } else {
                  newProgress = 0; // Reset on loss
                }
                break;
              case 'winWithoutUpgrades':
                // This is tracked separately - just count wins
                if (result.won) {
                  newProgress = c.progress + 1;
                  completed = newProgress >= c.completionValue;
                }
                break;
            }

            if (completed) {
              return { ...c, progress: newProgress, active: false, completed: true };
            }
            return { ...c, progress: newProgress };
          });
        }

        // Update season wins/losses
        const newSeasonWins = s.season.wins + (result.won ? 1 : 0);
        const newSeasonLosses = s.season.losses + (result.won ? 0 : 1);
        const seasonCompleted = newSeasonWins >= s.season.goalWins;

        return {
          ...s,
          resources: {
            ...s.resources,
            fans: s.resources.fans + result.fansGained,
            money: s.resources.money + moneyEarned,
          },
          season: {
            ...s.season,
            wins: newSeasonWins,
            losses: newSeasonLosses,
            completed: seasonCompleted,
          },
          stats: {
            ...s.stats,
            matchesPlayed: s.stats.matchesPlayed + 1,
            matchesWon: s.stats.matchesWon + (result.won ? 1 : 0),
            totalMoneyEarned: s.stats.totalMoneyEarned + moneyEarned,
            totalFansGained: s.stats.totalFansGained + result.fansGained,
            sessionMatchesPlayed: s.stats.sessionMatchesPlayed + 1,
            consecutiveWins: result.won ? s.stats.consecutiveWins + 1 : 0,
            consecutiveLosses: !result.won ? s.stats.consecutiveLosses + 1 : 0,
          },
          challenges: newChallenges,
          lastMatchTime: Date.now(),
        };
      });

      // Check challenge unlocks after match
      this.updateChallengeUnlocks();

      // Check achievements after match with context
      const updatedState = get({ subscribe });
      const newAchievements = checkAchievements(updatedState, {
        lastMatchResult: result,
        lastMatchWinChance: winChance,
      });
      unlockAchievements(newAchievements);

      this.save();
      return result;
    },

    /**
     * Boost team morale
     */
    boostMorale(): boolean {
      let success = false;

      update((state) => {
        if (state.morale.level >= state.morale.maxLevel) return state;

        const cost = calculateMoraleCost(state.morale.level);
        if (state.resources.money < cost) return state;

        success = true;
        return {
          ...state,
          resources: {
            ...state.resources,
            money: state.resources.money - cost,
          },
          morale: {
            ...state.morale,
            level: state.morale.level + 1,
          },
        };
      });

      if (success) this.save();
      return success;
    },

    /**
     * Start a challenge
     */
    startChallenge(challengeId: string): boolean {
      const state = get({ subscribe });

      // Check if any challenge is already active
      if (getActiveChallenge(state)) return false;

      const challenge = state.challenges.find((c) => c.id === challengeId);
      if (!challenge || challenge.completed || !challenge.unlocked) return false;

      update((s) => ({
        ...s,
        challenges: s.challenges.map((c) =>
          c.id === challengeId
            ? { ...c, active: true, progress: 0, startedAt: Date.now() }
            : c
        ),
      }));

      this.save();
      return true;
    },

    /**
     * Abandon the active challenge
     */
    abandonChallenge(): boolean {
      const state = get({ subscribe });
      const activeChallenge = getActiveChallenge(state);
      if (!activeChallenge) return false;

      update((s) => ({
        ...s,
        challenges: s.challenges.map((c) =>
          c.active
            ? { ...c, active: false, progress: 0, startedAt: undefined }
            : c
        ),
      }));

      this.save();
      return true;
    },

    /**
     * End the current season and start a new one
     * Returns the reputation gained
     */
    endSeason(): number {
      const state = get({ subscribe });
      if (!canEndSeason(state)) return 0;

      const reputationGained = calculateReputationGain(state);

      // Calculate season duration for stats
      const seasonDuration = (Date.now() - state.season.startTime) / 1000;
      const fastestSeason = Math.min(state.stats.fastestSeason, seasonDuration);

      // Get starting resources from reputation upgrades
      const startFans = Math.max(10, getStartingFans(state));
      const startMoney = getStartingMoney(state);

      // Calculate next season goal
      const nextSeasonNumber = state.season.number + 1;
      const nextGoalWins = getSeasonGoal(nextSeasonNumber);

      update((s) => ({
        ...s,
        // Reset resources (but keep reputation)
        resources: {
          fans: startFans,
          money: startMoney,
          reputation: s.resources.reputation + reputationGained,
        },
        // Reset training
        training: {
          minutes: 0,
        },
        // Reset morale
        morale: {
          level: 0,
          maxLevel: 100,
        },
        // Start new season
        season: {
          number: nextSeasonNumber,
          wins: 0,
          losses: 0,
          startTime: Date.now(),
          goalWins: nextGoalWins,
          completed: false,
        },
        // Reset season upgrades to initial levels
        upgrades: [...INITIAL_UPGRADES],
        // Abandon any active challenge
        challenges: s.challenges.map((c) =>
          c.active ? { ...c, active: false, progress: 0, startedAt: undefined } : c
        ),
        // Update stats
        stats: {
          ...s.stats,
          totalSeasons: s.stats.totalSeasons + 1,
          fastestSeason,
          totalReputationEarned: s.stats.totalReputationEarned + reputationGained,
        },
        // Reset match cooldown
        lastMatchTime: 0,
      }));

      this.save();
      return reputationGained;
    },

    /**
     * Buy a reputation upgrade
     */
    buyReputationUpgrade(upgradeId: string): boolean {
      let success = false;

      update((state) => {
        const upgradeIndex = state.reputationUpgrades.findIndex((u) => u.id === upgradeId);
        if (upgradeIndex === -1) return state;

        const upgrade = state.reputationUpgrades[upgradeIndex];
        if (upgrade.purchased) return state;
        if (state.resources.reputation < upgrade.cost) return state;

        success = true;
        const newUpgrades = [...state.reputationUpgrades];
        newUpgrades[upgradeIndex] = { ...upgrade, purchased: true };

        return {
          ...state,
          resources: {
            ...state.resources,
            reputation: state.resources.reputation - upgrade.cost,
          },
          reputationUpgrades: newUpgrades,
        };
      });

      if (success) this.save();
      return success;
    },

    /**
     * Check and update challenge unlocks
     */
    updateChallengeUnlocks() {
      update((state) => {
        let hasChanges = false;
        const newChallenges = state.challenges.map((challenge) => {
          if (!challenge.unlocked && !challenge.completed && isChallengeUnlocked(challenge, state)) {
            hasChanges = true;
            return { ...challenge, unlocked: true };
          }
          return challenge;
        });

        if (!hasChanges) return state;

        return {
          ...state,
          challenges: newChallenges,
        };
      });
    },

    /**
     * Set match tactic
     */
    setTactic(tactic: MatchTactic) {
      update((state) => ({
        ...state,
        currentTactic: tactic,
      }));
      this.save();
    },

    /**
     * Set dev speed multiplier
     */
    setDevSpeed(multiplier: number) {
      update((state) => ({
        ...state,
        dev: {
          ...state.dev,
          speedMultiplier: multiplier,
        },
      }));
    },

    /**
     * Toggle dev mode
     */
    toggleDevMode() {
      update((state) => ({
        ...state,
        dev: {
          ...state.dev,
          enabled: !state.dev.enabled,
        },
      }));
    },

    /**
     * Reset game (for testing)
     */
    reset() {
      set({ ...INITIAL_GAME_STATE, upgrades: [...INITIAL_UPGRADES] });
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    },

    /**
     * Export save as base64 string
     */
    exportSave(): string {
      const state = get({ subscribe });
      return btoa(JSON.stringify(state));
    },

    /**
     * Import save from base64 string
     */
    importSave(data: string): boolean {
      try {
        const state = JSON.parse(atob(data)) as GameState;
        set({ ...INITIAL_GAME_STATE, ...state });
        this.save();
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const gameState = createGameStore();

// Derived stores for computed values
export const hasClub = derived(gameState, ($state) => $state.club !== null);

export const trainingRate = derived(gameState, ($state) =>
  calculateTrainingRate($state)
);

export const clickPower = derived(gameState, ($state) =>
  calculateClickPower($state)
);

export const totalMinutes = derived(
  gameState,
  ($state) => $state.training.minutes
);

/**
 * All upgrades with their unlock status
 */
export const upgradesWithStatus = derived(gameState, ($state) =>
  $state.upgrades.map((upgrade) => ({
    ...upgrade,
    isUnlocked: isUpgradeUnlocked(upgrade, $state),
  }))
);

/**
 * Only upgrades that are unlocked or have no unlock condition
 */
export const visibleUpgrades = derived(upgradesWithStatus, ($upgrades) =>
  $upgrades.filter((u) => u.isUnlocked)
);

/**
 * Upgrades that are locked with their unlock requirements
 */
export const lockedUpgrades = derived(upgradesWithStatus, ($upgrades) =>
  $upgrades.filter((u) => !u.isUnlocked)
);

/**
 * Match unlock threshold (training minutes required)
 */
export const MATCH_UNLOCK_THRESHOLD = 100;

/**
 * Whether matches are unlocked
 */
export const matchesUnlocked = derived(
  gameState,
  ($state) => $state.training.minutes >= MATCH_UNLOCK_THRESHOLD
);

/**
 * Current morale multiplier
 */
export const moraleMultiplier = derived(
  gameState,
  ($state) => getMoraleMultiplier($state.morale)
);

/**
 * Current win chance (takes into account active challenge restrictions)
 */
export const winChance = derived(gameState, ($state) => {
  let chance = calculateWinChance($state);

  // Apply challenge restrictions
  const activeChall = $state.challenges.find((c) => c.active);
  if (activeChall?.id === 'rookie_mode') {
    chance = Math.min(0.5, chance); // Cap at 50%
  }

  return chance;
});

/**
 * All challenges with their unlock status
 */
export const challengesWithStatus = derived(gameState, ($state) =>
  $state.challenges.map((challenge) => ({
    ...challenge,
    isUnlocked: isChallengeUnlocked(challenge, $state),
  }))
);

/**
 * Currently active challenge (if any)
 */
export const activeChallenge = derived(gameState, ($state) =>
  getActiveChallenge($state)
);

/**
 * Completed challenges
 */
export const completedChallenges = derived(gameState, ($state) =>
  $state.challenges.filter((c) => c.completed)
);

/**
 * Available (unlocked but not completed) challenges
 */
export const availableChallenges = derived(challengesWithStatus, ($challenges) =>
  $challenges.filter((c) => c.isUnlocked && !c.completed && !c.active)
);

/**
 * Current match tactic
 */
export const currentTactic = derived(gameState, ($state) => $state.currentTactic);

/**
 * Passive income rate (money per second from fans)
 */
export const passiveIncomeRate = derived(gameState, ($state) =>
  calculatePassiveIncome($state)
);

// ========== SEASON DERIVED STORES ==========

/**
 * Current season info
 */
export const currentSeason = derived(gameState, ($state) => $state.season);

/**
 * Whether the season goal has been reached
 */
export const seasonCompleted = derived(gameState, ($state) => canEndSeason($state));

/**
 * Season progress (wins / goal)
 */
export const seasonProgress = derived(gameState, ($state) => ({
  wins: $state.season.wins,
  goal: $state.season.goalWins,
  percentage: Math.min(100, ($state.season.wins / $state.season.goalWins) * 100),
}));

/**
 * Reputation to be gained if season ends now
 */
export const potentialReputationGain = derived(gameState, ($state) =>
  canEndSeason($state) ? calculateReputationGain($state) : 0
);

/**
 * Current reputation amount
 */
export const currentReputation = derived(gameState, ($state) => $state.resources.reputation);

/**
 * Reputation upgrades with affordability status
 */
export const reputationUpgradesWithStatus = derived(gameState, ($state) =>
  $state.reputationUpgrades.map((upgrade) => ({
    ...upgrade,
    canAfford: $state.resources.reputation >= upgrade.cost,
  }))
);
