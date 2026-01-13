# Ice Dynasty

An incremental/idle web game where you build a hockey empire from a small amateur club to an international franchise. Inspired by Antimatter Dimensions.

**Tech Stack:** SvelteKit 5 + TypeScript + Svelte 5 Runes

## Quick Start

```bash
# Enter development environment
distrobox enter main-dev

# Install dependencies
yarn install

# Start dev server (opens browser automatically)
yarn start
```

## Development Commands

| Command | Description |
|---------|-------------|
| `yarn start` | Dev server + auto-open browser |
| `yarn dev` | Dev server only |
| `yarn check` | TypeScript type check |
| `yarn build` | Production build |
| `yarn test` | Run Playwright tests |
| `yarn test:ui` | Tests with Playwright UI |
| `yarn test:headed` | Tests with visible browser |

## Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI development guide - project structure, conventions, file locations, coding patterns. Read by Claude automatically each session. |
| `ROADMAP.md` | Game design document - features, eras, upgrades, achievements, challenges. The source of truth for what to build. |

## Project Structure

```
src/
├── lib/
│   ├── components/    # Svelte components
│   ├── stores/        # Svelte stores (game state)
│   ├── game/          # Game logic (types, formulas, engine)
│   └── utils/         # Helpers (formatting)
├── routes/            # SvelteKit pages
└── app.css            # Global styles
tests/                 # Playwright tests
```

## Deployment

Hosted on GitHub Pages. Auto-deploys on push to `main`.

**First-time setup:**
1. Go to repo Settings → Pages
2. Set Source to "GitHub Actions"
3. Push to main

**URL:** `https://<username>.github.io/web-game`

## Contributing

1. Read `ROADMAP.md` for feature specs
2. Check `CLAUDE.md` for coding conventions
3. Write tests for new features
4. Run `yarn test` before committing
