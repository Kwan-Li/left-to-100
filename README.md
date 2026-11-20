# Skip Budget: GTA 6 100% completion calculator

GTA 6 hides its 100% checklist until you finish the story, and most requirements only need part of the total. Skip Budget tells you what's left, how much you can skip, and which card sets to finish.

- **Per-requirement quotas.** Enter the counts from your Progress menus (or leave them blank) and see what's left and how many you can skip for each of the 35 requirements.
- **Card set planner.** You need 15 of 18 sets. Enter what you have and get the 15 that need the fewest extra cards. If a card might be lost, you get a best/worst range instead of a made-up exact number.
- **Spoiler-safe missables.** Pick your chapter and see only what's lost at the end of it.
- **Open data.** One CC0 JSON file. Every fact lists its sources and is marked `verified`, `reported` or `disputed`.
- No account, no ads, works offline, share a link to move progress between devices.

## Develop

```sh
pnpm install
pnpm dev        # local site
pnpm test       # unit, property and data checks
pnpm build      # static site in dist/
```

Set `SITE_URL` and `BASE_PATH` when building for a different host or a custom domain (`BASE_PATH=/` for a root domain).

## Data

The dataset lives in [`src/data/gta6.json`](src/data/gta6.json) and is validated against [`src/data/schema.ts`](src/data/schema.ts) at build time and in CI.

Rules for every fact:

- **verified** needs two or more independent publishers that did their own work.
- **reported** means one original source, even if other sites repeat it.
- **disputed** means independent sources conflict; the `note` says how.
- Write explanations in your own words. Never paste guide text. No game assets, no leaked material, no plot spoilers (chapters and locations are fine).

Found a mistake? [Open a correction](../../issues/new?template=correction.yml) with a source.

## License

Code: [MIT](LICENSE). Data: [CC0](LICENSE-DATA).

Unofficial fan project. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Grand Theft Auto is a trademark of Take-Two Interactive.
