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

export interface Training {
  minutesPerSecond: number;
  totalMinutes: number;
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

export interface Challenge {
  id: string;
  name: string;
  description: string;
  restriction: string; // What's limited during the challenge
  goal: string; // What you need to do to complete it
  rewardDescription: string;
  rewardType: 'fanGain' | 'trainingRate' | 'baseMoney' | 'clickPower' | 'winChance';
  rewardValue: number;
  unlockCondition: {
    type: 'matchesPlayed' | 'fans' | 'money' | 'matchesWon';
    value: number;
  };
  // Completion requirements
  completionType: 'winMatches' | 'consecutiveWins' | 'winWithoutUpgrades';
  completionValue: number;
  // State
  unlocked: boolean;
  completed: boolean;
  active: boolean;
  // Progress tracking (while active)
  progress: number;
  startedAt?: number;
}

export interface GameState {
  version: number;
  club: Club | null;
  resources: Resources;
  training: Training;
  morale: Morale;
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
  type: 'training' | 'fans' | 'money' | 'click' | 'winChance' | 'clickMult' | 'baseMoney' | 'combo' | 'winBonus' | 'trainingMult';
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
  // Early game - always available
  {
    id: 'better_skates',
    name: 'Better Skates',
    description: '+1 training minutes per click',
    level: 0,
    maxLevel: 50,
    baseCost: 10,
    costMultiplier: 1.5,
    effect: 1,
    type: 'click',
  },
  {
    id: 'training_rink',
    name: 'Training Rink',
    description: '+0.5 training minutes per second',
    level: 0,
    maxLevel: 100,
    baseCost: 50,
    costMultiplier: 1.4,
    effect: 0.5,
    type: 'training',
  },
  {
    id: 'youth_program',
    name: 'Youth Program',
    description: '+10% fan gain from matches',
    level: 0,
    maxLevel: 25,
    baseCost: 200,
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
    baseCost: 500,
    costMultiplier: 2.0,
    effect: 0.2,
    type: 'money',
  },
  {
    id: 'hockey_sticks',
    name: 'Better Sticks',
    description: '+2 training minutes per click',
    level: 0,
    maxLevel: 40,
    baseCost: 25,
    costMultiplier: 1.6,
    effect: 2,
    type: 'click',
  },
  {
    id: 'volunteer_coaches',
    name: 'Volunteer Coaches',
    description: '+1 training minute per second',
    level: 0,
    maxLevel: 75,
    baseCost: 100,
    costMultiplier: 1.5,
    effect: 1,
    type: 'training',
  },
  {
    id: 'garage_rink',
    name: 'Garage Rink',
    description: '+2.5% win chance',
    level: 0,
    maxLevel: 20,
    baseCost: 150,
    costMultiplier: 1.7,
    effect: 0.025,
    type: 'winChance',
  },
  // Mid game - unlockable
  {
    id: 'equipment_locker',
    name: 'Equipment Locker',
    description: 'Multiplies click power by 1.1x',
    level: 0,
    maxLevel: 15,
    baseCost: 400,
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
    baseCost: 750,
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
    baseCost: 1000,
    costMultiplier: 1.9,
    effect: 0.05,
    type: 'combo',
    unlockCondition: { type: 'fans', value: 1000 },
  },
  {
    id: 'outdoor_flooding',
    name: 'Outdoor Flooding',
    description: '+3 training minutes per second',
    level: 0,
    maxLevel: 50,
    baseCost: 2500,
    costMultiplier: 1.6,
    effect: 3,
    type: 'training',
    unlockCondition: { type: 'matchesPlayed', value: 100 },
  },
  // Late game
  {
    id: 'community_support',
    name: 'Community Support',
    description: '+50% fan gain from matches',
    level: 0,
    maxLevel: 15,
    baseCost: 5000,
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
    baseCost: 10000,
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
    baseCost: 25000,
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
];

export const INITIAL_CHALLENGES: Challenge[] = [
  {
    id: 'rookie_mode',
    name: 'Rookie Mode',
    description: 'Play with a capped win chance to prove your fundamentals.',
    restriction: 'Win chance capped at 50%',
    goal: 'Win 10 matches',
    rewardDescription: '+10% base fan gain permanently',
    rewardType: 'fanGain',
    rewardValue: 0.1,
    unlockCondition: { type: 'matchesPlayed', value: 10 },
    completionType: 'winMatches',
    completionValue: 10,
    unlocked: false,
    completed: false,
    active: false,
    progress: 0,
  },
  {
    id: 'fatigue_test',
    name: 'Fatigue Test',
    description: 'Survive without passive training income.',
    restriction: 'No passive training (clicks only)',
    goal: 'Win 5 matches',
    rewardDescription: '+15% training rate permanently',
    rewardType: 'trainingRate',
    rewardValue: 0.15,
    unlockCondition: { type: 'fans', value: 500 },
    completionType: 'winMatches',
    completionValue: 5,
    unlocked: false,
    completed: false,
    active: false,
    progress: 0,
  },
  {
    id: 'budget_season',
    name: 'Budget Season',
    description: 'Play through a cash-strapped season.',
    restriction: 'No money earned from matches',
    goal: 'Win 10 matches',
    rewardDescription: '+30% base money permanently',
    rewardType: 'baseMoney',
    rewardValue: 0.3,
    unlockCondition: { type: 'money', value: 5000 },
    completionType: 'winMatches',
    completionValue: 10,
    unlocked: false,
    completed: false,
    active: false,
    progress: 0,
  },
  {
    id: 'marathon',
    name: 'Marathon',
    description: 'Prove your consistency with a winning streak.',
    restriction: 'Must win consecutively (resets on loss)',
    goal: 'Win 5 matches in a row',
    rewardDescription: '+20% click power permanently',
    rewardType: 'clickPower',
    rewardValue: 0.2,
    unlockCondition: { type: 'matchesWon', value: 25 },
    completionType: 'consecutiveWins',
    completionValue: 5,
    unlocked: false,
    completed: false,
    active: false,
    progress: 0,
  },
  {
    id: 'underdog',
    name: 'Underdog',
    description: 'Win without relying on click upgrades.',
    restriction: 'Click upgrades disabled',
    goal: 'Win 3 matches',
    rewardDescription: '+5% win chance permanently',
    rewardType: 'winChance',
    rewardValue: 0.05,
    unlockCondition: { type: 'matchesWon', value: 50 },
    completionType: 'winWithoutUpgrades',
    completionValue: 3,
    unlocked: false,
    completed: false,
    active: false,
    progress: 0,
  },
];

export const INITIAL_GAME_STATE: GameState = {
  version: 1,
  club: null,
  resources: {
    money: 0,
    fans: 10, // Start with some fans (friends & family)
    reputation: 0,
  },
  training: {
    minutesPerSecond: 1,
    totalMinutes: 0,
  },
  morale: {
    level: 0,
    maxLevel: 100,
  },
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
