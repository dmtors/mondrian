// Keys and scales: which nine notes the painting's rectangles play, lowest
// (biggest rectangle) to highest. The painting itself never changes with the
// key; only the notes do.

export const KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Semitones above the root for one octave of each scale. */
export const SCALES = [
  { id: 'major-pentatonic', name: 'Major pentatonic', steps: [0, 2, 4, 7, 9] },
  { id: 'minor-pentatonic', name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  { id: 'blues', name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  { id: 'major', name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'harmonic-minor', name: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'dorian', name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'hirajoshi', name: 'Hirajōshi', steps: [0, 2, 3, 7, 8] },
  { id: 'whole-tone', name: 'Whole tone', steps: [0, 2, 4, 6, 8, 10] },
];

export const DEFAULT_KEY = 0; // C
export const DEFAULT_SCALE = 'major-pentatonic';

/** Short URL names for keys: C, Cs, D, Eb… */
const KEY_SLUGS = ['C', 'Cs', 'D', 'Eb', 'E', 'F', 'Fs', 'G', 'Ab', 'A', 'Bb', 'B'];
export const keySlug = (key) => KEY_SLUGS[key];
export const keyFromSlug = (slug) => {
  const i = KEY_SLUGS.findIndex((k) => k.toLowerCase() === (slug || '').toLowerCase());
  return i < 0 ? null : i;
};
export const scaleById = (id) => SCALES.find((s) => s.id === id);

/** How many octaves the instrument can move down or up from where each key starts. */
export const OCTAVE_SHIFTS = [-2, -1, 0, 1, 2];

/**
 * The octave the root is in (scientific pitch: C4 is middle C). With no shift,
 * roots C–F start at middle C's octave and F♯–B the octave below, so every key
 * sits in a similar range; [shift] moves that by whole octaves.
 */
export const rootOctave = (key, shift = 0) => 4 + shift - (key > 5 ? 1 : 0);

/** Nine MIDI notes, ascending through the scale from the root. */
export function notesFor(key, scaleId, shift = 0) {
  const { steps } = scaleById(scaleId) || scaleById(DEFAULT_SCALE);
  const root = 12 * (rootOctave(key, shift) + 1) + key;
  return Array.from({ length: 9 }, (_, i) => root + 12 * Math.floor(i / steps.length) + steps[i % steps.length]);
}
