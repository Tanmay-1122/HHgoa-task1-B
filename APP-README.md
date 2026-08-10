# HH Goa 2026 — Builder ID Generator (v2: public cards + QR + gallery)

This is the upgraded version: every generated card is saved, gets its own
public URL with a scannable QR code baked into the image, shows up in a
searchable gallery, and can be deleted by whoever made it.

## Important — read this first

I built this entire codebase by hand in a sandboxed environment **without
access to the npm registry**, so I could not run `npm install` or `next
build` myself to get a real, final compile check. I did as much verification
as I could without that:

- Ran the TypeScript compiler directly (using a globally-installed `tsc`,
  without the actual `next`/`react`/`@vercel/*` packages available) to catch
  syntax errors and logic bugs. It caught and I fixed several real issues
  (a Postgres string/number concatenation that would've failed at runtime, a
  misplaced type-suppression comment, a type-only import that could've
  leaked server code into the client bundle).
- The QR code logic is verified for real: I found a spec-correct QR encoder
  already available locally, generated an actual QR, decoded it back
  successfully with a real decoder (zbar) to confirm it round-trips
  correctly, and composited that real QR into your actual card art to check
  placement against the frame's decorations.

**What this means for you:** run `npm install && npm run build` yourself as
the very first step, before deploying. That is the real, authoritative check
that everything compiles — treat it as step 1, not an afterthought. If it
surfaces errors, they'll almost certainly be small (a typo, a version
mismatch) rather than structural, since the overall logic has been reviewed
carefully — but I want to be upfront that this hasn't been proven by an
actual build the way the original single-page version was.

## Setup — in order

### 1. Install and build locally

```bash
cd hhgoa-app
npm install
npm run build
```

Fix anything that comes up here before moving on. This is the step most
likely to surface something I couldn't catch by hand.

### 2. Create a Vercel project

```bash
npm install -g vercel   # if you don't have it
vercel link             # follow the prompts to create/link a project
```

### 3. Add Postgres

Vercel dashboard → your project → **Storage** tab → **Create Database** →
**Postgres**. No configuration needed — just create it and connect it to
this project. This automatically sets `POSTGRES_URL` and related env vars.

### 4. Add Blob storage

Same **Storage** tab → **Create Database** → **Blob**. Also automatic, sets
`BLOB_READ_WRITE_TOKEN`.

### 5. Run the schema

Dashboard → your Postgres database → **Query** tab → paste the entire
contents of `db/schema.sql` → **Run**. (Or, if you have `psql`:
`psql "$POSTGRES_URL" -f db/schema.sql` after pulling env vars — see next
step.)

### 6. Pull env vars locally (for local dev/testing)

```bash
vercel env pull .env.local
```

### 7. (Optional) Set a cron secret

If you want the cleanup cron endpoint to reject non-Vercel callers, add a
`CRON_SECRET` env var in the dashboard (Project → Settings → Environment
Variables) — any random string. Vercel automatically sends it as a Bearer
token when triggering the scheduled job. Skip this if you don't care; the
cleanup route just runs unauthenticated in that case, which is low-risk
(worst case, someone triggers cleanup early — not harmful).

### 8. Deploy

```bash
vercel --prod
```

## After deploying — actually test these

- [ ] Generate a card start to finish.
- [ ] **Scan the QR with your actual phone camera** — confirm it opens the
      right `/c/{id}` page.
- [ ] Paste the `/c/{id}` URL into a new X post (don't post it, just check
      the preview) — confirm the card image shows up, not a blank box.
- [ ] Open `/gallery`, search by the name you used, search by the card's ID
      number, and click a category chip.
- [ ] Click "Delete my card" and confirm it's actually gone from both the
      gallery and its direct URL.
- [ ] Try the whole flow on an actual phone, not just desktop — this is
      explicitly a mobile-first requirement from the original brief.

## What changed from the original single-page version

- The static `index.html`/`script.js`/`styles.css` site is now a Next.js
  app — necessary because per-card link previews require server-rendered
  pages with dynamic metadata, which a static site can't do.
- Every generate now: reserves an ID → renders the card with a QR encoding
  its public URL → uploads the image to Vercel Blob → saves metadata to
  Postgres. See `lib/cardLogic.ts` for the exact layout constants (verified
  QR placement) and `components/Generator.tsx` for the full flow.
- The old per-browser `localStorage` card counter is gone — the database's
  auto-incrementing ID is now the single source of truth for card numbers,
  used for both the URL and the "No. 000123" display.
- Rerolling the builder class/rarity after a card is already public
  re-uploads and overwrites the saved card, so the public link never goes
  stale relative to what you last saw.

## Project structure

```
app/
  page.tsx              generator (home page)
  c/[id]/page.tsx        public card page, dynamic OG metadata
  gallery/page.tsx        search/browse gallery
  api/cards/reserve/      POST — reserve a new card id
  api/cards/[id]/finalize/  POST — upload image + save metadata
  api/cards/[id]/          DELETE — owner-only delete
  api/cards/cleanup/       GET — cron: purge abandoned pending rows
  api/gallery/              GET — search/list
components/
  Generator.tsx           upload, auto-crop, canvas render, reserve/finalize
  GalleryBrowser.tsx      search + filter + pagination
  DeleteCardButton.tsx    delete control for the public card page
lib/
  cardLogic.ts            shared constants/logic (client + server safe)
  db.ts                   Postgres queries
  blob.ts                 Vercel Blob upload/delete
  hash.ts                 delete-token generation/hashing
  rateLimit.ts             basic per-IP limiter on card creation
  site.ts                 resolves the deployed base URL for OG tags
  myCards.ts              localStorage — which cards this browser owns
db/schema.sql             run this once against your Postgres DB
public/assets/hh-frame.webp   your frame art
```

## Known limitations, on purpose

- **Rate limiting is in-memory**, not shared across serverless instances —
  a soft deterrent, not a hard guarantee. Fine at this scale; swap for
  Upstash Redis or similar if traffic ever gets real.
- **Deletion is anonymous/token-based**, no accounts. If someone clears
  their browser storage or opens the card on a different device, they lose
  the ability to delete it from that device — this was an explicit tradeoff
  for "no login wall."
- **No moderation** on name/role text, per your call — but all user text is
  still properly escaped everywhere it renders on public pages, so this is
  a content-taste decision, not an XSS hole.
