# leetcode-patterns

React 19 + Vite SPA that organizes LeetCode problems into algorithmic patterns. Deployed to GitHub Pages with optional Supabase sync for cross-device progress.

- Dev: `npm run dev`
- Build: `npm run build`
- Unit tests: `npm test` (Vitest)
- Integration: `npm run test:integration`
- E2E: `npm run e2e` (Playwright)
- Lint: `npm run lint`

## Data files

All data lives under [src/data/](src/data/).

- **[src/data/patternMeta.json](src/data/patternMeta.json)** — `[[slug, displayName, hexColor], ...]`. 17 categories (incl. `favorites`). Defines category tab order/colors.
- **[src/data/patterns.json](src/data/patterns.json)** — the organizational hierarchy. Shape:
  ```jsonc
  { "<category-slug>": {
      "name": "...",
      "buckets": [
        { "name": "...", "tier": "Must Do|High|Standard|Bonus|Personal",
          "subs": [
            { "idea": "...", "insight": "...",
              "rep": [<id>, ...],     // canonical problem(s)
              "var": [<id>, ...],     // genuinely-different framings
              "similar": [<id>, ...], // same skeleton, different wrapper
              "template": "Python skeleton string" }
          ]}
      ]}}
  ```
  Currently: 176 buckets, 828 sub-buckets. Every sub has `rep`, `template`, `insight` filled; `var`/`similar` coverage varies.
- **[src/data/problems.json](src/data/problems.json)** — `{ "<id>": { name, diff (E/M/H), slug, likes, dislikes, acRate, tags[], isPaidOnly, similar[] } }`. 3559 problems, 70 distinct LeetCode topic tags (`heap-priority-queue`, `sliding-window`, `monotonic-stack`, `prefix-sum`, `union-find`, …).
- **[src/data/companies.json](src/data/companies.json)**, **[src/data/googleProblems.json](src/data/googleProblems.json)**, **[src/data/extracted.css](src/data/extracted.css)**, **[src/data/solutionsIndex.js](src/data/solutionsIndex.js)** — supporting data; not edited by pattern audits.
- **[solutions/](solutions/)** — optional per-problem Python solutions at `solutions/<id>.py`. Vite is configured to skip these as JS modules.

## Component → data wiring

- [src/components/PatternTabs.jsx](src/components/PatternTabs.jsx) renders categories from `patternMeta.json`.
- [src/components/Bucket.jsx](src/components/Bucket.jsx) renders each bucket (header, tier badge, progress bar).
- [src/components/SubIdea.jsx](src/components/SubIdea.jsx) renders each sub-bucket: `idea`, `insight`, `rep` (always visible), `var` (collapsible "+ N variations"), `similar` (collapsible "+ N similar"), and the `template` button.
- [src/components/ProblemRow.jsx](src/components/ProblemRow.jsx) renders an individual problem row (link to LeetCode, difficulty, likes/acRate).

## Organizational rules (the philosophy)

These rules govern how problems are placed in `patterns.json`. Preserve them exactly when adding/moving problems.

- **RULE 1** — Same sub-bucket = same code skeleton. All problems in a sub differ from `template` by only a few lines.
- **RULE 2** — Same bucket = same meta-idea. Sub-buckets within a bucket share the same algorithmic thinking.
- **REP** — purest, most-asked version of the idea. Usually 1 problem (sometimes 2 if there's a canonical pair). Done first.
- **VAR** — same idea, **genuinely different framing**, second-most-famous. Tests recognition. NOT a near-duplicate of REP.
- **`similar`** (= "PRAC") — same skeleton, different wrapper. Ordered by **decreasing variation**: Hard → Medium → Easy. Soft target ≤ 8–10; **hard cap: total problems in a sub-bucket (rep + var + similar) MUST be ≤ 15**. If a sub exceeds 15, split it into idea-level sub-buckets — no exceptions for substantive subs. Cross-Reference subs (in `bucket[N] / Cross-Reference / X as Helper`) follow the same hard cap; if a cross-ref grows past 15, split by *target category* (e.g. "Cross-Ref: Stack / See Stack Pattern" vs "Cross-Ref: Greedy / See Greedy Pattern").
- **Inclusion test** — include a problem in a pattern if (a) the pattern is a complete solution approach an interviewer would accept, OR (b) the inner technique is the hard insight that separates AC from TLE.
- **Exclusion test** — exclude if the pattern is just a trivial inner tool (e.g. `sort()` or `bisect_left` as a one-liner inside DP → NOT a Binary Search problem).
- **Multi-placement is OK (and often desirable)** — a non-trivial problem may legitimately appear in **multiple** sub-buckets across categories. Use it whenever a problem has genuinely distinct, accepted solutions worth teaching. Examples of "distinct enough":
  - **General + specific**: a general technique solves the whole family (e.g. max-heap of char freqs handles all constrained-char-placement) AND the specific instance has a better specialized solution (e.g. [984] has only 2 chars → O(n) greedy alternation). Place in both.
  - **Time-optimal + space-optimal**: one solution wins on time, the other on space (e.g. heap O(n log k) vs sort O(n log n) in-place; DP O(n²)-time/O(n)-space vs greedy O(n)-time/O(1)-space).
  - **Different algorithmic approaches all accepted**: LeetCode accepts multiple O-classes, and each teaches a distinct technique. Example: a problem accepted with O(n log n) heap AND O(n) bucket-sort AND O(n) two-pointer — all three are worth placing if all three are *the canonical solution somewhere in the curriculum*.
  - **Skip when the second placement is a trivial tweak** of the first (same skeleton, no new insight). The bar is "does this teach something different?", not "is there another solution at all?".
  - **Cross-Reference vs multi-placement**: the Cross-Reference holding bucket (e.g. `heap.buckets[10]`) is for the *different* case where the current category's technique is **not actually a valid solution** for the problem (tag confusion). Multi-placement is for problems where each placement is a *legitimate complete solution* teaching a distinct technique.
- **Coverage claim** — doing all REPs (~828) should cover ~95% of problems.

## How to add or move a problem

1. Look up `tags`, `diff`, and existing `similar` for the candidate id in [src/data/problems.json](src/data/problems.json).
2. Find the right sub-bucket by **skeleton match** to the sub's `template` (tags help narrow but don't decide).
3. Place into `rep` / `var` / `similar` per the rules above.
4. Keep `similar` ordered Hard → Medium → Easy and length ≤ 10. If full, propose a sub split.
5. Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('src/data/patterns.json'))"`.
6. Smoke test: `npm run dev`, click the affected category tab, expand the sub.

## Don't

- Don't audit or restructure the `favorites` category — it's a hand-picked UX feature, not part of the rule system.
- Don't change the `patterns.json` schema or component structure without an explicit discussion.
- Don't bulk-move problems algorithmically. Every placement is a deliberate human-approved decision.
- Don't add new top-level categories or buckets without a clear RULE 2 violation justifying it.

## Pointers

- Active audit plan: [~/.claude/plans/let-s-try-to-understand-merry-bunny.md](/Users/devkinandanmalav/.claude/plans/let-s-try-to-understand-merry-bunny.md) — the category-by-category, bucket-at-a-time review is in progress (started with `heap`).
- Recent commits worth knowing: `4ee58ad` added the `favorites` tab, `0925d43` enriched problem rows with likes/dislikes/acRate and added the `solutions/` Python folder.
