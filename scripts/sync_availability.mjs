#!/usr/bin/env node
// Sync othde.com availability from the oth-dashboard public feed (buildings_public.json).
//
//   node scripts/sync_availability.mjs            write mode: update data/buildings.json
//   node scripts/sync_availability.mjs --check    check mode: report drift, write nothing
//                                                 (exit 0 in-sync, 2 drift, 1 hard error)
//   node scripts/sync_availability.mjs --feed /path/to/buildings_public.json
//
// After a write-mode run: node build.mjs, review the diff, commit + push (or use the
// /oth-web-sync skill which wraps the whole flow). This script never touches git.
// Feed field allowlist is enforced in availability_lib.mjs — no financials, ever.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBuildings } from './availability_lib.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const feedArg = args.includes('--feed') ? args[args.indexOf('--feed') + 1] : null;

// Both machines use the otha/ umbrella layout: sibling repo oth-dashboard.
const FEED_CANDIDATES = [
  join(SITE, '..', 'oth-dashboard', 'buildings_public.json'),
];
const feedPath = feedArg || FEED_CANDIDATES.find((p) => existsSync(p));
if (!feedPath || !existsSync(feedPath)) {
  console.error('ERROR: buildings_public.json not found (tried: ' +
    (feedArg || FEED_CANDIDATES.join(', ')) + ')');
  process.exit(1);
}

const feed = JSON.parse(readFileSync(feedPath, 'utf8'));
const buildingsPath = join(SITE, 'data', 'buildings.json');
const overridesPath = join(SITE, 'data', 'availability_overrides.json');
const buildingsDoc = JSON.parse(readFileSync(buildingsPath, 'utf8'));
const overridesDoc = JSON.parse(readFileSync(overridesPath, 'utf8'));

// Staleness guard: a feed older than 7 days should not silently drive the public site.
const feedAgeDays = (Date.now() - Date.parse(feed.generated_at)) / 86400000;
if (!Number.isFinite(feedAgeDays) || feedAgeDays > 7) {
  console.error(`ERROR: feed generated_at=${feed.generated_at} is stale/unparseable — refusing`);
  process.exit(1);
}

const { buildings, changes, warnings, errors } = syncBuildings(buildingsDoc, feed, overridesDoc);

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);

if (errors.length) process.exit(1);

if (checkOnly) {
  if (changes.length) {
    console.log(`DRIFT website availability differs from feed+overrides (${changes.length}):`);
    for (const c of changes) console.log(`DRIFT ${c}`);
    process.exit(2);
  }
  console.log('OK website availability in sync with feed + overrides');
  process.exit(0);
}

writeFileSync(buildingsPath, JSON.stringify(buildings, null, 2) + '\n');
console.log(changes.length
  ? `Updated data/buildings.json (${changes.length} change(s)):\n  ` + changes.join('\n  ')
  : 'Updated data/buildings.json (availability metadata refreshed, no status/headline changes)');
console.log('Next: node build.mjs && git diff');
