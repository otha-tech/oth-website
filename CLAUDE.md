# OTH Website — othde.com

Old Town Hall Associates commercial real estate brochure site.

## Architecture
- **Homepage** `index.html` — hand-written, embedded CSS/JS, EXCEPT two generated blocks
  that `node build.mjs` owns (do not hand-edit between the markers):
  - `<!-- FEATURED:START/END -->` — the three featured property cards (badge + availability
    sentence composed from each building's `featured.blurbLead/blurbTail` + `availability.headline`)
  - `<!-- MAP:START/END -->` — `window.OTH_PINS` data for the "Where You'll Find Us"
    Leaflet/OSM map (pins = name/slug/coords/status/headline only; teal = available)
- **Property pages** — data-driven. `data/buildings.json` is the site's source;
  `node build.mjs` regenerates `properties/<slug>/index.html`, the `properties/index.html`
  hub, `sitemap.xml`, and the homepage blocks. Generated output is committed; GitHub
  Pages serves it statically (no host build).
- Generated pages share `assets/oth.css`; the homepage keeps its own inline styles.
- Hosted on **GitHub Pages** with custom domain `othde.com` (CNAME file)

## Availability = generated from the OTHA data stack (since 2026-07-15)
Do NOT hand-edit availability numbers anywhere. The pipeline
(plan: `oth-dashboard/docs/WEBSITE_DATA_INTEGRATION_PLAN.md`):

1. `oth-dashboard/buildings_public.json` — computed feed (Mini refresh, hourly weekdays);
   the MacBook copy goes stale, always `scp` fresh from the Mini first.
2. `scripts/sync_availability.mjs` merges the feed with `data/availability_overrides.json`
   (curated broker figures; each override carries source + as_of + reason; drift >1,500 SF
   from computed FAILS — re-confirm with the broker, never bump the threshold;
   `suppress:true` = vacant but not marketed) into `data/buildings.json`
   (`status`, `headline`, `computed_sf`, `published_sf`, `as_of`, `source`).
3. `node build.mjs` renders pages + homepage blocks (+ "Availability as of <Month Year>"
   stamp on available pages). Tests: `node --test scripts/test_availability.mjs`.
4. **Publish only via the `/oth-web-sync` skill** — diff shown to Ben, push on his yes,
   live curl verify, then pull the Mini clone + the second MacBook clone
   (`~/Projects/oth-website`). The Mini's dashboard refresh runs the sync in `--check`
   mode as a drift sentinel (alerts, never publishes).

`geo` on each building = lat/lng (CRE-BI parcel centroid or Nominatim; `source` says
which) → JSON-LD GeoCoordinates + the homepage map. Never any financial field in
`buildings.json`, `availability_overrides.json`, or the feed.

## Property pages (data-driven)
- Edit `data/buildings.json`, then run `node build.mjs` from the repo root, then commit.
  (build.mjs resolves all paths relative to its own location, so cwd doesn't matter — but
  run it from the repo root for clarity. There is no `site/` subdirectory.)
- Availability: each building has `availability.status` = `"available"` | `"leased"`.
  Available buildings show a leasing CTA (LoopNet/brochure/call); leased show "fully
  leased / contact us." The hub groups Available Now first, then Full Portfolio. The
  homepage's 3 featured cards carry a badge and link to their detail pages.
- `addressTBD: true` flags buildings whose street address/zip still need confirmation —
  those pages show market/city only (no guessed street address) and omit `streetAddress`
  from JSON-LD. Fill the real address + set `addressTBD: false`, then rebuild.
- **Never add private portfolio financials** (loan balances, valuations, LTV, rent, profit
  from `OTHA At a Glance.csv`) to `buildings.json` — public-facing fields only.
- Each page emits per-page `<title>`/meta/canonical/OG + schema.org JSON-LD
  (`Place`, plus `RealEstateListing` when available).

### Future TODO
- **Feature current tenants on property pages** (social proof + location-anchored SEO,
  e.g. "Home to LifeStance, Asplundh, Vitas…"). Tenant roster is in `OTHA At a Glance.csv`.
  Intentionally omitted at launch; revisit per-tenant consent before publishing names.

## Repos
- **Site (GitHub Pages):** `git@github.com:otha-tech/oth-website.git` (was bjpasquale/oth-website, redirected)
- **Parent archive:** `https://github.com/otha-tech/otha-website-assets-only.git` — PDFs, photos, docs (not deployed)

## Local Paths
- MacBook: `/Users/benpasquale/Projects/oth-website/` (this site repo — flat, no `site/` subdir).
  Note: `~/Projects/OTH website/` is the *separate* assets-only archive repo, not this one.
- Mac Mini: `~/Projects/oth-website-repo/` (verify the exact clone name on the Mini before deploy)

## SEO
- `sitemap.xml` submitted to Google Search Console (Mar 2026)
- `robots.txt` present (GitHub Pages may append its own AI-blocker rules)
- Google verification file: `google908cbf10d136107d.html`
- Domain verified in Google Search Console

## DNS / Cloudflare — CRITICAL, DO NOT PROXY
othde.com DNS is on Cloudflare, but the GitHub Pages records **MUST stay "DNS only" (grey
cloud), never Proxied (orange)**. The 5 records: four apex `A` records (185.199.108–111.153)
and the `www` CNAME (→ `bjpasquale.github.io`, resolves fine).

**Why:** GitHub Pages auto-renews its Let's Encrypt cert every ~90 days. If the records are
proxied, Cloudflare intercepts the ACME renewal challenge → renewal silently fails →
~90 days later the whole site returns **Cloudflare 526 "Invalid SSL certificate"** (apex
*and* www). This took the site down on 2026-05-27. Fix was: grey-cloud the 5 records, then
GitHub re-issues the cert (DNS check must read "successful"; provisioning takes up to ~15
min and resets if you click Save/Remove during it — leave it alone once triggered).

If you ever want Cloudflare's proxy benefits (caching/WAF), the only clean path is to move
hosting to **Cloudflare Pages** (like tinyweekends.co) — proxying GitHub Pages will always
break SSL renewal. `gis-proxy.othde.com` may stay Proxied (separate tunnel) — don't touch it.

## Deploy
Changes pushed to `main` auto-deploy via GitHub Pages. Run `node build.mjs` first if you
edited `buildings.json` or `build.mjs`, so generated pages + sitemap are current.

Availability/number changes publish only via the `/oth-web-sync` skill (see above). The
manual path below is for non-availability edits (design, copy, templates):

```bash
cd /Users/benpasquale/Projects/oth-website
node build.mjs   # if property data/templates changed
git add . && git commit -m "message" && git push
# Then sync Mini:
ssh benjaminpasquale@100.83.77.70 "cd ~/Projects/oth-website-repo && git pull"
```

## Design
- Fonts: Playfair Display (headers) + Inter (body)
- Colors: Teal accent (#2a7d6e), white, grays
- Responsive with mobile hamburger menu
- Homepage sections: Hero, About, Stats, Properties (3 featured), Affiliates, Contact
- `/properties/` hub + per-building pages share `assets/oth.css` (same tokens, solid header)
