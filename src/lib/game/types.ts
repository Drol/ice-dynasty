/**
 * Core game types for Ice Dynasty
 */

export interface Club {
  name: string;
  founded: number; // timestamp
  colors: {
    primary: string;
    secondary: string;
  };
}

export interface Resources {
  money: number;
  fans: number;
  reputation: number; // prestige currency, persists across resets
}

/**
 * Match tactic - affects risk/reward of matches
 */
export type MatchTactic = 'offensive' | 'balanced' | 'defensive';

/**
 * Training resources - simplified single resource
 */
export interface Training {
  minutes: number;  // Total training minutes
  boostUntil: number;  // Timestamp when boost ends (0 = no boost)
}

export interface PlayerStats {
  skating: number;
  shooting: number;
  passing: number;
  defense: number;
  goaltending: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  stats: PlayerStats;
  potential: number; // 1-100, affects training gains
}

export interface Facility {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  effect: string; // description of what it does
}

export interface Era {
  current: number; // 1-4
  points: number; // earned from prestige
  totalPrestiges: number;
}

/**
 * Season - the main prestige loop (like Infinity in AD)
 */
export interface Season {
  number: number;           // Current season number (1, 2, 3...)
  wins: number;             // Wins this season
  losses: number;           // Losses this season
  startTime: number;        // When the season started (timestamp)
  goalWins: number;         // How many wins needed to complete season
  completed: boolean;       // Has reached the goal?
}

/**
 * Reputation upgrade - permanent bonuses that persist between seasons
 */
export interface ReputationUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  purchased: boolean;
  effect: {
    type: 'trainingRate' | 'winChance' | 'startFans' | 'startMoney' |
          'clickPower' | 'incomeRate' | 'reputationGain' | 'upgradeEffect';
    value: number;
  };
}

export interface Morale {
  level: number; // 0-100
  maxLevel: number; // 100
}

export interface Achievement {
  id: string;
  name: string;
  description: string; // Hidden until unlocked
  unlocked: boolean;
  unlockedAt?: number; // timestamp
  rewardType: 'bonus' | 'cosmetic';
  bonusType?: 'winChance' | 'fanGain' | 'moneyGain' | 'trainingRate' | 'baseMoney' | 'clickPower' | 'all';
  bonusValue?: number; // Multiplier or flat bonus
  badge?: string; // For cosmetic rewards
}

/**
 * Challenge restriction types for special seasons
 */
export type ChallengeRestrictionType =
  | 'winChanceCap'        // Legacy: Max win chance capped
  | 'winChanceReduction'  // C1: Flat win chance reduction
  | 'noMoney'             // C2: No money from matches or passive
  | 'trainingDecay'       // C3: Training decays over time
  | 'forcedTactic'        // C4/C5: Locked to specific tactic
  | 'noUpgrades'          // C6: Can't buy season upgrades
  | 'timeLimit'           // C7: Must complete within time
  | 'highGoal';           // C8: Higher win requirement

export interface ChallengeRestriction {
  type: ChallengeRestrictionType;
  value?: number | string; // e.g., 0.4 for 40% cap, 'offensive' for forced tactic
}

/**
 * Challenge reward types
 */
export type ChallengeRewardType = 'winChance' | 'fanGain' | 'trainingRate' | 'moneyGain' | 'clickPower' | 'reputationGain' | 'allStats';

/**
 * Challenge - Special seasons with restrictions (like Infinity Challenges in AD)
 * Now with level system (1-5) - each level is harder but gives more reward.
 * All challenges available from start, can only attempt next level.
 */
export interface Challenge {
  id: string;
  name: string;
  description: string;

  // Level system (1-5)
  maxLevel: number;  // Always 5
  currentLevel: number;  // 0 = not completed, 1-5 = completed levels

  // Base values (for level 1)
  baseRestriction: ChallengeRestriction;
  baseGoalWins: number;
  baseReward: {
    type: ChallengeRewardType;
    value: number;
    description: string;
  };

  // Scaling per level (indices 0-4 for levels 1-5)
  // difficultyScaling affects the restriction value
  // rewardScaling affects the reward multiplier
  difficultyScaling: number[];  // e.g., [1.0, 1.5, 2.0, 3.0, 5.0]
  rewardScaling: number[];      // e.g., [1.0, 1.3, 1.5, 1.7, 2.0]

  // For challenges that scale goalWins (like Marathon)
  goalWinsScaling?: number[];  // e.g., [1.0, 1.5, 2.0, 3.0, 4.0] for Marathon: 50→75→100→150→200

  // Runtime state
  active: boolean;
  attemptingLevel: number;  // 1-5, which level being attempted (0 = not active)
  currentWins: number;
  currentLosses: number;  // For tracking flawless runs
  startedAt?: number;
}

export interface GameState {
  version: number;
  club: Club | null;
  resources: Resources;
  training: Training;
  morale: Morale;
  currentTactic: MatchTactic;
  season: Season;
  reputationUpgrades: ReputationUpgrade[];
  players: Player[];
  facilities: Facility[];
  upgrades: Upgrade[];
  achievements: Achievement[];
  challenges: Challenge[];
  era: Era;
  stats: GameStats;
  settings: GameSettings;
  dev: DevSettings;
  lastTick: number; // timestamp for offline progress
  lastMatchTime: number; // timestamp of last match
}

export interface GameStats {
  totalMoneyEarned: number;
  totalFansGained: number;
  matchesPlayed: number;
  matchesWon: number;
  timePlayed: number; // seconds
  consecutiveWins: number;
  consecutiveLosses: number;
  lastClickTime: number; // timestamp
  clickTimestamps: number[]; // For tracking clicks in time windows
  sessionMatchesPlayed: number; // Reset on page load
  // Season stats
  totalSeasons: number;         // Total seasons completed
  fastestSeason: number;        // Fastest season time in seconds
  totalReputationEarned: number; // All-time reputation earned
}

export interface GameSettings {
  notationsStyle: 'standard' | 'scientific' | 'engineering';
  autoSaveInterval: number; // seconds
  showTutorial: boolean;
}

export interface DevSettings {
  enabled: boolean;
  speedMultiplier: number; // 1x, 2x, 5x, 10x
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effect: number; // multiplier or flat bonus depending on type
  type: 'training' | 'fans' | 'money' | 'click' | 'winChance' | 'clickMult' | 'baseMoney' | 'combo' | 'winBonus' | 'trainingMult' | 'autoMatch';
  unlockCondition?: {
    type: 'fans' | 'matchesPlayed' | 'matchesWon' | 'money' | 'trainingMinutes';
    value: number;
  };
}

export interface MatchResult {
  won: boolean;
  goalsFor: number;
  goalsAgainst: number;
  fansGained: number;
  moneyEarned: number;
}

export const INITIAL_UPGRADES: Upgrade[] = [
  // ========== TRAINING UPGRADES ==========
  {
    id: 'better_skates',
    name: 'Better Skates',
    description: '+5s boost duration per click',
    level: 0,
    maxLevel: 50,
    baseCost: 50,
    costMultiplier: 1.5,
    effect: 30,
    type: 'click',
  },
  {
    id: 'training_rink',
    name: 'Training Rink',
    description: '+15 training per second',
    level: 0,
    maxLevel: 100,
    baseCost: 300,
    costMultiplier: 1.4,
    effect: 15,
    type: 'training',
  },
  {
    id: 'hockey_sticks',
    name: 'Better Sticks',
    description: '+10s boost duration per click',
    level: 0,
    maxLevel: 40,
    baseCost: 100,
    costMultiplier: 1.6,
    effect: 60,
    type: 'click',
  },
  {
    id: 'volunteer_coaches',
    name: 'Volunteer Coaches',
    description: '+30 training per second',
    level: 0,
    maxLevel: 75,
    baseCost: 800,
    costMultiplier: 1.5,
    effect: 30,
    type: 'training',
  },

  // ========== MATCH UPGRADES ==========
  {
    id: 'youth_program',
    name: 'Youth Program',
    description: '+10% fan gain from matches',
    level: 0,
    maxLevel: 25,
    baseCost: 1000,
    costMultiplier: 1.8,
    effect: 0.1,
    type: 'fans',
  },
  {
    id: 'merchandise',
    name: 'Merchandise Stand',
    description: '+20% money from matches',
    level: 0,
    maxLevel: 25,
    baseCost: 2500,
    costMultiplier: 2.0,
    effect: 0.2,
    type: 'money',
  },
  {
    id: 'garage_rink',
    name: 'Garage Rink',
    description: '+2.5% win chance',
    level: 0,
    maxLevel: 20,
    baseCost: 500,
    costMultiplier: 1.7,
    effect: 0.025,
    type: 'winChance',
  },

  // ========== MID GAME - UNLOCKABLE ==========
  {
    id: 'equipment_locker',
    name: 'Equipment Locker',
    description: 'Multiplies boost duration by 1.1x',
    level: 0,
    maxLevel: 15,
    baseCost: 2000,
    costMultiplier: 2.0,
    effect: 0.1,
    type: 'clickMult',
    unlockCondition: { type: 'fans', value: 500 },
  },
  {
    id: 'local_sponsors',
    name: 'Local Sponsors',
    description: '+$25 base match income',
    level: 0,
    maxLevel: 30,
    baseCost: 3750,
    costMultiplier: 1.8,
    effect: 25,
    type: 'baseMoney',
    unlockCondition: { type: 'matchesPlayed', value: 50 },
  },
  {
    id: 'team_jerseys',
    name: 'Team Jerseys',
    description: '+5% money and +5% fans from matches',
    level: 0,
    maxLevel: 20,
    baseCost: 5000,
    costMultiplier: 1.9,
    effect: 0.05,
    type: 'combo',
    unlockCondition: { type: 'fans', value: 1000 },
  },
  {
    id: 'outdoor_flooding',
    name: 'Outdoor Flooding',
    description: '+100 training per second',
    level: 0,
    maxLevel: 50,
    baseCost: 12500,
    costMultiplier: 1.6,
    effect: 100,
    type: 'training',
    unlockCondition: { type: 'matchesPlayed', value: 100 },
  },

  // ========== LATE GAME ==========
  {
    id: 'improved_jockstraps',
    name: 'Improved Jockstraps',
    description: 'Auto-plays matches (starts at 2min, -15%/level)',
    level: 0,
    maxLevel: 10,
    baseCost: 15000,
    costMultiplier: 2.0,
    effect: 0.15,  // 15% interval reduction per level
    type: 'autoMatch',
    unlockCondition: { type: 'matchesPlayed', value: 75 },
  },
  {
    id: 'community_support',
    name: 'Community Support',
    description: '+50% fan gain from matches',
    level: 0,
    maxLevel: 15,
    baseCost: 25000,
    costMultiplier: 2.2,
    effect: 0.5,
    type: 'fans',
    unlockCondition: { type: 'fans', value: 2500 },
  },
  {
    id: 'tournament_entry',
    name: 'Tournament Entry',
    description: '+100% match rewards when winning',
    level: 0,
    maxLevel: 10,
    baseCost: 50000,
    costMultiplier: 2.5,
    effect: 1.0,
    type: 'winBonus',
    unlockCondition: { type: 'matchesWon', value: 25 },
  },
  {
    id: 'grassroots_legend',
    name: 'Grassroots Legend',
    description: 'All training +25%',
    level: 0,
    maxLevel: 5,
    baseCost: 125000,
    costMultiplier: 3.0,
    effect: 0.25,
    type: 'trainingMult',
    unlockCondition: { type: 'fans', value: 5000 },
  },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  // Achievements with Permanent Bonuses
  {
    id: 'hot_streak',
    name: 'Hot Streak',
    description: 'Win 5 matches in a row',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'winChance',
    bonusValue: 0.05, // +5% win chance
  },
  {
    id: 'clutch_player',
    name: 'Clutch Player',
    description: 'Win a match with less than 45% win chance',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'winChance',
    bonusValue: 0.03, // +3% win chance
  },
  {
    id: 'the_comeback',
    name: 'The Comeback',
    description: 'Win after 5 losses in a row',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'fanGain',
    bonusValue: 0.1, // +10% fan gain
  },
  {
    id: 'century',
    name: 'Century',
    description: 'Win 100 matches',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'moneyGain',
    bonusValue: 0.15, // +15% money from matches
  },
  {
    id: 'devoted_coach',
    name: 'Devoted Coach',
    description: 'Accumulate 10,000 training minutes',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'trainingRate',
    bonusValue: 0.1, // +10% training rate
  },
  {
    id: 'sellout',
    name: 'Sellout',
    description: 'Earn $25,000 total',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'baseMoney',
    bonusValue: 20, // +$20 base money
  },
  {
    id: 'viral_moment',
    name: 'Viral Moment',
    description: 'Reach 5,000 fans',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'fanGain',
    bonusValue: 0.25, // +25% fan gain
  },
  {
    id: 'lucky_number',
    name: 'Lucky Number',
    description: 'Win a match 7-0',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'all',
    bonusValue: 0.07, // +7% to everything (easter egg)
  },

  // Cosmetic Achievements
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Click 20 times in 3 seconds',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '⚡',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Play between midnight and 4 AM',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '🌙',
  },
  {
    id: 'hyperactive',
    name: 'Hyperactive',
    description: 'Click 100 times in 10 seconds',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '🌪️',
  },
  {
    id: 'patience',
    name: 'Patience',
    description: 'Wait 5 minutes without clicking',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '🧘',
  },
  {
    id: 'marathon_runner',
    name: 'Marathon Runner',
    description: 'Play 100 matches in a single session',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '🏃',
  },
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Create your club',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '👶',
  },
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Win your first match',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '🏆',
  },

  // Challenge Achievements
  {
    id: 'challenge_initiate',
    name: 'Challenge Initiate',
    description: 'Complete any challenge at level 1',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'all',
    bonusValue: 0.05, // +5% all stats
  },
  {
    id: 'challenger',
    name: 'Challenger',
    description: 'Complete all 8 challenges at level 1',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'all',
    bonusValue: 0.1, // +10% all stats
  },
  {
    id: 'challenge_veteran',
    name: 'Veteran',
    description: 'Complete 5 challenges at level 3',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'trainingRate',
    bonusValue: 0.15, // +15% training rate
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete all 8 challenges at level 5',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'all',
    bonusValue: 0.5, // +50% all stats
  },
  {
    id: 'flawless_run',
    name: 'Flawless Run',
    description: 'Complete a challenge without losing a match',
    unlocked: false,
    rewardType: 'bonus',
    bonusType: 'winChance',
    bonusValue: 0.1, // +10% win chance
  },
  {
    id: 'speed_challenger',
    name: 'Speed Challenger',
    description: 'Complete Speed Run at level 3',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '⏱️',
  },
  {
    id: 'marathon_legend',
    name: 'Marathon Legend',
    description: 'Complete Marathon at level 5',
    unlocked: false,
    rewardType: 'cosmetic',
    badge: '🏅',
  },
];

/**
 * Default scaling arrays for challenges
 * difficultyScaling: How much harder each level is (multiplies restriction values)
 * rewardScaling: How much reward each level gives (multiplies base reward)
 */
const DEFAULT_DIFFICULTY_SCALING = [1.0, 1.5, 2.0, 3.0, 5.0];
const DEFAULT_REWARD_SCALING = [1.0, 1.3, 1.5, 1.7, 2.0];

/**
 * Challenges are special seasons with restrictions (like Infinity Challenges in AD)
 * All challenges available from start with 5 levels each.
 * Each level is progressively harder but gives stacking rewards.
 */
export const INITIAL_CHALLENGES: Challenge[] = [
  {
    id: 'rookie_season',
    name: 'Rookie Season',
    description: 'Prove you can win even with reduced odds.',
    maxLevel: 5,
    currentLevel: 0,
    baseRestriction: { type: 'winChanceReduction', value: 0.1 },  // L1: -10%, L2: -15%, L3: -20%, L4: -25%, L5: -30%
    baseGoalWins: 10,
    baseReward: {
      type: 'winChance',
      value: 0.01,  // +1% per level (total +7.5% at L5)
      description: '+1% permanent win chance',
    },
    difficultyScaling: [1.0, 1.5, 2.0, 2.5, 3.0],  // -10%→-15%→-20%→-25%→-30%
    rewardScaling: DEFAULT_REWARD_SCALING,
    active: false,
    attemptingLevel: 0,
    currentWins: 0,
    currentLosses: 0,
  },
  {
    id: 'budget_season',
    name: 'Budget Season',
    description: 'Complete a season without any money income.',
    maxLevel: 5,
    currentLevel: 0,
    baseRestriction: { type: 'noMoney' },  // L2+: also reduces training rate
    baseGoalWins: 10,
    baseReward: {
      type: 'fanGain',
      value: 0.04,  // +4% per level (total +30% at L5)
      description: '+4% permanent fan gain',
    },
    difficultyScaling: [1.0, 1.0, 1.0, 1.0, 1.0],  // noMoney doesn't scale numerically, handled specially
    rewardScaling: DEFAULT_REWARD_SCALING,
    active: false,
    attemptingLevel: 0,
    currentWins: 0,
    currentLosses: 0,
  },
  {
    id: 'intensive_training',
    name: 'Intensive Training',
    description: 'Your training decays rapidly. Keep clicking!',
    maxLevel: 5,
    currentLevel: 0,
    baseRestriction: { type: 'trainingDecay', value: 0.05 },  // L1: 5%, L2: 7%, L3: 10%, L4: 15%, L5: 25%
    baseGoalWins: 10,
    baseReward: {
      type: 'trainingRate',
      value: 0.06,  // +6% per level (total +45% at L5)
      description: '+6% permanent training rate',
    },
    difficultyScaling: [1.0, 1.4, 2.0, 3.0, 5.0],  // 5%→7%→10%→15%→25%
    rewardScaling: DEFAULT_REWARD_SCALING,
    active: false,
    attemptingLevel: 0,
    currentWins: 0,
    currentLosses: 0,
  },
  {
    id: 'all_out_attack',
    name: 'All-Out Attack',
    description: 'Locked to Offensive tactic with increasing penalties.',
    maxLevel: 5,
    currentLevel: 0,
    baseRestriction: { type: 'forcedTactic', value: 'offensive' },  // L2+: extra win penalty
    baseGoalWins: 10,
    baseReward: {
      type: 'moneyGain',
      value: 0.05,  // +5% per level (total +37.5% at L5)
      description: '+5% permanent match money',
    },
    difficultyScaling: [1.0, 1.1, 1.2, 1.3, 1.4],  // 0%→10%→20%→30%→40% extra penalty
    rewardScaling: DEFAULT_REWARD_SCALING,
    active: false,
    attemptingLevel: 0,
    currentWins: 0,
    currentLosses: 0,
  },
  {
    id: 'defensive_grind',
    name: 'Defensive Grind',
    description: 'Locked to Defensive tactic. Increasingly slow.',
    maxLevel: 5,
    currentLevel: 0,
    baseRestriction: { type: 'forcedTactic', value: 'defensive' },  // L2+: slower training
    baseGoalWins: 10,
    baseReward: {
      type: 'fanGain',
      value: 0.05,  // +5% per level (total +37.5% at L5)
      description: '+5% permanent fan gain from matches',
    },
    difficultyScaling: [1.0, 1.2, 1.4, 1.6, 1.8],  // 0%→20%→40%→60%→80% slower
    rewardScaling: DEFAULT_REWARD_SCALING,
    active: false,
    attemptingLevel: 0,
    currentWins: 0,
    currentLosses: 0,
  },
  {
    id: 'no_upgrades',
    name: 'No Upgrades',
    description: 'Complete a season without buying any upgrades.',
    maxLevel: 5,
    currentLevel: 0,
    baseRestriction: { type: 'noUpgrades' },  // L2+: increased match cost
    baseGoalWins: 10,
    baseReward: {
      type: 'allStats',
      value: 0.02,  // +2% per level (total +15% at L5)
      description: '+2% to all stats permanently',
    },
    difficultyScaling: [1.0, 2.0, 3.0, 4.0, 5.0],  // Match cost multiplier
    rewardScaling: DEFAULT_REWARD_SCALING,
    active: false,
    attemptingLevel: 0,
    currentWins: 0,
    currentLosses: 0,
  },
  {
    id: 'speed_run',
    name: 'Speed Run',
    description: 'Complete the season within time limit.',
    maxLevel: 5,
    currentLevel: 0,
    baseRestriction: { type: 'timeLimit', value: 180 },  // L1: 180s, L2: 120s, L3: 90s, L4: 60s, L5: 30s
    baseGoalWins: 10,
    baseReward: {
      type: 'reputationGain',
      value: 0.1,  // +10% per level (total +75% at L5)
      description: '+10% permanent reputation gain',
    },
    difficultyScaling: [1.0, 1.5, 2.0, 3.0, 6.0],  // 180/x = 180, 120, 90, 60, 30
    rewardScaling: DEFAULT_REWARD_SCALING,
    active: false,
    attemptingLevel: 0,
    currentWins: 0,
    currentLosses: 0,
  },
  {
    id: 'marathon',
    name: 'Marathon',
    description: 'A grueling long season. Only for the dedicated.',
    maxLevel: 5,
    currentLevel: 0,
    baseRestriction: { type: 'highGoal', value: 50 },
    baseGoalWins: 50,  // L1: 50, L2: 75, L3: 100, L4: 150, L5: 200
    baseReward: {
      type: 'allStats',
      value: 0.05,  // +5% per level (total +37.5% at L5)
      description: '+5% to all stats permanently',
    },
    difficultyScaling: DEFAULT_DIFFICULTY_SCALING,
    rewardScaling: DEFAULT_REWARD_SCALING,
    goalWinsScaling: [1.0, 1.5, 2.0, 3.0, 4.0],  // 50→75→100→150→200
    active: false,
    attemptingLevel: 0,
    currentWins: 0,
    currentLosses: 0,
  },
];

export const INITIAL_REPUTATION_UPGRADES: ReputationUpgrade[] = [
  {
    id: 'veteran_coach',
    name: 'Veteran Coach',
    description: '+200% base training rate',
    cost: 5,
    purchased: false,
    effect: { type: 'trainingRate', value: 2.0 },
  },
  {
    id: 'better_facilities',
    name: 'Better Facilities',
    description: '+25% all season upgrade effects',
    cost: 10,
    purchased: false,
    effect: { type: 'upgradeEffect', value: 0.25 },
  },
  {
    id: 'scouting_network',
    name: 'Scouting Network',
    description: '+10% base win chance',
    cost: 15,
    purchased: false,
    effect: { type: 'winChance', value: 0.1 },
  },
  {
    id: 'fan_loyalty',
    name: 'Fan Loyalty',
    description: 'Start each season with 100 fans',
    cost: 20,
    purchased: false,
    effect: { type: 'startFans', value: 100 },
  },
  {
    id: 'sponsor_contacts',
    name: 'Sponsor Contacts',
    description: 'Start each season with $500',
    cost: 25,
    purchased: false,
    effect: { type: 'startMoney', value: 500 },
  },
  {
    id: 'training_methods',
    name: 'Training Methods',
    description: '+300% boost duration',
    cost: 30,
    purchased: false,
    effect: { type: 'clickPower', value: 3.0 },
  },
  {
    id: 'business_acumen',
    name: 'Business Acumen',
    description: '+50% passive income from fans',
    cost: 40,
    purchased: false,
    effect: { type: 'incomeRate', value: 0.5 },
  },
  {
    id: 'legacy',
    name: 'Legacy',
    description: '+25% reputation gain from seasons',
    cost: 50,
    purchased: false,
    effect: { type: 'reputationGain', value: 0.25 },
  },
];

/**
 * Calculate season goal (wins needed) based on season number
 * Goal stays constant - speedup comes from reputation upgrades, not lower goals
 * This mirrors AD where Infinity goal is always the same, but you get faster
 */
export function getSeasonGoal(seasonNumber: number): number {
  return 10; // Always 10 wins - like AD's constant Infinity goal
}

export const INITIAL_GAME_STATE: GameState = {
  version: 3, // Bumped for simplified training
  club: null,
  resources: {
    money: 0,
    fans: 10, // Start with some fans (friends & family)
    reputation: 0,
  },
  training: {
    minutes: 1500, // Start halfway to first match
    boostUntil: 0,
  },
  morale: {
    level: 0,
    maxLevel: 100,
  },
  currentTactic: 'balanced',
  season: {
    number: 1,
    wins: 0,
    losses: 0,
    startTime: Date.now(),
    goalWins: 10, // First season goal
    completed: false,
  },
  reputationUpgrades: [...INITIAL_REPUTATION_UPGRADES],
  players: [],
  facilities: [],
  upgrades: [...INITIAL_UPGRADES],
  achievements: [...INITIAL_ACHIEVEMENTS],
  challenges: [...INITIAL_CHALLENGES],
  era: {
    current: 1,
    points: 0,
    totalPrestiges: 0,
  },
  stats: {
    totalMoneyEarned: 0,
    totalFansGained: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    timePlayed: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    lastClickTime: 0,
    clickTimestamps: [],
    sessionMatchesPlayed: 0,
    // Season stats
    totalSeasons: 0,
    fastestSeason: Infinity,
    totalReputationEarned: 0,
  },
  settings: {
    notationsStyle: 'standard',
    autoSaveInterval: 30,
    showTutorial: true,
  },
  dev: {
    enabled: true, // Enable by default during development
    speedMultiplier: 1,
  },
  lastTick: Date.now(),
  lastMatchTime: 0,
};
