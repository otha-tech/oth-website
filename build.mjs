#!/usr/bin/env node
/*
 * OTH Website static generator.
 *
 * Reads data/buildings.json and writes:
 *   - properties/<slug>/index.html   (one SEO page per building)
 *   - properties/index.html          (portfolio hub: available first, then leased)
 *   - sitemap.xml                    (homepage + hub + every building page)
 *
 * Zero dependencies. Run from site/:  node build.mjs
 * Output is committed to git; GitHub Pages serves it statically (no host build).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://othde.com';
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const sf = (n) => Number(n).toLocaleString('en-US');
const clip = (s, n = 158) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

function locationLine(b) {
  // Public-facing location string. No guessed street addresses.
  if (b.address && !b.addressTBD) {
    return [b.address, [b.city, b.state].filter(Boolean).join(', '), b.zip].filter(Boolean).join(', ');
  }
  return b.city ? `${b.city}, ${b.state}` : b.state;
}

function metaTitle(b) {
  const leasing = b.availability.status === 'available'
    ? `${b.type} for Lease in ${b.market}`
    : `${b.market} Commercial Real Estate`;
  return `${b.name} | ${leasing} | Old Town Hall Associates`;
}

// ---------- shared partials ----------
function head({ title, description, canonical, image, jsonld }) {
  const ogImage = image ? `${BASE_URL}/${image}` : `${BASE_URL}/assets/logo.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${canonical}">
    <link rel="icon" type="image/png" href="/assets/logo_dark.png">
    <link rel="apple-touch-icon" href="/assets/logo.png">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${ogImage}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${ogImage}">
    <script type="application/ld+json">
${JSON.stringify(jsonld, null, 4)}
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/oth.css">
</head>
<body>`;
}

function header(active) {
  const cls = (k) => (k === active ? ' class="active"' : '');
  return `    <header>
        <nav>
            <a href="/" class="logo-link"><span class="logo-text">Old Town Hall Associates</span></a>
            <ul class="nav-links">
                <li><a href="/#about">About</a></li>
                <li><a href="/properties/"${cls('properties')}>Properties</a></li>
                <li><a href="/#contact">Contact</a></li>
                <li><a href="tel:302-998-0100" class="nav-phone">302.998.0100</a></li>
            </ul>
            <button class="menu-toggle" aria-label="Open menu" aria-expanded="false">
                <span></span><span></span><span></span>
            </button>
        </nav>
    </header>
    <div class="mobile-nav" role="navigation" aria-label="Mobile navigation">
        <a href="/#about">About</a>
        <a href="/properties/">Properties</a>
        <a href="/#contact">Contact</a>
        <a href="tel:302-998-0100" class="nav-phone">302.998.0100</a>
    </div>`;
}

const FOOTER = `    <footer>
        <div class="footer-content">
            <p class="footer-text">&copy; 2026 Old Town Hall Associates, LLC. All rights reserved.</p>
        </div>
    </footer>
    <script>
        const menuToggle = document.querySelector('.menu-toggle');
        const mobileNav = document.querySelector('.mobile-nav');
        menuToggle.addEventListener('click', () => {
            const open = menuToggle.classList.toggle('active');
            mobileNav.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', open);
            document.body.style.overflow = open ? 'hidden' : '';
        });
        mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        }));
    </script>
</body>
</html>`;

function mediaBlock(b, wrapClass) {
  if (b.images && b.images.length) {
    return `<div class="${wrapClass}"><img src="/${esc(b.images[0])}" alt="${esc(b.name)} — ${esc(b.market)}" loading="lazy"></div>`;
  }
  return `<div class="${wrapClass}"><div class="media-placeholder">${esc(b.name)}</div></div>`;
}

// ---------- JSON-LD ----------
function buildingJsonLd(b, url) {
  const address = { '@type': 'PostalAddress', addressRegion: b.state, addressCountry: 'US' };
  if (b.address && !b.addressTBD) address.streetAddress = b.address;
  if (b.city) address.addressLocality = b.city;
  if (b.zip) address.postalCode = b.zip;

  const place = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: b.name,
    url,
    address,
    floorSize: { '@type': 'QuantitativeValue', value: b.totalSF, unitCode: 'FTK' },
  };

  if (b.availability.status === 'available') {
    return [
      place,
      {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: `${b.name} — ${b.type} for Lease`,
        url,
        description: b.description,
        datePosted: TODAY,
        about: { '@type': 'Place', name: b.name, address },
      },
    ];
  }
  return place;
}

// ---------- per-building page ----------
function renderBuilding(b) {
  const url = `${BASE_URL}/properties/${b.slug}/`;
  const avail = b.availability;
  const isAvail = avail.status === 'available';

  const specs = [
    `<div class="spec"><h4>${sf(b.totalSF)}</h4><p>Total Square Feet</p></div>`,
    `<div class="spec"><h4>${esc(b.type)}</h4><p>Property Type</p></div>`,
    `<div class="spec"><h4>${esc(b.market)}</h4><p>Location</p></div>`,
  ].join('\n                ');

  const features = b.features && b.features.length
    ? `<h3 class="section-label" style="margin-top:2.5rem">Building Features</h3>
            <ul class="features-list">
                ${b.features.map((f) => `<li>${esc(f)}</li>`).join('\n                ')}
            </ul>`
    : '';

  // Availability sidebar
  let sidebar;
  if (isAvail) {
    const btns = [];
    if (avail.loopnet) btns.push(`<a href="${esc(avail.loopnet)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">View Listing on LoopNet</a>`);
    if (avail.brochure) btns.push(`<a href="/${esc(avail.brochure)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Download Brochure</a>`);
    btns.push(`<a href="tel:302-998-0100" class="btn ${btns.length ? 'btn-outline' : 'btn-primary'}">Call 302.998.0100</a>`);
    const broker = avail.broker
      ? `<p class="avail-broker">Leasing represented by <strong>${esc(avail.broker.name)}</strong>, ${esc(avail.broker.firm)}.</p>`
      : `<p class="avail-broker">Leased directly by Old Town Hall Associates.</p>`;
    sidebar = `<aside class="avail-card is-available">
                <h3><span class="badge badge-available">Available</span></h3>
                <p class="avail-headline">${esc(avail.headline || 'Space available')}</p>
                ${broker}
                ${btns.join('\n                ')}
            </aside>`;
  } else {
    const listing = avail.loopnet
      ? `<a href="${esc(avail.loopnet)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">View Listing</a>\n                `
      : '';
    sidebar = `<aside class="avail-card">
                <h3><span class="badge badge-leased">Fully Leased</span></h3>
                <p class="avail-headline">No current vacancies</p>
                <p class="avail-broker">Contact us about future availability at this property or others in our portfolio.</p>
                ${listing}<a href="tel:302-998-0100" class="btn btn-primary">Call 302.998.0100</a>
            </aside>`;
  }

  const addressLine = b.address && !b.addressTBD
    ? `<p class="building-address">${esc(locationLine(b))}</p>`
    : '';

  return `${head({
    title: metaTitle(b),
    description: clip(b.description),
    canonical: url,
    image: b.images && b.images.length ? b.images[0] : null,
    jsonld: buildingJsonLd(b, url),
  })}
${header('properties')}
    <main>
        <div class="building-hero">${b.images && b.images.length
          ? `<img src="/${esc(b.images[0])}" alt="${esc(b.name)} — ${esc(b.market)}">`
          : `<div class="media-placeholder">${esc(b.name)}</div>`}</div>
        <div class="page">
            <nav class="breadcrumb" aria-label="Breadcrumb">
                <a href="/">Home</a><span>/</span><a href="/properties/">Properties</a><span>/</span>${esc(b.name)}
            </nav>
            <div class="building-head">
                <p class="building-loc">${esc(b.market)}</p>
                <h1>${esc(b.name)}</h1>
                ${addressLine}
            </div>
            <div class="building-layout">
                <div class="building-body">
                    <p>${esc(b.description)}</p>
                    <div class="spec-row">
                ${specs}
                    </div>
                    ${features}
                </div>
                ${sidebar}
            </div>
            <a href="/properties/" class="back-link">&larr; Back to all properties</a>
        </div>
    </main>
${FOOTER}`;
}

// ---------- hub card ----------
function hubCard(b) {
  const meta = b.availability.status === 'available'
    ? `<span class="badge badge-available">Available</span>`
    : `<span class="badge badge-leased">Leased</span>`;
  return `            <a class="hub-card" href="/properties/${b.slug}/">
                ${mediaBlock(b, 'hub-card-media')}
                <div class="hub-card-body">
                    <span class="hub-card-loc">${esc(b.market)}</span>
                    <h3>${esc(b.name)}</h3>
                    <div class="hub-card-meta">${sf(b.totalSF)} SF &middot; ${esc(b.type)}<br>${meta}</div>
                </div>
            </a>`;
}

// ---------- hub page ----------
function renderHub(buildings) {
  const url = `${BASE_URL}/properties/`;
  const available = buildings.filter((b) => b.availability.status === 'available');
  const leased = buildings.filter((b) => b.availability.status !== 'available');

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Properties | Old Town Hall Associates',
    url,
    about: buildings.map((b) => ({ '@type': 'Place', name: b.name, url: `${BASE_URL}/properties/${b.slug}/` })),
  };

  const section = (title, items) =>
    items.length
      ? `        <h2 class="hub-section-title">${title}</h2>
        <div class="hub-grid">
${items.map(hubCard).join('\n')}
        </div>`
      : '';

  const availLabel = available.length
    ? `${available.length} ${available.length === 1 ? 'building has' : 'buildings have'} space available now.`
    : 'All properties are currently leased — contact us about upcoming availability.';

  return `${head({
    title: 'Properties | Office Space for Lease in Delaware | Old Town Hall Associates',
    description: `Browse Old Town Hall Associates' Delaware commercial real estate portfolio — ${buildings.length} office and medical office properties across Newark, New Castle, Wilmington, Dover, Milford, Millsboro, and Seaford. ${availLabel}`,
    canonical: url,
    image: null,
    jsonld,
  })}
${header('properties')}
    <main class="page">
        <div class="hub-header">
            <p class="section-label">Our Portfolio</p>
            <h1>Delaware Commercial Properties</h1>
            <p>${buildings.length} office and medical office buildings across Delaware, owned and managed in-house since 1980. ${availLabel}</p>
        </div>
${section('Available Now', available)}
${section('Full Portfolio', leased)}
    </main>
${FOOTER}`;
}

// ---------- sitemap ----------
function renderSitemap(buildings) {
  const urls = [
    { loc: `${BASE_URL}/`, priority: '1.0', freq: 'monthly' },
    { loc: `${BASE_URL}/properties/`, priority: '0.9', freq: 'weekly' },
    ...buildings.map((b) => ({
      loc: `${BASE_URL}/properties/${b.slug}/`,
      priority: b.availability.status === 'available' ? '0.8' : '0.6',
      freq: 'monthly',
    })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
}

// ---------- run ----------
function write(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  console.log('  wrote', rel);
}

function main() {
  const { buildings } = JSON.parse(readFileSync(join(ROOT, 'data/buildings.json'), 'utf8'));
  console.log(`Generating ${buildings.length} building pages + hub + sitemap…`);

  for (const b of buildings) write(`properties/${b.slug}/index.html`, renderBuilding(b));
  write('properties/index.html', renderHub(buildings));
  write('sitemap.xml', renderSitemap(buildings));

  const tbd = buildings.filter((b) => b.addressTBD).map((b) => b.name);
  const avail = buildings.filter((b) => b.availability.status === 'available').map((b) => b.name);
  console.log(`\nDone. Available now: ${avail.join(', ') || 'none'}`);
  if (tbd.length) console.log(`Address TBD (${tbd.length}): ${tbd.join(', ')}`);
}

main();
