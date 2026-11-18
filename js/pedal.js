// Each article card's pedal face: a knob turned to the article's value, and
// a small display that draws the slot's part of the sound. They read
// the same article properties the synth does (see SoundMap in synth.js), so
// what the pedal shows is what you hear.
//
//  - Waveform: two cycles of the wave itself.
//  - Filter: the low-pass curve, flat up to the cutoff, then falling away.
//  - Envelope: the strike and its decay, as long as the note rings.
//  - Effect: the wobble, as deep and as fast as the vibrato.
//
// While a note rings, the displays move a little (pulsePedals): the waveform
// and the wobble slide along, the filter's curve lifts and the envelope
// swells, settling as the note fades.

import { SoundMap } from './synth.js';

const W = 56; // the display, in its own units (as its CSS size)
const H = 32;
const MID = H / 2;
const PAD = 4;

/** The knob, icon-sized, leads the sound line; the display sits on the card's right. */
export const KNOB_MARKUP = `<span class="pedal-knob" aria-hidden="true"><span class="pedal-knob-pointer"></span></span>`;
export const SCREEN_MARKUP = `<span class="pedal" aria-hidden="true">
  <svg class="pedal-screen" viewBox="0 0 ${W} ${H}"><path class="pedal-trace" d=""/></svg>
</span>`;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const path = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

/** Samples f(t) for t in 0–1 across the display; f returns −1 (bottom) to 1 (top). */
function trace(f, steps = 112) {
  const span = W - 2 * PAD;
  const amp = MID - PAD;
  return path(Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [PAD + t * span, MID - clamp(f(t), -1, 1) * amp];
  }));
}

const WAVES = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  triangle: (p) => 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5),
  square: (p) => (p % 1 < 0.5 ? 0.85 : -0.85),
  sawtooth: (p) => 1 - 2 * (p % 1),
};

/**
 * What a slot's pedal shows for an article: the display's trace and the
 * knob's turn (0 fully left to 1 fully right). [motion] moves the trace
 * while a note rings (see pulsePedals): [phase] slides the waveform and the
 * wobble along, and [energy] (1 as a note strikes, falling to 0 as it fades)
 * lifts the filter's curve and swells the envelope's. At rest it's 0, 0.
 */
export function pedalFor(slot, a, { phase = 0, energy = 0 } = {}) {
  switch (slot) {
    case 'waveform': {
      const wave = SoundMap.waveform(a.contributors);
      return { trace: trace((t) => WAVES[wave](t * 2 + phase)), turn: ['sine', 'triangle', 'square', 'sawtooth'].indexOf(wave) / 3 };
    }
    case 'filter': {
      const cutoff = SoundMap.cutoff(a.references);
      const at = Math.log(cutoff / 250) / Math.log(7000 / 250); // where the cutoff sits, 0–1
      const knee = 0.12 + at * 0.76;
      const level = 0.7 + 0.15 * energy;
      return { trace: trace((t) => (t < knee ? level : level - 2.6 * (t - knee) / (1 - knee + 0.25))), turn: at };
    }
    case 'envelope': {
      const decay = SoundMap.decay(a.pageViews);
      const length = clamp(decay / 2.3, 0.05, 1); // of the display's width
      const height = 2 * (0.85 + 0.15 * energy);
      return { trace: trace((t) => (t < 0.04 ? -1 + (height / 0.04) * t : -1 + height * Math.exp(-((t - 0.04) / length) * 4.6))), turn: (decay - 0.12) / 2.08 };
    }
    case 'effect': {
      const depth = SoundMap.vibratoDepth(a.daysSinceUpdate, a.trending); // cents, 0–45
      const rate = SoundMap.vibratoRate(a.daysSinceUpdate, a.trending); // Hz
      const amp = Math.max(0.06, depth / 45) * 0.9;
      return { trace: trace((t) => amp * Math.sin(2 * Math.PI * (t * (rate / 1.5) + phase))), turn: depth / 45 };
    }
  }
  return { trace: '', turn: 0 };
}

// The cards' displays move a little while a note rings: one shared motion
// for all four, nudged by every note the synth plays (see pulsePedals).
const motion = { phase: 0, energy: 0, fade: 0.3 };
const shown = new Map(); // card → { slot, article }: what each display shows, to redraw as it moves
let frame = 0;
let last = 0;

function paint(card) {
  const { slot, article } = shown.get(card);
  const face = article ? pedalFor(slot, article, motion) : { trace: '', turn: 0 };
  card.querySelector('.pedal-trace').setAttribute('d', face.trace);
  card.querySelector('.pedal-knob').style.setProperty('--turn', String(clamp(face.turn, 0, 1)));
}

/** Sets a card's knob and display for [article], or blank (knob down) while there's none. */
export function drawPedal(card, slot, article) {
  shown.set(card, { slot, article });
  paint(card);
}

const stillPlease = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * A note just sounded, ringing for about [ringSec]: the displays come alive,
 * sliding and lifting, and settle as it fades. (Not for anyone who asks for
 * less motion.)
 */
export function pulsePedals(ringSec = 1) {
  if (stillPlease.matches) return;
  motion.energy = 1;
  motion.fade = Math.max(0.12, ringSec / 3); // seconds to fall to about a third
  if (frame) return;
  last = performance.now();
  frame = requestAnimationFrame(step);
}

function step(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  motion.phase = (motion.phase + dt * 1.2 * motion.energy) % 1; // up to 1.2 cycles a second, slowing as it fades
  motion.energy *= Math.exp(-dt / motion.fade);
  if (motion.energy < 0.01) motion.energy = 0;
  shown.forEach((_, card) => paint(card));
  frame = motion.energy ? requestAnimationFrame(step) : 0;
}
