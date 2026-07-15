// node --test scripts/test_availability.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlineFromComputed, resolveAvailability, syncBuildings, NAME_MAP } from './availability_lib.mjs';

test('headline rounds to nearest 500 with About prefix', () => {
  assert.equal(headlineFromComputed(15030), 'About 15,000 SF available');
  assert.equal(headlineFromComputed(3000), '3,000 SF available');
  assert.equal(headlineFromComputed(7044), 'About 7,000 SF available');
  assert.equal(headlineFromComputed(2400), 'About 2,500 SF available');
});

test('computed path publishes availability', () => {
  const r = resolveAvailability({
    slug: 'x', feedRow: { available_sf: 15030 }, override: null, asOf: '2026-07-15', driftThresholdSf: 1500,
  });
  assert.equal(r.status, 'available');
  assert.equal(r.headline, 'About 15,000 SF available');
  assert.equal(r.source, 'computed');
  assert.equal(r.errors.length, 0);
});

test('override within threshold wins, keeps its headline', () => {
  const r = resolveAvailability({
    slug: 'x', feedRow: { available_sf: 7044 },
    override: { published_sf: 7864, headline: '7,864 SF available', source: 'CBRE', as_of: '2026-07-15' },
    asOf: '2026-07-15', driftThresholdSf: 1500,
  });
  assert.equal(r.headline, '7,864 SF available');
  assert.equal(r.source, 'override: CBRE');
  assert.equal(r.errors.length, 0);
});

test('stale override beyond threshold errors', () => {
  const r = resolveAvailability({
    slug: 'x', feedRow: { available_sf: 2000 },
    override: { published_sf: 8000, source: 'CBRE', as_of: '2026-01-01' },
    asOf: '2026-07-15', driftThresholdSf: 1500,
  });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /drifts/);
});

test('suppress publishes leased and warns when vacancy exists', () => {
  const r = resolveAvailability({
    slug: 'x', feedRow: { available_sf: 2400 },
    override: { suppress: true, reason: 'not marketed' },
    asOf: '2026-07-15', driftThresholdSf: 1500,
  });
  assert.equal(r.status, 'leased');
  assert.equal(r.headline, '');
  assert.equal(r.warnings.length, 1);
});

test('missing feed row leaves building unchanged with a warning', () => {
  const r = resolveAvailability({ slug: 'x', feedRow: null, override: null, asOf: null, driftThresholdSf: 1500 });
  assert.equal(r.unchanged, true);
  assert.equal(r.warnings.length, 1);
});

test('syncBuildings end-to-end: change list, allowlist, no mutation of input', () => {
  const buildingsDoc = { buildings: [
    { slug: '92-reads-way', availability: { status: 'available', headline: 'Up to 21,200 SF available' } },
    { slug: 'beiser-building', availability: { status: 'leased', headline: '' } },
  ]};
  const feed = { generated_at: '2026-07-15T10:30:01', buildings: [
    { name: '92 Reads Way', available_sf: 15030, status: 'available', total_sf: 45000 },
    { name: 'Beiser', available_sf: 0, status: 'leased', total_sf: 9172 },
    { name: 'Lincoln St.', available_sf: 0, status: 'leased', total_sf: 3000 },
  ]};
  const { buildings, changes, errors } = syncBuildings(buildingsDoc, feed, { overrides: {} });
  assert.equal(errors.length, 0);
  assert.equal(changes.length, 1); // Reads headline changes; Beiser stays leased
  const reads = buildings.buildings[0];
  assert.equal(reads.availability.headline, 'About 15,000 SF available');
  assert.equal(reads.availability.computed_sf, 15030);
  assert.equal(reads.availability.as_of, '2026-07-15');
  // financial fields must never appear
  assert.equal(Object.keys(reads.availability).some((k) => /rent|noi|dscr|loan|value/i.test(k)), false);
  // input not mutated
  assert.equal(buildingsDoc.buildings[0].availability.headline, 'Up to 21,200 SF available');
});

test('every site slug in NAME_MAP is unique', () => {
  const slugs = Object.values(NAME_MAP);
  assert.equal(new Set(slugs).size, slugs.length);
});
