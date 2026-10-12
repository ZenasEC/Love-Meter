# Love Meter

A little almanac of small affections. Write two names, read an honest number.

The centre of the page is a big heart that beats as your score climbs — faster
as it gets hotter, and it cracks and goes grey if the pair lands under 30%.
Two cupids keep it in their sights. Around it: a ledger of time spent together,
a letter press, a shelf of prints, and a bowl of promises.

## Run it

No build step, no dependencies. Either open `index.html` directly, or serve the
folder:

```bash
python -m http.server 8899
# then browse to http://127.0.0.1:8899/
```

Music starts from the cover's "Open with music" button (browsers block autoplay).

## How the score works

The number is **deterministic and symmetric**: both names are normalised and
sorted before hashing (`xmur3` + `mulberry32`), so `A + B` always equals
`B + A` and the same pair always returns the same score.

A few pairs are pinned by hand in the `CURATED` map in `app.js` and skip the
hash entirely.

## Layout

| File | What it is |
| --- | --- |
| `index.html` | Markup for every section: cover, meter, ledger, letter, prints, keepsakes. |
| `styles.css` | All styling; design tokens live in `:root`. |
| `app.js` | One IIFE, split into numbered sections. |
| `assets/pastel-skies.wav` | The music the page plays: a "Pastel Skies" cover, stored as a small 32 kHz mono WAV. |
| `assets/lofi-love.wav` | A spare original lofi instrumental (royalty-free). |
| `tools/make_lofi_love.py` | Generates that instrumental from scratch (pure stdlib). |
| `assets/cupid-loop.wav` | A music-box waltz, kept as a fallback companion. |
| `tools/make_cupid_loop.py` | Generates that waltz from scratch (pure stdlib). |
| `tools/shrink_track.py` | Shrinks a big source WAV to the shipped 32 kHz mono size (needs numpy). |
| `tools/log-sheet.gs` | Optional: Apps Script that logs each reading to a Google Sheet. |

## The guest log (optional)

Off by default — the page sends nothing anywhere until you turn it on.

To see who your friends have tested, log every reading to a Google Sheet:

1. Create a Sheet (<https://sheets.new>), then **Extensions ▸ Apps Script**.
2. Paste in [`tools/log-sheet.gs`](tools/log-sheet.gs) and save.
3. **Deploy ▸ New deployment ▸ Web app** — execute as *Me*, access *Anyone*.
4. Copy the `/exec` URL into `LOG_ENDPOINT` in the `13 logbook` section of
   `app.js`, then commit and push.

Each reading then lands as a row: when, the two names, and the score. A note
under the form appears once logging is on, so visitors can see their names are
saved.

## Music

The page plays `assets/pastel-skies.wav`, a **"Pastel Skies" cover**, stored as a
32 kHz mono WAV so it stays a reasonable download.

The repo also ships two **original, royalty-free** tracks generated from scratch:
`assets/lofi-love.wav` (a lofi love instrumental) and `assets/cupid-loop.wav` (a
music-box waltz). Rebuild either with:

```bash
python tools/make_lofi_love.py
python tools/make_cupid_loop.py
```

If the played file is missing, `app.js` falls back to a synthesized WebAudio
waltz, so the page always has its tune.

To swap in the lofi track instead, point the `<audio id="cupid">` src in
`index.html` at `assets/lofi-love.wav`. To shrink a new source of your own:

```bash
python tools/shrink_track.py "your-source.wav" assets/pastel-skies.wav
```

## Notes

- Photos never leave the browser: gallery images are downscaled and kept in
  `localStorage`.
- Motion respects `prefers-reduced-motion`.
- Fonts are loaded from Google Fonts, so the page wants internet for its
  intended typography.
