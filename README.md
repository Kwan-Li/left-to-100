# LeftTo100 — GTA 6 100% completion calculator

GTA 6 hides its in-game 100% Completion checklist until you finish the main story, and most requirements only ask for part of the total. **LeftTo100** shows all 35 requirements up front so you can see what's left, how many you can skip, and which 15 card sets take the fewest extra cards.

- **Per-requirement quotas.** Enter counts from your Progress menus—or leave them blank (blank means unknown, never zero)—to see what's left and how many you can skip across all 35 requirements. No made-up overall percentage.
- **Card set planner.** You need 15 of 18 collectible card sets (minimum 372 of 480 cards). Enter what you've logged and get the 15 sets that need the fewest extra cards. If a card is reported lost, you get a best/worst range instead of a guessed exact number.
- **Spoiler-safe missables.** Pick your current chapter to see only what can be lost at the end of it—no plot details, no mission names, and nothing from later chapters.
- **Open, sourced data.** One public CC0 JSON file. Every fact links to its sources and is marked `verified`, `reported`, or `disputed`.
- **Private & offline-ready.** Free, no account, no ads, works offline, and moves progress between devices with a shareable link.

## Develop

```sh
pnpm install
pnpm dev        # run local dev server
pnpm test       # unit, property, and dataset checks
pnpm build      # build static site to dist/
```

Set `SITE_URL` and `BASE_PATH` when building for another host or a custom domain (`BASE_PATH=/` for a root domain). Re-run `node scripts/make-images.mjs` after changing OG image or icon copy.

## Data

The dataset lives in [`src/data/gta6.json`](src/data/gta6.json) and is validated against [`src/data/schema.ts`](src/data/schema.ts) at build time and in CI.

Rules for every fact:

- **verified:** Two or more independent publishers doing their own work agree.
- **reported:** One original source so far, even if other sites repeat it.
- **disputed:** Independent sources conflict; the `note` field explains how.
- Write every explanation in your own words. Never paste guide text. No game assets, no leaked material, and no plot spoilers (chapters and locations are fine).

We don't have game access, so sourced player reports keep this accurate. Spotted a mistake? [Open a correction](../../issues/new?template=correction.yml) with at least one source link.

## License

Code: [MIT](LICENSE). Data: [CC0](LICENSE-DATA).

Unofficial fan project. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Grand Theft Auto and Rockstar Games are trademarks of Take-Two Interactive.
