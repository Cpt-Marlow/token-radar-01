# Pre-token radar

An entry for the [make.fun](https://make.fun) bounty `token-radar-01`: a dashboard that ranks
protocols which record no token by what a token could be worth if the protocol's record stayed as
it is, and shows a reader how to farm each one.

`main.ts` reads the sealed snapshot at `/input/snapshot.json`, scores every pre-token protocol with
the model in `lib/model.ts`, writes `board.json` and `data.js`, copies `dashboard/` and
`screenshots/`, and writes `dossier.json` with the vendored `buildDossier`.

## The model (radar-2)

```
base       = tvl_usd x category multiple
growth     = clamp(change_7d, -50%, +100%)          growth factor = 1 + growth x 0.40
maturity   = 0.70 + min(age_days, 1095) / 1095 x 0.30
implied    = round(base x growth factor x maturity)
low, high  = the same arithmetic with the weekly change ten points weaker and stronger
```

The **category multiple** is what a dollar of TVL has been worth in a franchise of that kind:
lending 0.42, DEX 0.36, derivatives 0.34, RWA 0.30, prediction 0.28, stablecoin 0.22, insurance 0.20,
bridge 0.18, staking 0.16, anything else 0.25. These are assumptions and are stated on the page, in
`CATEGORY_GROUPS` — the one table that also names each group's farm action, so a category is
described exactly once — and a reader can disagree with them in one place. No protocol name is ever
special-cased: the same function scores all 758 records.

**Age** is `as_of - listed_at`: the time DefiLlama has tracked the protocol with no token recorded.
A protocol that has run longer without issuing carries more of the record the value rests on, which
is what `maturity` prices. A missing listing date is assumed to be 540 days, the median of the
snapshot's dated records, and the row says so.

**Confidence** is the row's own reliability, not its size: A needs a TVL above a billion, a reported
weekly change and a known listing date; B needs two of the three; C is the rest, or a value the two
figures cannot carry.

**The board** covers every watchlist slug (the floor, never a ceiling) and adds the 160 largest
pre-token protocols below the floor, because a radar that only shows the floor is an index. Protocols
whose token already trades are never ranked here; the page shows those separately, with the market's
own cap and the cap-to-TVL ratio.

**The range** matters more than the point estimate: a row whose low-to-high span is wide is one week
of data away from moving, and the bar behind every value in the table is that span.

## The page

`dashboard/index.html`, `app.css` and `app.js`: no framework, no network, no fonts to fetch. The board
is sortable and filterable by search, category, chain and watchlist membership; clicking a row opens a
detail view with the model's arithmetic, the evidence lines the row rests on, and the farm plan with
each step's cost and time. The page recomputes every implied value from its inputs and reports at the
bottom how many of the 200 rows agree with `board.json` — the data and the code are one arithmetic,
checked in front of the reader.

## Build

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

The program runs twice in the grader and both runs must write the same bytes; nothing here reads the
clock, the network or anything but the snapshot.

## Check before submitting

```bash
node <factory>/preflight.mjs --out out --kit <kit>   # the seven documented gate rows
node <factory>/quality.mjs   --repo .                # the advisory score the gate does not make
```

`preflight` is a mirror of the documented gate, not the sealed scorer. The screenshots in
`screenshots/` are captures of the real page at 1440x900, taken after the build and before the final
rebuild, so `dossier.json` matches them byte for byte.
