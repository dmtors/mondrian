// How article trust signals become sound, and a small Web Audio synth that plays it.
// The signals come from the Wikimedia Attribution API (see wiki.js).
//
// - Waveform: the more people have written the article, the richer the tone.
// - Filter: the more references it cites, the brighter the sound.
// - Envelope: the more it's read (page views, last 30 days), the longer each note rings.
// - Effect: the more recently it was updated, the more the note wobbles; a
//   trending article shimmers.

import { frequency } from './painting.js';

export const SoundMap = {
  /** A few writers → a pure sine … a big crowd → a sawtooth, full of harmonics. */
  waveform(contributors) {
    if (contributors >= 1500) return 'sawtooth';
    if (contributors >= 400) return 'square';
    if (contributors >= 100) return 'triangle';
    return 'sine';
  },
  /** 0 references → 250 Hz (muffled) … 400+ → 7 kHz (bright), on a log scale. */
  cutoff(references) {
    const t = clamp(Math.log10(references + 1) / Math.log10(401), 0, 1);
    return 250 * (7000 / 250) ** t;
  },
  /** 100 views a month or fewer → a short pluck (0.12 s) … a million+ → a long ring (2.2 s), on a log scale. */
  decay(pageViews) {
    const t = clamp((Math.log10(pageViews + 1) - 2) / 4, 0, 1);
    return 0.12 + t * 2.08;
  },
  /** Updated today → a wide wobble (45 cents) … a year or more ago → steady; trending → at least a shimmer (30 cents). */
  vibratoDepth(daysSinceUpdate, trending) {
    const freshness = daysSinceUpdate === null ? 0 : 1 - clamp(Math.log10(daysSinceUpdate + 1) / Math.log10(366), 0, 1);
    return Math.max(freshness * 45, trending ? 30 : 0);
  },
  /** Fresher pages wobble faster too: 4 Hz … 7 Hz; trending ones shimmer at 7.5 Hz. */
  vibratoRate(daysSinceUpdate, trending) {
    if (trending) return 7.5;
    const freshness = daysSinceUpdate === null ? 0 : 1 - clamp(Math.log10(daysSinceUpdate + 1) / Math.log10(366), 0, 1);
    return 4 + freshness * 3;
  },
};

/** The synth settings four articles make (by slot). */
export function soundOf(articles) {
  const { effect } = articles;
  return {
    waveform: SoundMap.waveform(articles.waveform.contributors),
    cutoffHz: SoundMap.cutoff(articles.filter.references),
    decaySec: SoundMap.decay(articles.envelope.pageViews),
    vibratoCents: SoundMap.vibratoDepth(effect.daysSinceUpdate, effect.trending),
    vibratoHz: SoundMap.vibratoRate(effect.daysSinceUpdate, effect.trending),
  };
}

/** Square and saw are much louder than sine at the same amplitude. */
const LOUDNESS = { sine: 1, triangle: 0.95, square: 0.5, sawtooth: 0.55 };

export class Synth {
  constructor() {
    this.ctx = null;
    this.sound = null;
  }

  /** Audio can only start after a gesture; call this from one. */
  wake() {
    if (!this.ctx) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 6;
      const master = ctx.createGain();
      master.gain.value = 0.9;
      compressor.connect(master).connect(ctx.destination);
      this.ctx = ctx;
      this.out = compressor;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSound(sound) {
    this.sound = sound;
  }

  /** One note, attack to silence: now, or at audio time [when] (the sequencer's). */
  strike(midi, when = null) {
    if (!this.sound) return;
    this.wake();
    const { ctx, sound } = this;
    const t = Math.max(when ?? 0, ctx.currentTime) + 0.005;
    const attack = 0.006;
    const length = attack + sound.decaySec * 1.6 + 0.03;

    const osc = ctx.createOscillator();
    osc.type = sound.waveform;
    osc.frequency.value = frequency(midi);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(sound.cutoffHz, ctx.sampleRate * 0.45);
    filter.Q.value = 0.7071;

    const env = ctx.createGain();
    const peak = 0.35 * LOUDNESS[sound.waveform];
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + attack);
    // Decay to −60 dB by decaySec; by the time the note stops (1.6× later) it's inaudible.
    env.gain.setTargetAtTime(0, t + attack, sound.decaySec / Math.log(1000));

    // Vibrato: an LFO swinging the pitch by ±vibratoCents.
    let lfo = null;
    if (sound.vibratoCents >= 0.5) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = sound.vibratoHz;
      const depth = ctx.createGain();
      depth.gain.value = sound.vibratoCents;
      lfo.connect(depth).connect(osc.detune);
      lfo.start(t);
      lfo.stop(t + length);
    }

    osc.connect(filter).connect(env).connect(this.out);
    // Tell whoever's listening (the cards' displays) when it sounds and how long it rings.
    this.onNote?.(t - ctx.currentTime, sound.decaySec);
    osc.start(t);
    osc.stop(t + length);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
      lfo?.disconnect();
    };
  }
}

/**
 * The sequencer's drums, synthesized (no samples): a kick, a sine dropping
 * fast from 150 Hz to 45 Hz with a short thump; a snare, a snappy crack of
 * bright noise over a quick tap; and a closed hi-hat, a tick of very bright
 * noise. They play through the same
 * compressor as the notes, whatever the articles' sound.
 */
Synth.prototype.drum = function drum(kind, when = null) {
  this.wake();
  const { ctx } = this;
  const t = Math.max(when ?? 0, ctx.currentTime) + 0.005;
  if (kind === 'kick') {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.9, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(env).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.4);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
    return;
  }
  // Noise, made once: the snare's rattle and the hi-hat.
  if (!this.noise) {
    const length = Math.floor(ctx.sampleRate * 0.3);
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  const parts = [];
  const noiseBurst = (filterType, frequency, q, gain, decay) => {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    noise.connect(filter).connect(env).connect(this.out);
    noise.start(t);
    noise.stop(t + decay + 0.02);
    parts.push(noise, filter, env);
    return noise;
  };
  if (kind === 'hat') {
    // A closed hi-hat: a very short tick of bright noise.
    const noise = noiseBurst('highpass', 7500, 0.7, 0.22, 0.045);
    noise.onended = () => parts.forEach((p) => p.disconnect());
    return;
  }
  // Snare: snappy. A short crack of bright noise (a band round 3.5 kHz over
  // a high-pass), and a quick pitched tap for the body, both gone in a
  // tenth of a second or so.
  noiseBurst('highpass', 1800, 0.7, 0.5, 0.12);
  noiseBurst('bandpass', 3500, 1.2, 0.35, 0.06);
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(240, t);
  body.frequency.exponentialRampToValueAtTime(160, t + 0.04);
  const bodyEnv = ctx.createGain();
  bodyEnv.gain.setValueAtTime(0.0001, t);
  bodyEnv.gain.exponentialRampToValueAtTime(0.4, t + 0.001);
  bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  body.connect(bodyEnv).connect(this.out);
  body.start(t);
  body.stop(t + 0.15);
  parts.push(body, bodyEnv);
  body.onended = () => parts.forEach((p) => p.disconnect());
};

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
