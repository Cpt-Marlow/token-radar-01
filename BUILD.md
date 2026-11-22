# Build record

Measured, not estimated: this entry was built in one session on 2026-11-22, from the
`token-radar-01` starter to a passing preflight and a quality score of 100, without
submitting anything.

| | |
|---|---|
| start (UTC) | 2026-11-22T02:56:05Z |
| end (UTC) | 2026-11-22T03:13:52Z (the last write, this file) |
| wall clock | 17 min 47 s → 18 minutes (0.30 h) |

The clock is the session's own wall clock: it includes the agent's thinking, every tool
round-trip and the screenshot capture, and it is what a scheduler watching this machine
would have seen. It is **not** a human effort estimate. A person doing the same work —
reading the rules, choosing a model, writing the page, fixing the layout, capturing and
re-checking — would take substantially longer, so the radar's 8 h guess for `program/v1`
is not disproved by this run and this run cannot confirm it either. The one thing this
number is good for is the floor: an entry built by an agent that already knows the gate
takes under twenty minutes, so the marginal cost of a second entry is small.

## What the clock went on

Only the span above is clocked. Per-phase minutes were never measured, so none are
claimed here; what is measured is each artifact's last-write time (filesystem mtime,
UTC), which fixes the order of the work inside that span:

| last write (UTC) | artifact | what happened |
|---|---|---|
| 02:57:42 | entry scaffold | `new-entry.sh --competition token-radar-01`; starter, rules and snapshot read |
| 03:01:53 | `lib/model.ts` | starter's flat 0.25× model replaced with category multiples, a low-to-high range, a confidence grade and evidence lines |
| 03:06:15 | `README.md` | the model written up |
| 03:09:59 | `dashboard/index.html` | sortable/filterable board, row detail, live-token table, methodology |
| 03:10:38 | `dashboard/app.css` | styles, including the grade-chip and fixed-table-layout fixes found by looking at the render |
| 03:11:50 | `dashboard/app.js`, `lib/model.ts` | rendering that recomputes every row; final touch to the model |
| 03:12:01 – 03:12:08 | `screenshots/{1-board,2-detail,3-filtered}.png` | three real 1440x900 captures through the browser |
| 03:12:17 | `out/{board.json,data.js,dossier.json}` | two identical runs, so the dossier matches the shipped pages |

`preflight.mjs` and `quality.mjs` write no files, so they leave no timestamp: both ran
after that last build and before this file was written, and the layout repairs are only
visible in contents, not in times. Summing the gaps above would double-count thinking
and tool round-trips that belong to more than one artifact, so the 18 minutes at the top
is the number to use.

Total: 02:56:05 → 03:13:52 = 17 min 47 s, rounded to 18 minutes. The earlier reading of
17 minutes came from an end stamp taken a few seconds before this file itself was written.

## Results

- `preflight.mjs --out out --kit <kit>`: all seven documented rows pass — 3 dashboard
  files (33,746 bytes, no network addresses), 200 board rows, ranks 1..200 descending,
  40/40 watchlist coverage with 160 rows outside the floor, farm plans 124..181
  characters, three 1440x900 screenshots, and `dossier.json` byte-identical to
  `buildDossier` (711,993 bytes; 34,015 of 65,536 source bytes, so the whole dashboard
  source is shown to the judge).
- `quality.mjs --repo .`: 100/100 (screenshots, legibility, size, dossier, page, README,
  data density).
- Two consecutive runs wrote byte-identical output (`diff -r` clean).

## Second pass: review and simplification

A fresh-eyes pass on 2026-11-22, edits running 05:44:09Z to 05:49:48Z and the checks
finishing at 05:50Z, so the timestamps in the table above are the build pass and no longer
match the files. It cut what was not earning its place and left every number alone.

- **The model** now describes a category once: `CATEGORY_GROUPS` carries the multiple, the
  label and the group's one farm action, replacing a multiple table plus a parallel
  if-chain that re-listed the same match strings. Deleted `actionFor`, `chainOf`, `bySlug`
  and `finite` (each used once, or one line); deleted `stepText` and its 20..600 clamp,
  which could never fire because `boardIssue` refuses an out-of-range step rather than
  trimming it; `RadarRow` is now derived from `BoardRow` with `Omit`/`Pick` instead of 22
  hand-copied lines; the rank and order checks are one loop; the unreachable CEX multiple
  is gone (neither view ranks an exchange); `farmSteps` takes its capital instead of
  defaulting it; a docstring saying six steps now says seven.
- **The page** lost its dead `#category=` hash route (nothing wrote that fragment), a
  second copy of the hash clearing, a duplicate `impliedOf` call, a repeated state
  literal (`INITIAL`), three unused element ids and three dead CSS rules.
- **`data.js`** no longer ships six fields the page never reads (`mcap_usd`, `gecko_id`,
  `symbol`, `token_status`, the nested `model`, `farm_capital_usd`): 354,763 bytes down to
  347,136. `board.json` still carries them, because the gate's shape requires it.

What checks it: `board.json` is **byte-identical** to the pre-review build, so no rank,
value, label, evidence line or farm step moved; dashboard source 34,015 → 33,698 bytes;
`preflight.mjs` 7/7 PASS and `quality.mjs` 100/100 again on the rebuilt output. Loading the
rebuilt page showed 200 rows, 24 live rows, a detail view with its arithmetic agreeing with
`board.json`, and Close and backdrop-click both clearing the detail hash. That last one
caught a regression this pass introduced: clearing the hash only from the dialog's `close`
event, which this browser does not fire at all, so `closeDetail` clears it directly again.

No submission was made, no wallet was touched and no slot was spent: `.makefun/` is
empty (no `freshness.json`, no owner claim), there is no commit of the entry's own, and
`screenshots/`, `board.json` and `dossier.json` exist only on this machine, so nothing
here could be entered as it stands.
