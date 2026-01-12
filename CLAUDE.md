# Ice Dynasty - Incremental Hockey Game

## Project Overview
An incremental/idle web game where players build a hockey empire from a small amateur club to an international franchise. Inspired by games like Antimatter Dimensions.

## Quick Start
```bash
distrobox enter main-dev
yarn start
# Opens http://localhost:5173 automatically
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | SvelteKit 5 (with Svelte 5 runes) |
| Language | TypeScript |
| Package Manager | Yarn 4 (with node_modules linker) |
| Styling | Scoped CSS + CSS variables |
| Persistence | localStorage |
| Environment | Distrobox `main-dev` (Ubuntu 24.04) |

## File Structure
```
src/
├── lib/
│   ├── components/
│   │   ├── ClubCreator.svelte    # Initial club creation form
│   │   ├── GameDashboard.svelte  # Main game UI (training, matches, upgrades)
│   │   └── DevTools.svelte       # Dev panel (speed controls, reset)
│   ├── stores/
│   │   └── game-state.ts         # Main Svelte store + all game actions
│   ├── game/
│   │   ├── types.ts              # All TypeScript interfaces + INITIAL_GAME_STATE
│   │   ├── formulas.ts           # Game math (rates, costs, match simulation)
│   │   └── engine.ts             # requestAnimationFrame game loop
│   └── utils/
│       └── format.ts             # Number formatting (K, M, B, etc.)
├── routes/
│   ├── +page.svelte              # Main entry - shows ClubCreator or GameDashboard
│   └── +layout.svelte            # Global layout + CSS import
└── app.css                       # Global styles + CSS variables
```

## Key Files Explained

### `src/lib/game/types.ts`
- All TypeScript interfaces: `GameState`, `Club`, `Upgrade`, `MatchResult`, etc.
- `INITIAL_UPGRADES` array with 4 upgrades
- `INITIAL_GAME_STATE` - default state for new games
- `DevSettings` - controls dev mode speed multiplier

### `src/lib/game/formulas.ts`
- `calculateTrainingRate()` - passive income per second
- `calculateClickPower()` - training per click
- `calculateUpgradeCost()` - exponential cost scaling
- `simulateMatch()` - returns `MatchResult` with goals, fans, money
- `getMatchCooldown()` - time until next match (30s base, divided by speed)

### `src/lib/stores/game-state.ts`
- `gameState` - main writable store
- `gameState.init()` - loads from localStorage, calculates offline progress
- `gameState.save()` - saves to localStorage
- `gameState.clickTrain()` - handle training click
- `gameState.buyUpgrade(id)` - purchase upgrade
- `gameState.playMatch()` - simulate and apply match results
- `gameState.setDevSpeed(n)` - set speed multiplier
- `gameState.reset()` - clear all progress
- Derived stores: `hasClub`, `trainingRate`, `clickPower`, `totalMinutes`

### `src/lib/game/engine.ts`
- `startEngine()` - starts requestAnimationFrame loop + auto-save interval
- `stopEngine()` - cleanup
- Uses `browser` guard from `$app/environment` for SSR safety

## Current Game Mechanics

### Resources
| Resource | Source | Use |
|----------|--------|-----|
| Training Minutes | Passive + clicks | Buy upgrades |
| Fans | Win matches | Increase match income |
| Money | Play matches | (Future: buy facilities) |

### Upgrades (in `types.ts`)
| ID | Name | Effect | Base Cost | Scaling |
|----|------|--------|-----------|---------|
| better_skates | Better Skates | +1 click power | 10 | 1.5x |
| training_rink | Training Rink | +0.5/s passive | 50 | 1.4x |
| youth_program | Youth Program | +10% fan gain | 200 | 1.8x |
| merchandise | Merchandise Stand | +20% match money | 500 | 2.0x |

### Match System
- 30 second cooldown (reduced by dev speed)
- Base 40% win chance, +30% max from training
- Win: ~15 fans, 1.5x money
- Loss: ~5 fans, 1x money
- Money = 50 + (fans * 2) * multipliers

## Dev Tools
Located bottom-right when `dev.enabled = true` (default during dev):
- **Speed buttons**: 1x, 2x, 5x, 10x, 100x
- **Reset Game**: Clears localStorage and resets state

## Commands

```bash
# Development
distrobox enter main-dev
yarn start          # Dev server + open browser (logs to /tmp/vite.log)
yarn dev            # Dev server only
yarn check          # TypeScript type check
yarn build          # Production build

# VS Code
Ctrl+Shift+B        # Run "Start Dev Server" task

# Git
git status          # Check working tree status
git log --oneline   # View commit history
```

## Git Workflow

### Commit Policy
Commits are made **automatically** when:
- A feature from the roadmap is completed
- A major bug fix is implemented
- The user explicitly requests a commit

### Commit Message Format
Using **Conventional Commits** with Co-Authored-By:

```
<type>: <subject>

<body>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Commit Types
| Type | Usage |
|------|-------|
| `feat:` | New feature (e.g., "feat: add division system") |
| `fix:` | Bug fixes |
| `refactor:` | Code improvements without functionality changes |
| `style:` | Visual/CSS changes |
| `perf:` | Performance improvements |
| `docs:` | Documentation updates |
| `chore:` | Dependencies, configuration |

### Examples
```bash
# Feature commit
feat: add player roster management

- Add player stats (skill, stamina, morale)
- Implement roster screen with player cards
- Add player training mechanics

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

# Bug fix commit
fix: correct offline progress calculation

Training minutes were not accumulating correctly when game was closed.
Now properly calculates elapsed time * training rate.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

# Style commit
style: improve upgrade card spacing

Reduce padding and margins for more compact layout.
Upgrades now more visible without scrolling.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Important Notes

### Svelte 5 Runes
- Using `$state()`, `$derived()`, `$effect()` syntax
- **AVOID** naming variables `state` - conflicts with `$state()` rune
- Use `$gameState` to access store value in components

### SSR Safety
- Always guard browser APIs with `if (!browser) return`
- Import `browser` from `$app/environment`

### Debugging
- Dev server logs: `/tmp/vite.log`
- Always check logs when errors occur
- Use `yarn check` for TypeScript errors

### localStorage
- Key: `ice-dynasty-save`
- Auto-saves every 30 seconds
- Saves on: upgrade purchase, match played, page close
- Loads + calculates offline progress on init

## Planned Features (Roadmap)

### Era 1: Grassroots (Current)
- [x] Basic training (passive + click)
- [x] Simple matches
- [x] 4 starter upgrades
- [x] Visual click feedback (ripple effects + goal celebration)
- [ ] More upgrades

### Era 2: Local Club
- [ ] Division/league system
- [ ] Player roster
- [ ] Staff hiring
- [ ] Indoor arena upgrade

### Era 3: Elite Push
- [ ] Youth academy
- [ ] Sponsorship deals
- [ ] Media/PR system

### Era 4: International
- [ ] Multiple clubs/franchise
- [ ] International tournaments

### Prestige System
- [ ] "New Era" reset mechanic
- [ ] Reputation currency (persists)
- [ ] Permanent multipliers

## Decisions Log

### 2026-01-12
- **Theme**: Hockey empire building (unique in incremental genre)
- **Perspective**: Club management (not individual player)
- **Tech**: SvelteKit 5 + TypeScript + Svelte 5 runes
- **Persistence**: localStorage with auto-save
- **Container**: `main-dev` distrobox (Ubuntu 24.04)
- **Yarn**: Using node_modules linker (not PnP) for Vite compatibility
- **Dev logging**: `yarn dev` pipes to `/tmp/vite.log` via tee
