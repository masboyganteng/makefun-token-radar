# Token Radar — 226 pre-token protocols ranked by implied value

Entry for make.fun `token-radar-01`: "Build the best token launch radar".

## What it is

A static dashboard plus a program that scores every pre-token protocol in a
sealed DefiLlama snapshot (14 Nov 2026) by an **implied value** — what a
token launch might be worth, if one ever happens. Implied value is a model,
not a price and not a promise that a token will launch.

## The model (radar-2)

The one thing the model learns from the data is the value of a dollar of TVL
in each category: for every category with at least three live-token protocols
in the snapshot, the base multiple is the **median market-cap / TVL** of those
live protocols. Categories with fewer live comps fall back to the global
median. Multiples are clamped to [0.05, 0.60].

```
implied = round( tvl_usd x multiple
                 x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4)
                 x min(1 + 0.02 x (chains - 1), 1.20) )
```

Age is `listed_at` to the snapshot date; unknown age uses 365 days. No
protocol name is special-cased in the model.

## The board

- **226 rows**: the whole 40-protocol watchlist (TVL ≥ $50M, no token on
  record) plus all 186 rankable pre-token protocols below the floor.
- Every row carries a 6-step farm plan (action + cost + time), derived from
  the protocol's own category, chains, TVL and age.
- **Bridged products are flagged, not hidden**: a bridge moves a token that
  already trades on another chain, so it is not a token waiting to launch.
- **Live-token protocols are set aside** with their market caps — they are the
  calibration comps, never mixed into the ranking.
- Language is careful throughout: "records no token" means the DefiLlama
  record carries no token for the protocol; the record is not proof that none
  exists. USDD is written honestly as a stablecoin that already circulates.

## Run it

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22+, standard library only, no network. The program writes
`board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json`
into the output directory. Two runs on the same input are byte-identical.

## Files

- `main.ts` — entrypoint
- `lib/model.ts` — the radar-2 model, farm plans, board builder
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored byte-for-byte
- `dashboard/` — the static page (index.html + app.css + app.js, no network)
- `screenshots/` — board, detail and filtered views of the dashboard
