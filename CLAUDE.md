# OTH Website — othde.com

Old Town Hall Associates commercial real estate brochure site.

## Architecture
- **Homepage** `index.html` — hand-written, embedded CSS/JS (no build step)
- **Property pages** — data-driven. `data/buildings.json` is the single source of truth;
  `node build.mjs` regenerates `properties/<slug>/index.html` (one per building), the
  `properties/index.html` hub, and `sitemap.xml`. Generated output is committed; GitHub
  Pages serves it statically (no host build).
- Generated pages share `assets/oth.css`; the homepage keeps its own inline styles.
- Hosted on **GitHub Pages** with custom domain `othde.com` (CNAME file)

## Property pages (data-driven)
- Edit `data/buildings.json`, then run `node build.mjs` from `site/`, then commit.
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
- MacBook: `/Users/benpasquale/Projects/OTH website/site/` (site repo)
- Mac Mini: `~/Projects/oth-website-repo/`

## SEO
- `sitemap.xml` submitted to Google Search Console (Mar 2026)
- `robots.txt` present (GitHub Pages may append its own AI-blocker rules)
- Google verification file: `google908cbf10d136107d.html`
- Domain verified in Google Search Console

## Deploy
Changes pushed to `main` auto-deploy via GitHub Pages. Run `node build.mjs` first if you
edited `buildings.json` or `build.mjs`, so generated pages + sitemap are current.

```bash
cd "/Users/benpasquale/Projects/OTH website/site"
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
