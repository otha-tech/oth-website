# OTH Website — othde.com

Old Town Hall Associates commercial real estate brochure site.

## Architecture
- **Static single-page HTML** — no framework, no build step
- `index.html` with embedded CSS/JS, `assets/` for images and PDFs
- Hosted on **GitHub Pages** with custom domain `othde.com` (CNAME file)

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
Changes pushed to `main` auto-deploy via GitHub Pages. No build step needed.

```bash
cd "/Users/benpasquale/Projects/OTH website/site"
git add . && git commit -m "message" && git push
# Then sync Mini:
ssh benjaminpasquale@100.83.77.70 "cd ~/Projects/oth-website-repo && git pull"
```

## Design
- Fonts: Playfair Display (headers) + Inter (body)
- Colors: Teal accent (#2a7d6e), white, grays
- Responsive with mobile hamburger menu
- Sections: Hero, About, Stats, Properties (3 featured), Affiliates, Contact
