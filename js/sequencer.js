// The sequencer: a loop of sixteen steps played at a tempo you choose. Each
// step is a sixteenth note, so the loop is one bar of 4/4. A step can sound
// up to four notes at once, one in each size's row (as the painting plays
// them: large blocks lowest, squares highest), each in a colour, and under
// them a hi-hat, a snare and a kick drum; a step with none is a rest.
//
// The steps name sizes and colours, not pitches, so turning Pitch, Mood or
// Octave while it plays changes the tune in time, as it does the painting.
//
// Notes are scheduled on the audio clock a little ahead of time (the usual
// Web Audio look-ahead), so the beat stays steady even when the page is busy.

import { COLOURS } from './painting.js';

export const STEPS = 16;
export const ROWS = 4; // one per size: 0 large blocks … 3 squares
export const KICK = 4; // the drum lanes, after the notes'
export const SNARE = 5;
export const HAT = 6;
export const LANES = 7;
export const DRUM_NAMES = { [KICK]: 'kick', [SNARE]: 'snare', [HAT]: 'hat' };
/** The lanes top to bottom, as the piano roll shows them: squares … large blocks, then hi-hat, snare and kick. */
export const LANE_ORDER = [3, 2, 1, 0, HAT, SNARE, KICK];
export const isDrum = (lane) => lane >= ROWS;
export const TEMPO = { min: 60, max: 180, step: 0.5, bigStep: 5, initial: 110 }; // beats (quarter notes) a minute; Shift takes the big step

const LOOK_AHEAD = 0.12; // seconds of notes scheduled ahead
const TICK_MS = 25; // how often the scheduler looks

/**
 * A step with nothing in it. Steps are arrays of LANES: a colour (or null)
 * for each size's note, indexed by size, then true (or null) for the kick,
 * the snare and the hi-hat.
 */
export const restStep = () => Array(LANES).fill(null);

/** A step's notes, lowest first: [{ register, colour }]. */
export const notesOf = (step) => step.slice(0, ROWS).flatMap((colour, register) => (colour ? [{ register, colour }] : []));

/** A step's drums: some of 'kick', 'snare', 'hat'. */
export const drumsOf = (step) => [KICK, SNARE, HAT].filter((lane) => step[lane]).map((lane) => DRUM_NAMES[lane]);

/**
 * A new random loop that sounds like a tune rather than noise: it starts on
 * the home note, rests more often off the beat, walks between neighbouring
 * sizes (octaves) rather than leaping, and favours the home note. Now and
 * then, mostly on the beat, a step adds a second note in another row: the
 * home note below, or a note from the mood above, so some steps are chords.
 * The drums come from randomBeat.
 */
export function randomLoop(random = Math.random) {
  const pick = (weights) => {
    let r = random() * weights.reduce((a, b) => a + b, 0);
    return weights.findIndex((w) => (r -= w) < 0);
  };
  let register = 1 + Math.floor(random() * 2); // medium or small blocks
  // A beat to go with it (see randomBeat).
  const beat = randomBeat(random);
  const withBeat = (step, i) => {
    if (beat.kick[i]) step[KICK] = true;
    if (beat.snare[i]) step[SNARE] = true;
    if (beat.hat[i]) step[HAT] = true;
    return step;
  };
  return Array.from({ length: STEPS }, (_, i) => withBeat(makeStep(i), i));
  function makeStep(i) {
    const step = restStep();
    if (i === 0) {
      step[register] = 'yellow';
      if (register > 0) step[register - 1] = 'yellow'; // the loop opens on the home note, doubled below
      return step;
    }
    const restChance = i % 4 === 0 ? 0.08 : i % 2 === 0 ? 0.3 : 0.5;
    if (random() < restChance) return step;
    // Mostly stay in the same size; sometimes step up or down one.
    const move = pick([1, 4, 1]) - 1;
    register = Math.min(3, Math.max(0, register + move));
    if (register === 0 && random() < 0.5) register = 1; // the large blocks are deep: sparingly
    step[register] = COLOURS[pick([3, 2, 2, 1.5])];
    const chordChance = i % 4 === 0 ? 0.35 : 0.08;
    if (random() < chordChance) {
      if (register > 0 && random() < 0.6) step[register - 1] = 'yellow'; // the home note underneath
      else if (register < ROWS - 1) step[register + 1] = COLOURS[1 + Math.floor(random() * 3)]; // a mood note on top
    }
    return step;
  }
}

// Drum patterns, sixteen steps each (x a hit). A groove pairs a kick with a
// snare; the hi-hats are chosen apart from it, so any groove can have any
// hats.
const GROOVES = [
  { kick: 'x.......x.......', snare: '....x.......x...' }, // backbeat
  { kick: 'x...x...x...x...', snare: '....x.......x...' }, // four on the floor
  { kick: 'x..x......x..x..', snare: '....x.......x...' }, // funk
  { kick: 'x.......x.x.....', snare: '....x.......x..x' }, // push
  { kick: 'x..x..x...x.....', snare: '....x.......x...' }, // tresillo
  { kick: 'x...............', snare: '........x.......' }, // sparse
  { kick: 'x.........x.....', snare: '....x.......x...' }, // breakbeat
  { kick: 'x.....x...x.....', snare: '....x.......x...' }, // two-step
  { kick: 'x.....x.........', snare: '........x.......' }, // half time
  { kick: 'x...x...x...x...', snare: '...x..x....x..x.' }, // dembow
];
// Hi-hat patterns, sparse to busy.
const HATS = [
  '................', // none
  'x...x...x...x...', // quarters
  '..x...x...x...x.', // off-beats
  'x..x..x.x..x..x.', // shuffle
  'x.x.x.x.x.x.x.x.', // eighths
  'x.xxx.xxx.xxx.xx', // gallop
  'xx.xxx.xxx.xxx.x', // busy
  'xxxxxxxxxxxxxxxx', // sixteenths
];
const hits = (pattern) => [...pattern].map((c) => c === 'x');


/**
 * A random beat: { kick, snare, hat }, each sixteen true/false. A groove and
 * a hat pattern picked at random, then roughed up so no two are quite
 * alike: an extra kick or two, ghost snares before the backbeat, a fill on
 * the last beat, hats dropped here and added there.
 */
export function randomBeat(random = Math.random) {
  const pickOne = (list) => list[Math.floor(random() * list.length)];
  const groove = pickOne(GROOVES);
  const kick = hits(groove.kick);
  const snare = hits(groove.snare);
  const hat = hits(pickOne(HATS));
  const empty = (i) => !kick[i] && !snare[i];
  // Extra kicks, off the beat.
  const extraKicks = Math.floor(random() * 3); // 0–2
  for (let n = 0; n < extraKicks; n++) {
    const i = pickOne([2, 3, 6, 7, 10, 11, 14, 15]);
    if (empty(i)) kick[i] = true;
  }
  // Now and then drop a kick (never the first).
  if (random() < 0.2) {
    const others = kick.map((on, i) => (on && i ? i : -1)).filter((i) => i > 0);
    if (others.length) kick[pickOne(others)] = false;
  }
  // Ghost snares: a quick hit just before a backbeat.
  if (random() < 0.4) snare.forEach((on, i) => on && i > 0 && random() < 0.5 && empty(i - 1) && (snare[i - 1] = true));
  // A fill: snares through the last beat.
  if (random() < 0.15) [13, 14, 15].forEach((i) => random() < 0.7 && (snare[i] = true));
  // Hats: some dropped, some added.
  for (let i = 0; i < STEPS; i++) {
    if (hat[i] && random() < 0.12) hat[i] = false;
    else if (!hat[i] && random() < 0.06) hat[i] = true;
  }
  return { kick, snare, hat };
}

const letter = ({ register, colour }) => String.fromCharCode(97 + register * 4 + COLOURS.indexOf(colour));
const fromLetter = (c) => {
  const n = c.charCodeAt(0) - 97;
  return { register: Math.floor(n / 4), colour: COLOURS[n % 4] };
};

/**
 * A loop for a link: its sixteen steps joined by dots, each step the letters
 * of its notes (a–p: size × 4 + colour), then K for a kick, S for a snare
 * and H for a hi-hat; a rest is nothing: "fjKH.b..kSH…".
 */
export function encodeLoop(loop) {
  return loop.map((step) => notesOf(step).map(letter).join('') + (step[KICK] ? 'K' : '') + (step[SNARE] ? 'S' : '') + (step[HAT] ? 'H' : '')).join('.');
}

/** The loop a link spells, or null if it isn't one. Also reads the older one-note-a-step form ("i--l…"). */
export function decodeLoop(text) {
  if (!text) return null;
  let steps;
  if (/^[a-p-]{16}$/.test(text)) steps = [...text].map((c) => (c === '-' ? '' : c));
  else {
    steps = text.split('.');
    if (steps.length !== STEPS || !steps.every((s) => /^[a-pKSH]*$/.test(s))) return null;
  }
  return steps.map((letters) => {
    const step = restStep();
    [...letters].forEach((c) => {
      if (c === 'K') step[KICK] = true;
      else if (c === 'S') step[SNARE] = true;
      else if (c === 'H') step[HAT] = true;
      else {
        const { register, colour } = fromLetter(c);
        step[register] = colour;
      }
    });
    return step;
  });
}

export const clampTempo = (bpm) => Math.min(TEMPO.max, Math.max(TEMPO.min, Math.round(bpm / TEMPO.step) * TEMPO.step));

/** A tempo as the readout shows it, always to a tenth: 110.0, 110.5. */
export const tempoText = (bpm) => bpm.toFixed(1);

/**
 * The loop after tapping step [index] in [register]'s row: an empty row gets
 * a yellow note (beside any others in the step, so they sound together); a
 * note turns to the next colour, and past grey, goes.
 */
export function editStep(loop, index, register) {
  const next = loop.slice();
  const step = loop[index].slice();
  if (isDrum(register)) {
    // A drum is on or off.
    step[register] = step[register] ? null : true;
    next[index] = step;
    return next;
  }
  const colour = step[register];
  if (!colour) step[register] = COLOURS[0];
  else {
    const c = COLOURS.indexOf(colour);
    step[register] = c === COLOURS.length - 1 ? null : COLOURS[c + 1];
  }
  next[index] = step;
  return next;
}

/**
 * Plays [loop] round and round on [ctx] (an AudioContext, from [getContext]
 * once audio has woken). [play](note, when) sounds one of a step's notes at audio time
 * [when]; [onStep](index, delayMs) runs for each step, [delayMs] before it
 * sounds, to light it up in time.
 */
export class Sequencer {
  constructor({ getContext, play, drum, onStep }) {
    this.getContext = getContext;
    this.play = play;
    this.drum = drum;
    this.onStep = onStep;
    this.loop = randomLoop();
    this.tempo = TEMPO.initial;
    this.timer = 0;
    this.next = 0; // the step to schedule next
    this.nextTime = 0; // when it sounds, on the audio clock
  }

  get playing() {
    return Boolean(this.timer);
  }

  /** Seconds a step lasts: a sixteenth note. */
  get stepLength() {
    return 60 / this.tempo / 4;
  }

  start() {
    if (this.timer) return;
    const ctx = this.getContext();
    this.next = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
  }

  schedule() {
    const ctx = this.getContext();
    // Fallen far behind (the tab was hidden, say): pick up from now rather than rush to catch up.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02;
    while (this.nextTime < ctx.currentTime + LOOK_AHEAD) {
      notesOf(this.loop[this.next]).forEach((note) => this.play(note, this.nextTime));
      drumsOf(this.loop[this.next]).forEach((drum) => this.drum(drum, this.nextTime));
      this.onStep(this.next, Math.max(0, (this.nextTime - ctx.currentTime) * 1000));
      this.next = (this.next + 1) % STEPS;
      this.nextTime += this.stepLength;
    }
  }
}
