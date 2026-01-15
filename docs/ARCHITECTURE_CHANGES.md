# Architecture Changes Report

**Date:** 2026-01-15
**Reviewer:** Claude Opus 4.5 (Frontend Architect)

---

## Summary

Architectural review and refactoring of Ice Dynasty codebase, focusing on code quality improvements, bug fixes, and component extraction following Single Responsibility Principle.

## Changes Made

### 1. CLAUDE.md - Documentation (DRY, Single Source of Truth)

**Principle:** Documentation should prevent future violations by establishing clear patterns.

Added three new sections:

| Section | Purpose |
|---------|---------|
| Component Guidelines | Max 300 lines, naming conventions, extraction rules |
| State Management | Single source of truth for calculations |
| Game Balance Constants | Centralized constant documentation |

### 2. winChance Bug Fix (DRY, Single Source of Truth)

**File:** `src/lib/stores/game-state.ts:639-640`

**Problem:** Win chance was calculated in two places with different logic:
- `formulas.ts:calculateWinChance()` - includes tactic, reputation, and challenge bonuses
- `game-state.ts:playMatch()` - inline calculation missing these bonuses

**Impact:** Achievement checking (e.g., "Clutch Player" for winning with <45% win chance) used incorrect win chance value.

**Fix:** Replaced 6-line inline calculation with single function call:
```typescript
// Before (incomplete calculation)
const winChanceFromUpgrades = state.upgrades
  .filter((u) => u.type === 'winChance')
  .reduce((total, u) => total + u.level * u.effect, 0);
const trainingBonus = Math.min(0.3, state.training.minutes / 10000);
const moraleBonus = Math.floor(state.morale.level / 20) * 0.01;
let winChance = Math.min(0.9, 0.4 + trainingBonus + winChanceFromUpgrades + moraleBonus);

// After (uses single source of truth)
let winChance = calculateWinChance(state);
```

**Principle Applied:** DRY (Don't Repeat Yourself) - one function for win chance calculation ensures consistency.

### 3. Dead Code Removal (YAGNI)

**File:** `src/lib/stores/game-state.ts`

**Removed:**
- `updateChallengeUnlocks()` function (lines 981-988)
- 3 call sites (lines 401, 536, 749)

**Reason:** Function was a no-op (`// No-op - all challenges are available from start`) but still being called in:
- `init()` - on game load
- `tick()` - every ~5 seconds
- `playMatch()` - after every match

**Principle Applied:** YAGNI (You Aren't Gonna Need It) - don't keep "backwards compatibility" code that does nothing.

### 4. Component Extraction (Single Responsibility)

**Problem:** `GameDashboard.svelte` was 4985 lines - a mega-component handling multiple tabs.

**Solution:** Extracted 4 tab components to `src/lib/components/tabs/`:

| Component | Lines | Responsibility |
|-----------|-------|----------------|
| `UpgradesTab.svelte` | 130 | Upgrade grid, locked upgrades, icon mappings |
| `AchievementsTab.svelte` | 130 | Bonus and cosmetic achievement display |
| `ChallengesTab.svelte` | 203 | Challenge grid, active challenge, progress tracking |
| `ClubTab.svelte` | 73 | Season stats, reputation upgrades |
| **Total extracted** | **536** | |

**Result:** `GameDashboard.svelte` reduced from 4985 → 4616 lines (369 lines removed, ~7% reduction).

**Principle Applied:** Single Responsibility Principle - each component now has one clear purpose.

---

## Remaining Technical Debt

### GameDashboard.svelte (4616 lines)

**Status:** Partially refactored.

**Remaining content:**
- Dashboard tab with pixel art rink (~500 lines template)
- Navigation and layout (~165 lines)
- Animation state and handlers (~200 lines)
- CSS for all components (~3400 lines)

**Future recommendation:** Extract `Rink.svelte` for the pixel art rink and its animations. The CSS could potentially be moved to a shared stylesheet if design system is established.

### Pre-existing Test Failures (5 tests)

Tests looking for "Team Morale" and "Boost Morale" elements fail - these UI elements were restructured in commits prior to this review.

---

## Verification

| Check | Result |
|-------|--------|
| TypeScript (`yarn check`) | ✅ 0 errors, 64 warnings (pre-existing) |
| Playwright Tests | ✅ 31/38 passed (same as baseline) |
| New Test Failures | ✅ None introduced |

---

## Architectural Principles Applied

| Principle | Application |
|-----------|-------------|
| **DRY** | Single `calculateWinChance()` function instead of duplicate calculation |
| **YAGNI** | Removed dead `updateChallengeUnlocks()` function |
| **Single Source of Truth** | All game math centralized in `formulas.ts` |
| **Single Responsibility** | Extracted 4 tab components from mega-component |

---

## Files Modified

1. `CLAUDE.md` - Added architecture guidelines
2. `src/lib/stores/game-state.ts` - Fixed bug, removed dead code (-15 lines)
3. `src/lib/components/GameDashboard.svelte` - Reduced from 4985 to 4616 lines

## Files Created

1. `docs/ARCHITECTURE_CHANGES.md` - This report
2. `src/lib/components/tabs/UpgradesTab.svelte` (130 lines)
3. `src/lib/components/tabs/AchievementsTab.svelte` (130 lines)
4. `src/lib/components/tabs/ChallengesTab.svelte` (203 lines)
5. `src/lib/components/tabs/ClubTab.svelte` (73 lines)
