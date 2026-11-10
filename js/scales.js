// Pitch and mood: which notes the painting's four colours play. The pitch is
// the home note (yellow); the mood is which three notes go with it (red, blue
// and grey), each mood a set that always sounds good together. Each size of
// shape plays them in its own octave: large blocks two below the home note's,
// medium blocks one below, small blocks in it, and the squares one above. The
// painting itself never changes with pitch or mood; only the notes do.

export const KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/**
 * The moods, brightest first: semitones above the home note for yellow, red,
 * blue and grey. (In music terms each is a four-note chord: a major seventh,
 * major sixth, dominant seventh, whole-tone, minor sixth, minor seventh, minor
 * with a flat sixth, and diminished seventh.)
 */
export const MOODS = [
  { id: 'dreamy', name: 'Dreamy', steps: [0, 4, 7, 11] },
  { id: 'sunny', name: 'Sunny', steps: [0, 4, 7, 9] },
  { id: 'boogie', name: 'Boogie', steps: [0, 4, 7, 10] },
  { id: 'floaty', name: 'Floaty', steps: [0, 4, 6, 10] },
  { id: 'jazzy', name: 'Jazzy', steps: [0, 3, 7, 9] },
  { id: 'moody', name: 'Moody', steps: [0, 3, 7, 10] },
  { id: 'mysterious', name: 'Mysterious', steps: [0, 3, 7, 8] },
  { id: 'spooky', name: 'Spooky', steps: [0, 3, 6, 9] },
];

export const DEFAULT_KEY = 0; // C
export const DEFAULT_MOOD = 'sunny';

/** Short URL names for keys: C, Cs, D, Eb… */
const KEY_SLUGS = ['C', 'Cs', 'D', 'Eb', 'E', 'F', 'Fs', 'G', 'Ab', 'A', 'Bb', 'B'];
export const keySlug = (key) => KEY_SLUGS[key];
export const keyFromSlug = (slug) => {
  const i = KEY_SLUGS.findIndex((k) => k.toLowerCase() === (slug || '').toLowerCase());
  return i < 0 ? null : i;
};
export const moodById = (id) => MOODS.find((m) => m.id === id);

/** How many octaves the instrument can move down or up from where each key starts (see octaveAllowed). */
export const OCTAVE_SHIFTS = [-2, -1, 0, 1, 2];

/** Octaves below (and above) the root's that the four sizes play in, large blocks first. */
const REGISTER_OCTAVES = [-2, -1, 0, 1];

/** The lowest and highest MIDI notes the instrument may play: C1 (33 Hz) to C8. */
const LOWEST = 24;
const HIGHEST = 108;

/**
 * The octave the root is in (scientific pitch: C4 is middle C). With no shift,
 * roots C–F start at middle C's octave and F♯–B the octave below, so every key
 * sits in a similar range; [shift] moves that by whole octaves.
 */
export const rootOctave = (key, shift = 0) => 4 + shift - (key > 5 ? 1 : 0);

/**
 * The notes as MIDI numbers: [register][colour], registers large → square
 * (REGISTERS order) and colours in COLOURS order, lowest first in each.
 */
export function tonesFor(key, moodId, shift = 0) {
  const { steps } = moodById(moodId) || moodById(DEFAULT_MOOD);
  const root = 12 * (rootOctave(key, shift) + 1) + key;
  return REGISTER_OCTAVES.map((octave) => steps.map((step) => root + 12 * octave + step));
}

/** Whether [shift] keeps every note in the key audible: none below C1 or above C8. */
export function octaveAllowed(key, shift) {
  if (!OCTAVE_SHIFTS.includes(shift)) return false;
  const root = 12 * (rootOctave(key, shift) + 1) + key;
  // Every mood's notes lie within an octave of the home note (steps 0–11).
  return root + 12 * REGISTER_OCTAVES[0] >= LOWEST && root + 12 * REGISTER_OCTAVES[3] + 11 <= HIGHEST;
}

/** The nearest allowed shift to [shift] for [key] (toward the middle). */
export function nearestOctave(key, shift) {
  let s = shift;
  while (!octaveAllowed(key, s) && s !== 0) s += s > 0 ? -1 : 1;
  return s;
}

/** The lowest note's octave, which names the instrument's range: C2 when the squares reach C5. */
export const lowestOctave = (key, shift = 0) => rootOctave(key, shift) + REGISTER_OCTAVES[0];
