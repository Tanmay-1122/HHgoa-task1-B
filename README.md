# HH Goa 2026 — Builder ID Generator

A single-page, no-login tool: upload a photo → get a branded HH Goa 2026 Builder ID
card → download or share to X with `#FrameInGoa`. Everything runs client-side (no
backend), using the frame you designed as the card's background/border.

## Run it locally

No build step. Either:
- Double-click `index.html`, or
- From this folder: `python3 -m http.server 8000` → open `http://localhost:8000`

(Opening via a local server rather than `file://` avoids some browsers' CORS
quirks with `canvas.toBlob()` — recommended for testing the download/share flow.)

## Deploy

Drag this whole folder into [Vercel](https://vercel.com/new) or
[Netlify Drop](https://app.netlify.com/drop) — it's fully static, no config needed.

## File structure

```
index.html      — page structure, form, canvas
styles.css      — brand tokens + layout (palette pulled from assets/hh-frame.webp)
script.js       — upload/HEIC handling, auto-crop, card rendering, share/download
assets/
  hh-frame.webp — your frame, cropped to content bounds and compressed
                  (967KB PNG → 124KB WebP, same visual quality)
```

## How the card is composited

`assets/hh-frame.webp` has **no transparency** — the cream center is a flat fill,
and the border art (diya, scooter, palm, jhumar chain) is baked into the same
flat image. That means the draw order matters:

1. Frame is drawn first, full-bleed, as the background.
2. The photo is drawn **on top**, but only inside a fixed rectangle
   (`PHOTO_RECT` in `script.js`) that was measured to sit entirely inside the
   cream field and clear of every decorative element.
3. Text is drawn on top of that, inside `TEXT_X0/X1/Y0/Y1`, in the same safe zone.

Both rectangles were found by flood-filling the cream region in the source PNG
and manually nudging the bounds until a test render (photo + sample text)
cleared the diya, scooter, palm, and hanging chain with margin — see the
constants at the top of `script.js` if you ever redesign the frame and need to
re-measure.

## Cropping

Per the brief, there's **no manual crop step** — upload goes straight to a
centered auto-fit crop into the photo slot. If `window.FaceDetector` is
available (rare in practice — most mainstream browsers don't ship it as of
2026) it biases the crop toward the detected face; otherwise it centers with a
slight upward bias (`y: 0.42`), which tends to suit portrait photos.

## Rarity

Common/Rare/Epic/Legendary is a weighted random roll (60/30/9/1) reflected as a
colored pill on the card — there's only one frame art asset right now, so
rarity doesn't swap the frame itself. If you want that later, add
`frame-rare.webp` / `frame-epic.webp` / `frame-legendary.webp` and swap
`FRAME_SRC` based on `state.rarity.key` in `renderCard()`.

## What's intentionally not built yet

- **Multi-person "combined frame."** The organizers' task page mentions this;
  it's a real feature to consider but wasn't built in this pass — see the
  original build-prompt doc for scoping notes.
- **Server-hosted OG image for the share link.** The share flow uses the Web
  Share API (attaches the actual PNG on mobile) with a download + X-intent
  fallback on desktop. A dynamic OG-tagged page per card would need a small
  backend and isn't required for the brief's requirements to be met.
- Public gallery / leaderboard of generated cards.

## Troubleshooting

**Frame border/art is missing, card looks like a plain cream rectangle.**
The browser couldn't find `assets/hh-frame.webp`. This almost always means the
`assets` folder sitting next to `index.html` doesn't actually contain that
file (e.g. an old `assets` folder with a different frame file got left in
place instead of being replaced). Fix: delete your whole project folder and
re-extract the zip fresh — don't copy individual files over an existing
folder. As of this version, if the frame still fails to load you'll now see a
toast on-page saying so (and a message in the browser console), instead of it
failing silently.

**The uploaded photo renders as a solid black box.**
This was a real bug, fixed in this version. The original code downscaled
photos by round-tripping them through `canvas.toDataURL()`. Some
privacy-hardened browsers — Brave in particular, via its anti-fingerprinting
canvas protection — intercept or alter that kind of canvas pixel readback
unless the user explicitly allows it for the site, which was silently
corrupting the photo. The pipeline now uses `createImageBitmap()` end to end,
which never exposes pixel data back to JavaScript and isn't subject to that
guard. If a photo still ever renders black, check your browser's shields/
privacy settings for the page (in Brave: click the lion icon → make sure
"Fingerprinting" isn't set to strictly block canvas access for this page) —
but this shouldn't be necessary anymore with the fix.

**General advice:** open the browser console (F12) before testing — both
failure modes above now log or toast a clear message instead of failing
silently.



`localStorage`-based card numbers are **per-browser**, not global — two people
generating a card will likely both see low numbers. A real shared counter
needs a backend (e.g. a single small serverless function with a KV store).
Fine for the shortlisting submission; worth fixing before a real public launch.
