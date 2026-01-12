/**
 * Main game state store for Ice Dynasty
 */

import { writable, derived, get } from 'svelte/store';
import type { GameState, MatchResult, Upgrade } from '$lib/game/types';
import { INITIAL_GAME_STATE, INITIAL_UPGRADES } from '$lib/game/types';
import {
  calculateTrainingRate,
  calculateClickPower,
  calculateUpgradeCost,
  simulateMatch,
  canPlayMatch,
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
      return state.training.totalMinutes >= value;
    default:
      return true;
  }
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

      // Merge with initial state to handle new fields
      return {
        ...INITIAL_GAME_STATE,
        ...parsed,
        // Ensure nested objects are properly merged
        resources: { ...INITIAL_GAME_STATE.resources, ...parsed.resources },
        training: { ...INITIAL_GAME_STATE.training, ...parsed.training },
        era: { ...INITIAL_GAME_STATE.era, ...parsed.era },
        stats: { ...INITIAL_GAME_STATE.stats, ...parsed.stats },
        settings: { ...INITIAL_GAME_STATE.settings, ...parsed.settings },
        dev: { ...INITIAL_GAME_STATE.dev, ...parsed.dev },
        upgrades: mergedUpgrades,
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
                ...state.training,
                totalMinutes: state.training.totalMinutes + offlineMinutes,
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
          minutesPerSecond: 1,
          totalMinutes: 0,
        },
        resources: {
          ...state.resources,
          fans: 10,
          money: 0,
        },
        upgrades: [...INITIAL_UPGRADES],
        lastTick: Date.now(),
        lastMatchTime: 0,
      }));
      this.save();
    },

    /**
     * Game tick - called every frame
     */
    tick(deltaSeconds: number) {
      update((state) => {
        if (!state.club) return state;

        const trainingRate = calculateTrainingRate(state);
        const minutesGained = trainingRate * deltaSeconds;

        return {
          ...state,
          training: {
            ...state.training,
            totalMinutes: state.training.totalMinutes + minutesGained,
          },
          stats: {
            ...state.stats,
            timePlayed: state.stats.timePlayed + deltaSeconds,
          },
          lastTick: Date.now(),
        };
      });
    },

    /**
     * Handle click on training area
     */
    clickTrain() {
      update((state) => {
        if (!state.club) return state;

        const clickPower = calculateClickPower(state);

        return {
          ...state,
          training: {
            ...state.training,
            totalMinutes: state.training.totalMinutes + clickPower,
          },
        };
      });
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
        if (state.training.totalMinutes < cost) return state;

        success = true;
        const newUpgrades = [...state.upgrades];
        newUpgrades[upgradeIndex] = { ...upgrade, level: upgrade.level + 1 };

        return {
          ...state,
          training: {
            ...state.training,
            totalMinutes: state.training.totalMinutes - cost,
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

      const result = simulateMatch(state);

      update((s) => ({
        ...s,
        resources: {
          ...s.resources,
          fans: s.resources.fans + result.fansGained,
          money: s.resources.money + result.moneyEarned,
        },
        stats: {
          ...s.stats,
          matchesPlayed: s.stats.matchesPlayed + 1,
          matchesWon: s.stats.matchesWon + (result.won ? 1 : 0),
          totalMoneyEarned: s.stats.totalMoneyEarned + result.moneyEarned,
          totalFansGained: s.stats.totalFansGained + result.fansGained,
        },
        lastMatchTime: Date.now(),
      }));

      this.save();
      return result;
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
  ($state) => $state.training.totalMinutes
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
