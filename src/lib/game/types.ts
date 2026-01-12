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

export interface GameState {
  version: number;
  club: Club | null;
  resources: Resources;
  training: Training;
  players: Player[];
  facilities: Facility[];
  upgrades: Upgrade[];
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
  players: [],
  facilities: [],
  upgrades: [...INITIAL_UPGRADES],
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
