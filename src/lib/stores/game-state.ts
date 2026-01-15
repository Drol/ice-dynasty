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
  getMatchCost,
  calculateReputationGain,
  canEndSeason,
  getStartingFans,
  getStartingMoney,
  getChallengeRestriction,
  getChallengeGoalWins,
  BOOST_DURATION_MS,
  BOOST_MAX_CLICKS,
  BOOST_MULTIPLIER,
} from '$lib/game/formulas';

const STORAGE_KEY = 'ice-dynasty-save';

/**
 * Calculate auto-match interval based on Improved Jockstraps upgrade level
 * Level 0: No auto-match
 * Level 1: 120 seconds
 * Level 10: ~30 seconds (15% reduction per level)
 */
function getAutoMatchInterval(state: GameState): number | null {
  const jockstraps = state.upgrades.find((u) => u.id === 'improved_jockstraps');
  if (!jockstraps || jockstraps.level === 0) return null;

  const baseInterval = 120; // 2 minutes in seconds
  const reductionPerLevel = 0.15; // 15% reduction per level
  const interval = baseInterval * Math.pow(1 - reductionPerLevel, jockstraps.level - 1);
  return Math.max(30, interval); // Minimum 30 seconds
}

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
  challengeCompletedWithoutLoss?: boolean;
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

      // Challenge achievements
      case 'challenge_initiate':
        // Any challenge at level 1+
        shouldUnlock = state.challenges.some(c => c.currentLevel >= 1);
        break;
      case 'challenger':
        // All 8 challenges at level 1+
        shouldUnlock = state.challenges.every(c => c.currentLevel >= 1);
        break;
      case 'challenge_veteran':
        // 5 challenges at level 3+
        shouldUnlock = state.challenges.filter(c => c.currentLevel >= 3).length >= 5;
        break;
      case 'perfectionist':
        // All 8 challenges at level 5
        shouldUnlock = state.challenges.every(c => c.currentLevel >= 5);
        break;
      case 'flawless_run':
        // Completed a challenge without losing - check via context
        shouldUnlock = !!(context?.challengeCompletedWithoutLoss);
        break;
      case 'speed_challenger':
        // Speed Run at level 3+
        shouldUnlock = (state.challenges.find(c => c.id === 'speed_run')?.currentLevel ?? 0) >= 3;
        break;
      case 'marathon_legend':
        // Marathon at level 5
        shouldUnlock = (state.challenges.find(c => c.id === 'marathon')?.currentLevel ?? 0) >= 5;
        break;
    }

    if (shouldUnlock) {
      newlyUnlocked.push(achievement.id);
    }
  }

  return newlyUnlocked;
}

/**
 * Get the current restriction for an active challenge
 * Returns the restriction scaled to the attempting level
 */
function getActiveChallengeRestriction(challenge: Challenge) {
  return getChallengeRestriction(challenge, challenge.attemptingLevel);
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

      // Merge challenges: keep progress but use new definitions for scaling/rewards
      let mergedChallenges = [...INITIAL_CHALLENGES];
      if (parsed.challenges?.length) {
        mergedChallenges = INITIAL_CHALLENGES.map((initialChallenge) => {
          const savedChallenge = parsed.challenges!.find((c) => c.id === initialChallenge.id);
          if (savedChallenge) {
            // Migrate old format (completed boolean) to new format (currentLevel)
            const currentLevel = savedChallenge.currentLevel ?? (savedChallenge as { completed?: boolean }).completed ? 1 : 0;
            return {
              ...initialChallenge,  // Use new definitions for scaling, rewards, etc.
              // Preserve runtime state from save
              currentLevel,
              active: savedChallenge.active || false,
              attemptingLevel: savedChallenge.attemptingLevel || 0,
              currentWins: savedChallenge.currentWins || 0,
              currentLosses: savedChallenge.currentLosses || 0,
              startedAt: savedChallenge.startedAt,
            };
          }
          return initialChallenge;
        });
      }

      // Merge reputation upgrades: use current definitions but preserve purchased status from save
      let mergedRepUpgrades = [...INITIAL_REPUTATION_UPGRADES];
      if (parsed.reputationUpgrades?.length) {
        mergedRepUpgrades = INITIAL_REPUTATION_UPGRADES.map((initialUpgrade) => {
          const savedUpgrade = parsed.reputationUpgrades!.find((u) => u.id === initialUpgrade.id);
          if (savedUpgrade) {
            // Use current definition but preserve purchased state
            return { ...initialUpgrade, purchased: savedUpgrade.purchased };
          }
          return initialUpgrade;
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
      let migratedTraining = { minutes: 0, boostUntil: 0 };
      if (parsed.training) {
        if ('minutes' in parsed.training) {
          // Already in new format
          migratedTraining = {
            minutes: parsed.training.minutes,
            boostUntil: (parsed.training as { boostUntil?: number }).boostUntil || 0
          };
        } else if ('totalMinutes' in parsed.training) {
          // Old format with totalMinutes
          migratedTraining = { minutes: (parsed.training as { totalMinutes: number }).totalMinutes, boostUntil: 0 };
        } else if ('conditioning' in parsed.training) {
          // Old cascade format - sum all types
          const oldTraining = parsed.training as { conditioning?: number; skating?: number; shooting?: number };
          migratedTraining = {
            minutes: (oldTraining.conditioning || 0) + (oldTraining.skating || 0) + (oldTraining.shooting || 0),
            boostUntil: 0
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
                ...state.training,
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
          minutes: 1500, // Start halfway to first match
          boostUntil: 0,
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
     * Handles passive training generation and challenge restrictions
     */
    tick(deltaSeconds: number) {
      update((state) => {
        if (!state.club) return state;

        // Check for active challenge restrictions
        const activeChallenge = getActiveChallenge(state);
        const restriction = activeChallenge ? getActiveChallengeRestriction(activeChallenge) : null;

        // No passive income during budget_season challenge
        const hasPassiveIncome = restriction?.type !== 'noMoney';

        // Calculate training gained this tick
        const trainingRate = calculateTrainingRate(state);
        let trainingGained = trainingRate * deltaSeconds;

        // Apply boost multiplier if active
        const now = Date.now();
        const isBoostActive = state.training.boostUntil > now;
        if (isBoostActive) {
          trainingGained *= BOOST_MULTIPLIER;
        }

        // Training decay for intensive_training challenge (5% per second)
        let trainingDecay = 0;
        if (restriction?.type === 'trainingDecay') {
          const decayRate = restriction.value as number || 0.05;
          trainingDecay = state.training.minutes * decayRate * deltaSeconds;
        }

        // Calculate passive income from fans (economy cascade)
        const incomeRate = hasPassiveIncome ? calculatePassiveIncome(state) : 0;
        const incomeGained = incomeRate * deltaSeconds;

        // Check for speed_run time limit failure
        let challengeTimedOut = false;
        if (restriction?.type === 'timeLimit') {
          const timeLimit = (restriction.value as number) * 1000; // Convert to ms
          const elapsed = Date.now() - (activeChallenge!.startedAt || Date.now());
          challengeTimedOut = elapsed > timeLimit;
        }

        // Handle challenge timeout (abandon it)
        let challenges = state.challenges;
        if (challengeTimedOut && activeChallenge) {
          challenges = state.challenges.map((c) =>
            c.id === activeChallenge.id
              ? { ...c, active: false, attemptingLevel: 0, currentWins: 0, currentLosses: 0, startedAt: undefined }
              : c
          );
        }

        return {
          ...state,
          training: {
            ...state.training,
            minutes: Math.max(0, state.training.minutes + trainingGained - trainingDecay),
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
          challenges,
          lastTick: Date.now(),
        };
      });

      // Check for auto-match (Improved Jockstraps upgrade)
      const currentState = get({ subscribe });
      const autoMatchInterval = getAutoMatchInterval(currentState);
      if (autoMatchInterval !== null) {
        const timeSinceLastMatch = (Date.now() - currentState.lastMatchTime) / 1000;
        if (timeSinceLastMatch >= autoMatchInterval && canPlayMatch(currentState)) {
          this.playMatch();
        }
      }

      // Check time-based achievements periodically (every ~5 seconds)
      if (Math.random() < deltaSeconds / 5) {
        const state = get({ subscribe });
        const newAchievements = checkAchievements(state);
        unlockAchievements(newAchievements);
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
          clickPower = 30; // BASE_CLICK_POWER
        } else {
          clickPower = calculateClickPower(state);
        }

        // Click power scales boost duration: 30 power = 5s, 60 power = 10s, etc.
        const boostDurationFromClick = BOOST_DURATION_MS * (clickPower / 30);

        // Max boost = 3 clicks worth (scales with upgrades!)
        const maxBoostDuration = BOOST_MAX_CLICKS * boostDurationFromClick;

        // Calculate new boost end time (add scaled duration, cap at max clicks)
        const currentBoostRemaining = Math.max(0, state.training.boostUntil - now);
        const newBoostDuration = Math.min(
          currentBoostRemaining + boostDurationFromClick,
          maxBoostDuration
        );
        const newBoostUntil = now + newBoostDuration;

        // Keep only clicks from the last 10 seconds for achievement tracking
        const recentClicks = state.stats.clickTimestamps.filter(
          t => now - t <= 10000
        );

        return {
          ...state,
          training: {
            ...state.training,
            boostUntil: newBoostUntil,
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
        // Block upgrades during 'no_upgrades' challenge
        const activeChallenge = getActiveChallenge(state);
        const restriction = activeChallenge ? getActiveChallengeRestriction(activeChallenge) : null;
        if (restriction?.type === 'noUpgrades') return state;

        const upgradeIndex = state.upgrades.findIndex((u) => u.id === upgradeId);
        if (upgradeIndex === -1) return state;

        const upgrade = state.upgrades[upgradeIndex];
        if (upgrade.level >= upgrade.maxLevel) return state;

        const cost = calculateUpgradeCost(upgrade);

        // Upgrades cost Money (not Training)
        if (state.resources.money < cost) return state;

        success = true;
        const newUpgrades = [...state.upgrades];
        newUpgrades[upgradeIndex] = { ...upgrade, level: upgrade.level + 1 };

        return {
          ...state,
          resources: {
            ...state.resources,
            money: state.resources.money - cost,
          },
          upgrades: newUpgrades,
        };
      });

      if (success) this.save();
      return success;
    },

    /**
     * Play a match (costs training minutes)
     */
    playMatch(): MatchResult | null {
      const state = get({ subscribe });
      if (!canPlayMatch(state)) return null;

      // Get match cost for deduction
      const matchCost = getMatchCost(state);

      const activeChallenge = getActiveChallenge(state);

      // Calculate win chance for achievement checking (use single source of truth)
      let winChance = calculateWinChance(state);

      // Get challenge restriction if active
      const challengeRestriction = activeChallenge ? getActiveChallengeRestriction(activeChallenge) : null;

      // Apply challenge restrictions to win chance
      if (challengeRestriction?.type === 'winChanceCap') {
        const cap = challengeRestriction.value as number || 0.4;
        winChance = Math.min(cap, winChance);
      } else if (challengeRestriction?.type === 'winChanceReduction') {
        const reduction = challengeRestriction.value as number || 0.1;
        winChance = Math.max(0.05, winChance - reduction); // Min 5% chance
      }

      // Simulate match with potentially modified win chance
      let result = simulateMatch(state);

      // Re-simulate if challenge affects win chance (override the result based on modified chance)
      if (challengeRestriction?.type === 'winChanceCap' || challengeRestriction?.type === 'winChanceReduction') {
        const roll = Math.random();
        const won = roll < winChance;
        result = {
          ...result,
          won,
          goalsFor: won ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 2),
          goalsAgainst: won ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 4) + 2,
        };
      }

      // Apply challenge restrictions to rewards (noMoney)
      let moneyEarned = result.moneyEarned;
      if (challengeRestriction?.type === 'noMoney') {
        moneyEarned = 0; // No money during budget season challenge
      }

      // Track if a challenge was completed flawlessly (for achievement)
      let challengeCompletedFlawlessly = false;

      update((s) => {
        let newChallenges = s.challenges;

        // Update challenge progress if active
        if (activeChallenge) {
          newChallenges = s.challenges.map((c) => {
            if (!c.active) return c;

            if (result.won) {
              const newWins = c.currentWins + 1;
              const goalWins = getChallengeGoalWins(c, c.attemptingLevel);
              const levelCompleted = newWins >= goalWins;

              if (levelCompleted) {
                // Check if completed without losses (flawless run)
                challengeCompletedFlawlessly = c.currentLosses === 0;

                // Level completed - increment currentLevel and deactivate
                return {
                  ...c,
                  currentWins: 0,
                  currentLosses: 0,
                  active: false,
                  currentLevel: c.attemptingLevel,
                  attemptingLevel: 0,
                  startedAt: undefined,
                };
              }
              return { ...c, currentWins: newWins };
            } else {
              // Track loss during challenge
              return { ...c, currentLosses: c.currentLosses + 1 };
            }
          });
        }

        // Update season wins/losses (only if not in a challenge)
        // When in a challenge, the challenge IS the season
        const inChallenge = !!activeChallenge;
        const newSeasonWins = inChallenge ? s.season.wins : s.season.wins + (result.won ? 1 : 0);
        const newSeasonLosses = inChallenge ? s.season.losses : s.season.losses + (result.won ? 0 : 1);
        const seasonCompleted = !inChallenge && newSeasonWins >= s.season.goalWins;

        return {
          ...s,
          // Deduct training cost for match
          training: {
            ...s.training,
            minutes: s.training.minutes - matchCost,
          },
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

      // Check achievements after match with context
      const updatedState = get({ subscribe });
      const newAchievements = checkAchievements(updatedState, {
        lastMatchResult: result,
        lastMatchWinChance: winChance,
        challengeCompletedWithoutLoss: challengeCompletedFlawlessly,
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
     * Start a challenge (special season with restrictions)
     * Starts the next uncompleted level of the challenge.
     * Resets the current season and applies the challenge restrictions.
     */
    startChallenge(challengeId: string): boolean {
      const state = get({ subscribe });

      // Check if any challenge is already active
      if (getActiveChallenge(state)) return false;

      const challenge = state.challenges.find((c) => c.id === challengeId);
      if (!challenge) return false;

      // Check if there are more levels to complete
      if (challenge.currentLevel >= challenge.maxLevel) return false;

      // The next level to attempt
      const nextLevel = challenge.currentLevel + 1;

      // Get the restriction for this level
      const restriction = getChallengeRestriction(challenge, nextLevel);

      // Get starting resources from reputation upgrades
      const startFans = Math.max(10, getStartingFans(state));
      const startMoney = getStartingMoney(state);

      // For forced tactic challenges, set the tactic
      let forcedTactic = state.currentTactic;
      if (restriction.type === 'forcedTactic') {
        forcedTactic = restriction.value as 'offensive' | 'defensive' | 'balanced';
      }

      update((s) => ({
        ...s,
        // Reset resources (like starting a new season, but keep reputation)
        resources: {
          fans: startFans,
          money: startMoney,
          reputation: s.resources.reputation,
        },
        // Reset training (and clear boost)
        training: {
          minutes: 0,
          boostUntil: 0,
        },
        // Reset morale
        morale: {
          level: 0,
          maxLevel: 100,
        },
        // Reset season upgrades
        upgrades: [...INITIAL_UPGRADES],
        // Apply forced tactic if any
        currentTactic: forcedTactic,
        // Reset match cooldown
        lastMatchTime: 0,
        // Mark challenge as active with the level being attempted
        challenges: s.challenges.map((c) =>
          c.id === challengeId
            ? { ...c, active: true, attemptingLevel: nextLevel, currentWins: 0, currentLosses: 0, startedAt: Date.now() }
            : c
        ),
      }));

      this.save();
      return true;
    },

    /**
     * Abandon the active challenge
     * Returns to a normal season state
     */
    abandonChallenge(): boolean {
      const state = get({ subscribe });
      const activeChallenge = getActiveChallenge(state);
      if (!activeChallenge) return false;

      update((s) => ({
        ...s,
        challenges: s.challenges.map((c) =>
          c.active
            ? { ...c, active: false, attemptingLevel: 0, currentWins: 0, currentLosses: 0, startedAt: undefined }
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
        // Reset training (and clear boost)
        training: {
          minutes: 0,
          boostUntil: 0,
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
     * Set match tactic
     */
    setTactic(tactic: MatchTactic) {
      update((state) => {
        // Block tactic changes during 'forcedTactic' challenges
        const activeChallenge = getActiveChallenge(state);
        if (activeChallenge) {
          const restriction = getActiveChallengeRestriction(activeChallenge);
          if (restriction.type === 'forcedTactic') return state;
        }

        return {
          ...state,
          currentTactic: tactic,
        };
      });
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
     * Reset game (for dev testing)
     * Complete reset - clears everything including localStorage
     */
    reset() {
      set({
        ...INITIAL_GAME_STATE,
        upgrades: [...INITIAL_UPGRADES],
        achievements: [...INITIAL_ACHIEVEMENTS],
        challenges: [...INITIAL_CHALLENGES],
        reputationUpgrades: [...INITIAL_REPUTATION_UPGRADES],
      });

      // Clear localStorage completely
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
 * Training boost end timestamp (0 = no boost)
 */
export const boostUntil = derived(
  gameState,
  ($state) => $state.training.boostUntil
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
 * Current match cost in training minutes
 */
export const matchCost = derived(gameState, ($state) => getMatchCost($state));

/**
 * Whether player can afford to play a match
 */
export const canAffordMatch = derived(gameState, ($state) => canPlayMatch($state));

/**
 * Match unlock threshold - kept for backwards compatibility
 * Now equals match cost (matches are "unlocked" when you can afford them)
 */
export const MATCH_UNLOCK_THRESHOLD = 3000;

/**
 * Whether matches are unlocked (can afford at least one match)
 */
export const matchesUnlocked = derived(
  gameState,
  ($state) => canPlayMatch($state)
);

/**
 * Auto-match interval in seconds (null if auto-match is not enabled)
 * From "Improved Jockstraps" upgrade
 */
export const autoMatchInterval = derived(
  gameState,
  ($state) => getAutoMatchInterval($state)
);

/**
 * Time until next auto-match in seconds (null if auto-match is not enabled)
 */
export const timeUntilAutoMatch = derived(
  gameState,
  ($state) => {
    const interval = getAutoMatchInterval($state);
    if (interval === null) return null;
    const elapsed = (Date.now() - $state.lastMatchTime) / 1000;
    return Math.max(0, interval - elapsed);
  }
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
  if (activeChall) {
    const restriction = getActiveChallengeRestriction(activeChall);
    if (restriction.type === 'winChanceCap') {
      const cap = restriction.value as number || 0.4;
      chance = Math.min(cap, chance);
    } else if (restriction.type === 'winChanceReduction') {
      const reduction = restriction.value as number || 0.1;
      chance = Math.max(0.05, chance - reduction); // Min 5% chance
    }
  }

  return chance;
});

/**
 * All challenges with their current level and status
 * All challenges are available from start (AD-style)
 */
export const challengesWithStatus = derived(gameState, ($state) =>
  $state.challenges.map((challenge) => ({
    ...challenge,
    // All challenges are unlocked from start
    isUnlocked: true,
    // Has at least one level completed
    hasProgress: challenge.currentLevel > 0,
    // Is fully completed (all 5 levels)
    isMaxed: challenge.currentLevel >= challenge.maxLevel,
    // Can start next level
    canStart: !challenge.active && challenge.currentLevel < challenge.maxLevel,
  }))
);

/**
 * Currently active challenge (if any)
 */
export const activeChallenge = derived(gameState, ($state) =>
  getActiveChallenge($state)
);

/**
 * Challenges with at least one level completed
 */
export const completedChallenges = derived(gameState, ($state) =>
  $state.challenges.filter((c) => c.currentLevel > 0)
);

/**
 * Challenges that can still be leveled up (not fully maxed)
 */
export const availableChallenges = derived(challengesWithStatus, ($challenges) =>
  $challenges.filter((c) => c.canStart)
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

// ========== UI BADGE COUNTS ==========

/**
 * Count of affordable upgrades (not maxed)
 */
export const affordableUpgradesCount = derived(gameState, ($state) => {
  return $state.upgrades.filter((u) => {
    if (u.level >= u.maxLevel) return false;
    if (!isUpgradeUnlocked(u, $state)) return false;
    const cost = calculateUpgradeCost(u);
    return $state.resources.money >= cost;
  }).length;
});

/**
 * Count of affordable reputation upgrades (not purchased)
 */
export const affordableRepUpgradesCount = derived(gameState, ($state) => {
  return $state.reputationUpgrades.filter((u) => {
    if (u.purchased) return false;
    return $state.resources.reputation >= u.cost;
  }).length;
});
