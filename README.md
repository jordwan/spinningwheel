# iWheeli – Spinning Wheel

Random name picker wheel at [iwheeli.com](https://iwheeli.com). Enter names (or generate random names / numbers), spin, and optionally share the wheel via a public URL like `iwheeli.com/team-winners-a1b2`.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **Supabase** (Postgres) for anonymous session/spin tracking and shareable wheel configs. The app works fully without it (local-only mode).
- Google Tag Manager / GA4 / Google Ads via `NEXT_PUBLIC_*` env vars.

## Local development

```bash
npm install
# create .env.local with the variables listed below
npm run dev                         # http://localhost:3000
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (`next lint` was removed in Next 16) |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/test-wheel-fairness.js` | Simulates 100k spins and reports distribution stats |
| `node scripts/optimize-images.js` | Regenerates resized/webp variants of the images in `public/` |

### Environment variables (`.env.local`, never committed)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | for sharing/tracking | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for sharing/tracking | Supabase anon key (RLS policies allow anonymous insert/select) |
| `NEXT_PUBLIC_GTM_ID` | no | Google Tag Manager container |
| `NEXT_PUBLIC_GA_TRACKING_ID` | no | GA4 measurement ID |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | no | Google Ads conversion ID |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | no | Search Console verification token |

Without the Supabase vars the wheel still works; the Share button will fail and nothing is persisted beyond `localStorage`.

## Database

- Fresh project: run `lib/supabase/schema.sql` in the Supabase SQL editor.
- Existing project created before shareable wheels: run `lib/supabase/migration-add-shareable-wheels.sql`.

See `SUPABASE_SETUP.md` and `SHAREABLE_WHEELS_README.md` for details.

## Project layout

```
app/
  page.tsx                  Main page: name input modal, share modal, wheel host
  layout.tsx                Metadata, fonts, analytics loader, JSON-LD
  opengraph-image.tsx       Generated 1200x630 social preview card (see lib/og)
  not-found.tsx, error.tsx  Branded 404 and error screens
  sitemap.ts, robots.ts     Sitemap includes the 500 newest shared wheels (hourly)
  api/ip/route.ts           Returns the visitor's IP from the proxy headers (same-origin, no third party)
  [slug]/                   Public shared-wheel pages (ISR, 404 if unknown) + their OG image
  components/SpinningWheel.tsx   Canvas wheel: drawing, drag/momentum, spin, audio, winner modal
  data/names.ts             Random name pool
  utils/analytics.ts        GA/Ads event helpers
hooks/
  useSession.ts             Local-first session + background Supabase sync
  useViewportHeight.ts      Mobile viewport / keyboard handling
lib/
  session/                  LocalSession (localStorage), DatabaseSync (queue), SupabaseAdapter
  supabase/                 Client, types, SQL schema + migration, shareable config queries
  utils/                    Slug generation/validation, IP lookup, dev-only logger
  og/                       Shared layout for the generated social preview images
scripts/                    Image optimisation + wheel fairness simulations
assets/source-images/       Original / unused image sources (not deployed)
public/                     Deployed static assets (icons/ holds generated PWA + favicon sizes)
```

## Deployment

Deployed on Netlify from `main`. Set the env vars above in the site settings. Any change to the schema must be applied in Supabase separately from the code deploy.

Release flow used so far:

```bash
git checkout main
git merge dev
git push origin main
git checkout dev
```
