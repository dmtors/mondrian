# Mondrian

An instrument made of articles. Four Wikipedia articles shape a synthesizer
sound and paint a Mondrian-style grid of notes to tap, drag across, or play
with the A–L keys.

| Slot     | Article property          | Sound                               |
| -------- | ------------------------- | ----------------------------------- |
| Waveform | Topic                     | square / sawtooth / triangle / sine |
| Filter   | Incoming links            | low-pass cutoff (250 Hz – 7 kHz)    |
| Envelope | Age                       | decay (0.12 s – 2.2 s)              |
| Effect   | Edits in the last 30 days | vibrato depth and rate              |

Nine notes in the chosen key, scale and octave (C major pentatonic from C4 by default); the
bigger the rectangle, the lower the note. The four titles seed the layout, so
the same articles always make the same painting; changing key, scale or octave
only changes the notes. The URL hash holds the titles (and the tuning when not
the default), so a link reproduces a painting and its sound.

All icons are Codex icons (`@wikimedia/codex-icons`), inlined as SVG.

Ported from the Commonplace Android app (`core/sound/` and `ui/play/MondrianScreen.kt`).

## Run

Plain HTML, CSS and ES modules, with no build step. Serve the folder over HTTP
(any static server works):

```bash
python3 serve.py   # like http.server, but with caching off so reloads pick up edits
```

## Files

- `js/painting.js`: the layout (a weighted binary split, seeded by the titles)
- `js/synth.js`: article properties to sound, and the Web Audio voice
- `js/wiki.js`: one Action API request per article (`cirrusdoc` + `revisions`), search
- `js/scales.js`: keys and scales, and the nine notes they give
- `js/app.js`: UI, article picker, key and scale, share link
