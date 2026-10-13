# Tests

Use Node 22. Dependencies must be installed in both packages:

```sh
npm ci
npm ci --prefix api
npm run test:all
```

`npm test` runs frontend domain tests; `npm run test:api` compiles the API with
TypeScript and runs its tests. Tests use Node's built-in test runner, with no
extra framework, AWS credentials, Telegram token, or running server required.

To run a focused file:

```sh
node --experimental-strip-types --test test/subset-sort.test.mjs
# Compile API sources before running individual API tests:
cd api
npx tsc
node --test test/telegram.test.mjs
```

## What we protect

- Set ordering: subset blocks, pauses, trailing pool, instrument-change costs,
  previous-set anchors, exact optimum on small sets, and the large-set heuristic.
- Backlog selection: musician AND, scoped instrument OR, search/category
  combinations, and the 24-hour add-to-setlist window.
- Money: integer cents, cash vs transfers, unpaid debts, cumulative balances,
  and donations from the latest started show in the report.
- Learning progress: participating musicians, guests, missing progress, and
  selected-musician readiness.
- Collaboration: hidden/paused polling, cleanup, recovery after a failed poll,
  heartbeat expiration, multiple tabs, and paginated presence queries.
- Access and persistence: Telegram signatures/expiration, reader/writer/admin
  boundaries, private-note isolation, catalog snapshots, and idempotent adds.
- Existing regression cases for lyrics, rehearsals, and people migration.

Pure domain tests import the actual functions. API handler tests replace only
the DynamoDB client boundary with local responses; they also run the real
routing/authentication code where relevant. They do not validate real DynamoDB
behavior, browser gestures/rendering, or the deployed application.

CI runs both suites on pushes and pull requests, including test-only changes.
Each deployment workflow also runs its corresponding tests before publishing.

Prefer a concrete regression scenario over a coverage target. Test outcomes and
invariants rather than CSS, private functions, or an optimizer's exact tie order.
Keep production changes small: the backlog predicates were moved from the
component into a pure module; no component mounting framework was introduced.
