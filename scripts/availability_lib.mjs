// Shared logic for syncing othde.com availability from the oth-dashboard public feed.
// Used by sync_availability.mjs (write + check modes) and test_availability.mjs.
// ALLOWLIST RULE: only the fields named in applyAvailability may flow from the feed
// into buildings.json. No financial data, ever.

// Feed building name -> site slug. Feed rows not listed here are not on the site
// (Lincoln St., Metten St., Linden St. — intentionally unlisted).
export const NAME_MAP = {
  'Commerce': '100-commerce-drive',
  '92 Reads Way': '92-reads-way',
  'Kendall': 'kendall-building',
  'Neurology Way': '113-neurology-way',
  'Milford-Walnut': 'milford-walnut-street',
  'Millsboro': 'millsboro',
  'Beiser': 'beiser-building',
  'Front St.': 'front-street',
  'Milford-Lakeview': 'milford-lakeview',
  'Seaford': 'seaford',
  '16 S. DuPont': '16-s-dupont',
  'Sabre': 'sabre-building',
  'Liz Plaza': 'liz-plaza',
};

const UNLISTED_FEED_NAMES = new Set(['Lincoln St.', 'Metten St.', 'Linden St.']);

// "About 15,000 SF available" when the computed number is rounded, exact text otherwise.
export function headlineFromComputed(computedSf) {
  const rounded = Math.round(computedSf / 500) * 500;
  const fmt = rounded.toLocaleString('en-US');
  return rounded === computedSf
    ? `${fmt} SF available`
    : `About ${fmt} SF available`;
}

// Decide the published availability for one site building.
// Returns { status, headline, computed_sf, published_sf, as_of, source, warnings, errors }.
export function resolveAvailability({ slug, feedRow, override, asOf, driftThresholdSf }) {
  const warnings = [];
  const errors = [];
  const computed = feedRow ? feedRow.available_sf : null;

  if (!feedRow) {
    warnings.push(`${slug}: no feed row — availability left unchanged`);
    return { unchanged: true, warnings, errors };
  }

  if (override && override.suppress) {
    if (computed > 0) {
      warnings.push(
        `${slug}: suppressed (${override.reason || 'no reason given'}) while feed computes ` +
        `${computed.toLocaleString('en-US')} SF vacant`
      );
    }
    return {
      status: 'leased', headline: '', computed_sf: computed, published_sf: 0,
      as_of: asOf, source: `override: ${override.source || 'curated'}`, warnings, errors,
    };
  }

  if (override && typeof override.published_sf === 'number') {
    const drift = Math.abs(override.published_sf - computed);
    if (drift > driftThresholdSf) {
      errors.push(
        `${slug}: override ${override.published_sf.toLocaleString('en-US')} SF drifts ` +
        `${drift.toLocaleString('en-US')} SF from computed ${computed.toLocaleString('en-US')} SF ` +
        `(threshold ${driftThresholdSf}) — re-confirm the override (as_of ${override.as_of})`
      );
    }
    return {
      status: override.published_sf > 0 ? 'available' : 'leased',
      headline: override.headline || headlineFromComputed(override.published_sf),
      computed_sf: computed, published_sf: override.published_sf,
      as_of: asOf, source: `override: ${override.source || 'curated'}`, warnings, errors,
    };
  }

  // Pure computed path. Feed already applies the small-vacancy floor (<500 SF -> leased).
  if (computed > 0) {
    return {
      status: 'available', headline: headlineFromComputed(computed),
      computed_sf: computed, published_sf: computed,
      as_of: asOf, source: 'computed', warnings, errors,
    };
  }
  return {
    status: 'leased', headline: '', computed_sf: computed, published_sf: 0,
    as_of: asOf, source: 'computed', warnings, errors,
  };
}

// Merge the feed + overrides into the buildings.json object (mutates a deep copy).
// Returns { buildings, changes, warnings, errors }.
export function syncBuildings(buildingsDoc, feed, overridesDoc) {
  const doc = JSON.parse(JSON.stringify(buildingsDoc));
  const overrides = overridesDoc.overrides || {};
  const driftThresholdSf = overridesDoc.driftThresholdSf ?? 1500;
  const asOf = (feed.generated_at || '').slice(0, 10) || null;

  const feedBySlug = {};
  const warnings = [];
  const errors = [];
  for (const row of feed.buildings || []) {
    const slug = NAME_MAP[row.name];
    if (!slug) {
      if (!UNLISTED_FEED_NAMES.has(row.name)) {
        warnings.push(`feed building "${row.name}" has no site mapping`);
      } else if (row.status === 'available') {
        warnings.push(`unlisted building "${row.name}" computes as available — intentional?`);
      }
      continue;
    }
    feedBySlug[slug] = row;
  }

  const changes = [];
  for (const b of doc.buildings) {
    const r = resolveAvailability({
      slug: b.slug,
      feedRow: feedBySlug[b.slug],
      override: overrides[b.slug],
      asOf,
      driftThresholdSf,
    });
    warnings.push(...r.warnings);
    errors.push(...r.errors);
    if (r.unchanged) continue;

    const before = `${b.availability.status}|${b.availability.headline}`;
    b.availability.status = r.status;
    b.availability.headline = r.headline;
    b.availability.computed_sf = r.computed_sf;
    b.availability.published_sf = r.published_sf;
    b.availability.as_of = r.as_of;
    b.availability.source = r.source;
    const after = `${r.status}|${r.headline}`;
    if (before !== after) {
      changes.push(`${b.slug}: ${before.replace('|', ' / "')}"  ->  ${after.replace('|', ' / "')}"`);
    }
  }
  return { buildings: doc, changes, warnings, errors };
}
