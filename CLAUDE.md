# Ice Dynasty - Development Guide

## Project Overview
An incremental/idle web game where players build a hockey empire. See `ROADMAP.md` for game design and features.

## AI Model Roles
- **Opus** - Planering, design, research, arkitekturbeslut
- **Sonnet** - Implementation, kodning, buggfixar

Byt till Opus (`/model opus`) för planering, tillbaka till Sonnet (`/model sonnet`) för kodning.

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

## Component Guidelines

### Size Limits
- **Max 300 lines per component** - split into sub-components if larger
- Feature-specific logic stays in feature components

### Naming Conventions
| Pattern | Example | Use Case |
|---------|---------|----------|
| `<Feature>Tab.svelte` | `UpgradesTab.svelte` | Tab content components |
| `<Entity>Card.svelte` | `UpgradeCard.svelte` | List item cards |
| `<Feature>Modal.svelte` | `SeasonEndModal.svelte` | Feature-specific modals |

### Component Extraction Rules
Extract when:
- Component exceeds 300 lines
- Same UI pattern repeats 3+ times
- Tab/section can function independently

Use shared components:
- `Modal.svelte` for all dialogs
- `DevTools.svelte` for development controls

## State Management

### Store Organization
- **Single source of truth**: All game math in `formulas.ts`
- **Never duplicate calculations** - import from formulas.ts
- Use derived stores for computed values

### Store Pattern
```typescript
// Good: Use formulas.ts
const winChance = calculateWinChance(state);

// Bad: Duplicate calculation inline
const winChance = 0.4 + trainingBonus + upgradeBonus;
```

### Derived Stores
- Keep derivations simple (no loops over large arrays)
- Expensive computations should be memoized or moved to formulas.ts

## Game Balance Constants

All balance numbers centralized in `formulas.ts`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `BASE_TRAINING_RATE` | 1 | Training per second |
| `BASE_CLICK_POWER` | 30 | Training per click |
| `BASE_MATCH_COST` | 3000 | Training cost to play |
| `MORALE_BASE_COST` | 100 | First morale level cost |

When adding new balance values, add them to formulas.ts exports.

## Key Files

### `src/lib/game/types.ts`
- All TypeScript interfaces: `GameState`, `Club`, `Upgrade`, `MatchResult`, etc.
- `INITIAL_UPGRADES` array
- `INITIAL_GAME_STATE` - default state for new games

### `src/lib/game/formulas.ts`
- `calculateTrainingRate()` - passive income per second
- `calculateClickPower()` - training per click
- `calculateUpgradeCost()` - exponential cost scaling
- `simulateMatch()` - returns `MatchResult` with goals, fans, money
- `getMatchCooldown()` - time until next match

### `src/lib/stores/game-state.ts`
- `gameState` - main writable store
- Actions: `init()`, `save()`, `clickTrain()`, `buyUpgrade()`, `playMatch()`, `reset()`
- Derived stores: `hasClub`, `trainingRate`, `clickPower`, `totalMinutes`, `visibleUpgrades`, `lockedUpgrades`

### `src/lib/game/engine.ts`
- `startEngine()` - starts requestAnimationFrame loop + auto-save
- `stopEngine()` - cleanup
- Uses `browser` guard for SSR safety

## Commands

```bash
# Development
distrobox enter main-dev
yarn start          # Dev server + open browser (logs to /tmp/vite.log)
yarn dev            # Dev server only
yarn check          # TypeScript type check
yarn build          # Production build

# Testing
yarn test           # Run all Playwright tests
yarn test:ui        # Run tests with Playwright UI
yarn test:headed    # Run tests with visible browser

# VS Code
Ctrl+Shift+B        # Run "Start Dev Server" task
```

## Testing

### Playwright Tests
Tests live in `tests/` directory and cover:
- Club creation
- Training system (passive + click)
- Match system
- Upgrade system
- Morale system
- Challenge system
- Achievement system
- Dev tools

### Test Policy
**New features MUST include tests:**
- Add tests when implementing new features from ROADMAP.md
- Update existing tests when making changes that affect them
- Run `yarn test` before committing to verify nothing is broken

### Writing Tests
```typescript
// tests/game.spec.ts
test('should do something', async ({ page }) => {
  // Setup
  await page.getByRole('textbox', { name: /Club Name/i }).fill('Test');
  await page.getByRole('button', { name: 'Found Club' }).click();

  // Action
  await page.getByRole('button', { name: 'Play Match' }).click();

  // Assert
  await expect(page.locator('text=Victory')).toBeVisible();
});
```

## Roadmap Maintenance

När features implementeras eller planer ändras, uppdatera alltid `ROADMAP.md`:
- Markera färdiga features med ✅
- Lägg till nya design decisions med datum
- Håll "Design Decisions Log" uppdaterad
- Lägg till nya idéer i "Backlog" sektionen

---

## Git Workflow

### Commit Policy
Commits are made **automatically** when:
- A feature from ROADMAP.md is completed
- A major bug fix is implemented
- The user explicitly requests a commit

### Commit Format
Using **Conventional Commits**:

```
<type>: <subject>

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
```

| Type | Usage |
|------|-------|
| `feat:` | New feature |
| `fix:` | Bug fixes |
| `refactor:` | Code improvements |
| `style:` | Visual/CSS changes |
| `perf:` | Performance |
| `docs:` | Documentation |
| `chore:` | Dependencies, config |

## Important Notes

### Svelte 5 Runes
- Using `$state()`, `$derived()`, `$effect()` syntax
- **AVOID** naming variables `state` - conflicts with `$state()` rune
- Use `$gameState` to access store value in components

### SSR Safety
- Always guard browser APIs with `if (!browser) return`
- Import `browser` from `$app/environment`

### localStorage
- Key: `ice-dynasty-save`
- Auto-saves every 30 seconds
- Saves on: upgrade purchase, match played, page close
- Loads + calculates offline progress on init

### Debugging
- Dev server logs: `/tmp/vite.log`
- Use `yarn check` for TypeScript errors

## Dev Tools
Located bottom-right when `dev.enabled = true`:
- **Speed buttons**: 1x, 2x, 5x, 10x, 100x
- **Reset Game**: Clears localStorage and resets state

## Design Aesthetic
- **Theme:** Vintage arena scoreboard
- **Fonts:** Bebas Neue (headers), Orbitron (LED numbers), Barlow (body)
- **Default colors:** Red (#dc2626) and white (#ffffff)

## Context & Token Tips

### Viktigt att veta
- `CLAUDE.md` läses automatiskt varje session
- `ROADMAP.md` läses INTE automatiskt - säg "läs ROADMAP.md" vid behov
- Todo-listan överlever komprimering

### Spara tokens
- **Haiku för enkla saker**: `/model haiku` för simpla frågor, filsökningar
- **Grep/Glob istället för Read**: Sök specifikt istället för att läsa hela filer
- **Task agents för utforskning**: De har egen context, belastar inte huvudkonversationen
- **Korta svar**: Be om koncisa svar om du inte behöver detaljer
- **Undvik omläsning**: Läs inte samma fil flera gånger i rad

## Custom Commands

### `/playtest` - Speltesta med Playwright

Kör ett automatiskt speltest som verifierar alla grundläggande mekaniker:

```
Användning: "kör /playtest" eller "speltesta spelet"
```

**Vad testas:**
1. Club creation
2. Training (passiv + klick)
3. Match unlock & play
4. Upgrades köp
5. Morale boost
6. Season progress
7. Achievements

**Implementation:**
Använd Playwright `browser_run_code` med följande script:

```javascript
async (page) => {
  const results = { clubCreation: false, training: false, matchPlay: false,
                    upgrades: false, morale: false, seasonProgress: false, errors: [] };
  try {
    // 1. Reset om spel finns, annars skapa klubb
    const resetBtn = page.getByRole('button', { name: 'Reset' });
    if (await resetBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await resetBtn.click();
      await page.locator('text=OK').click().catch(() => {});
    }

    // 2. Skapa klubb
    await page.getByRole('textbox', { name: 'Club Name' }).fill('Playtest FC');
    await page.getByRole('button', { name: 'Found Club' }).click();
    await page.waitForTimeout(500);
    results.clubCreation = true;

    // 3. Sätt 100x speed
    await page.getByRole('button', { name: '100x' }).click();
    await page.waitForTimeout(2000);
    results.training = true;

    // 4. Spela matcher
    for (let i = 0; i < 15; i++) {
      const playBtn = page.getByRole('button', { name: 'Play Match' });
      if (await playBtn.isEnabled()) {
        await playBtn.click();
        await page.waitForTimeout(400);
        results.matchPlay = true;
      }
    }

    // 5. Köp upgrade
    await page.getByRole('button', { name: 'Upgrades' }).click();
    await page.getByRole('button', { name: /Training Rink/ }).click();
    results.upgrades = true;

    // 6. Boost morale
    await page.getByRole('button', { name: 'Dashboard' }).click();
    const moraleBtn = page.getByRole('button', { name: /Boost Morale/ });
    if (await moraleBtn.isEnabled()) { await moraleBtn.click(); results.morale = true; }

    // 7. Kolla progress
    const seasonText = await page.locator('.season-progress-text').textContent();
    results.seasonProgress = seasonText?.includes('/10') || false;

  } catch (e) { results.errors.push(e.message); }
  return results;
}
```

**Manuell speltest:** Öppna http://localhost:5173 med Playwright och interagera stegvis:
1. `browser_navigate` till localhost:5173
2. `browser_snapshot` för att se state
3. `browser_click` för att klicka element
4. `browser_run_code` för komplexa sekvenser

## Challenge System Balance (AD-style)

### Challenge Level System
- 8 challenges × 5 levels = 40 total levels
- Each level has increasing difficulty and stacking rewards
- Difficulty scaling: `[1.0, 1.5, 2.0, 3.0, 5.0]`
- Reward scaling: `[1.0, 1.3, 1.5, 1.7, 2.0]` (total 7.5x base at L5)

### Optimal Challenge Order
Based on reward synergies:

| Order | Challenge | Reward | Strategy |
|-------|-----------|--------|----------|
| 1 | **Rookie Season** | +win chance | Makes all others easier |
| 2 | **Intensive Training** | +training rate | Speeds up passive gains |
| 3 | **All-Out Attack** | +money gain | Enables more upgrades |
| 4 | **Defensive Grind** | +fan gain | Build fanbase |
| 5 | **Budget Season** | +fan gain | No money restriction |
| 6 | **No Upgrades** | +all stats | Multiplicative bonus |
| 7 | **Speed Run** | +reputation | Timed - needs practice |
| 8 | **Marathon** | +all stats | Very long (50-200 wins) |

### Balance Test Results (10000x speed)
- Match unlock: ~27ms (100 training minutes)
- Challenge L1 completion: ~1-2 seconds per challenge (10 wins each)
- All 8 challenges L1: ~20 seconds total real-time
- Marathon L5 (200 wins): Significantly longer

### Level Difficulty Examples
| Challenge | L1 | L2 | L3 | L4 | L5 |
|-----------|-----|-----|-----|-----|-----|
| Rookie Season | 50% cap | 45% | 40% | 35% | 30% |
| Speed Run | 180s | 120s | 90s | 60s | 30s |
| Marathon | 50 wins | 75 | 100 | 150 | 200 |
| Intensive Training | 5% decay | 7% | 10% | 15% | 25% |
