# 🟣 Jellyzap — Viral Web Games Portal

Free online games for kids & teens — Snake, Tetris, 2048, Word, Wheel of Fortune,
Memory, Flappy, Breakout, Match-3 and a top‑down kart battle. Built for **speed,
SEO/GEO, multilingual reach (EN/TR/DE), and ad monetization**.

> **Note on the repository.** This project was scaffolded inside the `aikarakutu`
> repo (in this isolated `jellyzap/` folder) because the current session could not
> create a standalone GitHub repo (`403 Resource not accessible by integration`).
> It is fully self‑contained — see **[Moving to its own repo](#moving-to-its-own-repo)**.

## Tech stack

- **Astro 5** (static output) — zero‑JS by default → great Core Web Vitals & SEO.
- **Vanilla TypeScript + HTML5 Canvas** games, each an isolated workspace package.
- **`@jellyzap/game-sdk`** — the shared contract (loop, input, audio, score, RNG, ad/analytics hooks) every game implements.
- **Tailwind CSS v4**, **Web Audio** procedural SFX (no audio assets).
- **Vitest** (game logic) + **Playwright** (E2E) + **GitHub Actions** CI.

## Monorepo layout

```
jellyzap/
├─ packages/game-sdk/      # the Game SDK (createGameHost + Game contract)
├─ packages/games/*/       # one package per game (snake, tetris, 2048, …)
└─ apps/web/               # the Astro site (pages, SEO, i18n, ads, PWA)
```

## Commands

```bash
pnpm install          # install everything
pnpm dev              # run the site locally (http://localhost:4321)
pnpm build            # static production build → apps/web/dist
pnpm preview          # serve the built site
pnpm test             # run all Vitest unit tests
pnpm coverage         # unit tests with coverage
pnpm typecheck        # type-check every package
pnpm check:determinism# ensure games use ctx.rng() and never own the loop
pnpm e2e              # Playwright end-to-end tests (run pnpm --filter @jellyzap/web e2e:install first)
pnpm check            # determinism + typecheck + unit + build (the full gate)
```

## Monetization & analytics (placeholders)

Real IDs live in **`apps/web/src/lib/ads.ts`** and **`apps/web/src/lib/analytics.ts`**
and can be supplied via env vars (see `apps/web/.env.example`):

- `PUBLIC_AD_PUBLISHER_ID`, `PUBLIC_AD_SLOT_*` — AdSense publisher + slot IDs.
- `PUBLIC_GA4_ID` — Google Analytics 4 measurement ID.

Until set, ad slots render reserved‑size placeholders and analytics logs to the
console. **No ad/analytics script loads before cookie consent** (GDPR/Consent Mode
v2), and the audience is treated as child‑directed (COPPA → non‑personalized ads).

## Moving to its own repo

The `jellyzap/` folder has no dependency on the parent repo:

```bash
# from the parent repo root
git subtree split --prefix=jellyzap -b jellyzap-only
# create an empty repo on GitHub (e.g. drpiha/jellyzap), then:
cd /tmp && git clone <parent-url> jz && cd jz
git subtree split --prefix=jellyzap -b jellyzap-only
git push <new-repo-url> jellyzap-only:main
```

Or simply copy the `jellyzap/` directory into a fresh repo and `git init`.

## License

Proprietary — © Jellyzap. All rights reserved.
