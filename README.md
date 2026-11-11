# Mondrian

An instrument made of articles. Four Wikipedia articles shape a synthesizer
sound and paint a grid after Mondrian's *Broadway Boogie Woogie*: streets of
equal squares in yellow, red, blue and grey, with bigger blocks in the white
fields between. Tap the colours, drag along a street, or play the keyboard
(Q–R and A–F for the blocks, U–P and J–; for the higher notes: one row per size).

Each slot's article shapes its part of the sound through a trust signal from
the [Wikimedia Attribution API](https://www.mediawiki.org/wiki/Attribution_API) (beta):

| Slot     | Trust signal                | Sound                                       |
| -------- | --------------------------- | ------------------------------------------- |
| Waveform | Contributors                | sine (< 100) / triangle / square / sawtooth (1,500+) |
| Filter   | References                  | low-pass cutoff (250 Hz – 7 kHz)            |
| Envelope | Page views, last 30 days    | decay (0.12 s – 2.2 s)                      |
| Effect   | Last updated, and trending  | vibrato depth and rate; trending shimmers   |

The cards show each signal with its Codex icon, and the credits link with the
API's own link, which keeps its `wprov` tag.

Each colour is a note. **Pitch** (a slider round an infinity-shaped track, so it never ends) sets the home
note, which yellow plays; **Mood** (a knob from Dreamy to Spooky) picks the
three notes red, blue and grey play with it, a set that always sounds good
together (in music terms, a four-note chord: Sunny is a major sixth, Boogie a
dominant seventh, Moody a minor seventh, and so on). The same note lives all
over the painting, and size picks the octave: large blocks lowest, then medium
and small blocks, then the squares on the streets, an octave apart (by default
C, E, G and A, from C2 to A5). White is quiet. The big **Octave** buttons move
all four sizes together, as far as every note stays between C1 and C8. The
four titles seed the streets, blocks and colours, so the same articles always
make the same painting; pitch, mood and octave only change the notes.
The URL hash holds the titles (and pitch, mood and octave when not the
default), so a link reproduces a painting and its sound.

The interface is [Codex](https://doc.wikimedia.org/codex/): its design tokens and
component styles, with Gerrit changes
[1304941](https://gerrit.wikimedia.org/r/c/design/codex/+/1304941) and
[1354777](https://gerrit.wikimedia.org/r/c/design/codex/+/1354777) applied, are
vendored in `vendor/codex/` (see its README), and the markup wears Codex's
classes. All icons are Codex icons (`@wikimedia/codex-icons`), inlined as SVG.

Ported from the Commonplace Android app (`core/sound/` and `ui/play/MondrianScreen.kt`),
which read different article properties.

## Run

Plain HTML, CSS and ES modules, with no build step. Serve the folder over HTTP
(any static server works):

```bash
python3 serve.py   # like http.server, but with caching off so reloads pick up edits
```

## Files

- `js/painting.js`: the layout (streets, squares and blocks on a grid, seeded by the titles)
- `js/synth.js`: article properties to sound, and the Web Audio voice
- `js/wiki.js`: per article, an Action API request (title, thumbnail) and the Attribution API's trust signals; search
- `js/scales.js`: pitches and moods, and the notes each size and colour plays
- `js/infinity.js`: the infinity-track slider behind Pitch
- `js/knob.js`: the notched knob behind Mood
- `js/pedal.js`: each article card's pedal face: a knob beside its sound and the sound drawn on a display
- `js/mood-pictures.js`: each mood's picture on the knob, from Wikimedia Commons, with its credit
- `js/app.js`: UI, article picker, pitch, mood and octave, share link
