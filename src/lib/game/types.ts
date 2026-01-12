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
  type: 'training' | 'fans' | 'money' | 'click';
}

export interface MatchResult {
  won: boolean;
  goalsFor: number;
  goalsAgainst: number;
  fansGained: number;
  moneyEarned: number;
}

export const INITIAL_UPGRADES: Upgrade[] = [
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
