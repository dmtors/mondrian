// How article properties become sound, and a small Web Audio synth that plays it.
//
// - Waveform: the article's broad topic picks the oscillator.
// - Filter: how many pages link to it sets the brightness (low-pass cutoff).
// - Envelope: how old it is sets the decay (older, longer).
// - Effect: how often it's edited sets the vibrato (busier, wobblier).

import { frequency } from './painting.js';

export const SoundMap = {
  waveform(topic) {
    if (topic === 'STEM') return 'square';
    if (topic === 'Culture') return 'sawtooth';
    if (topic === 'Geography') return 'triangle';
    return 'sine'; // History and society, or unknown
  },
  /** 0 links → 250 Hz (muffled) … 30,000+ links → 7 kHz (bright), on a log scale. */
  cutoff(links) {
    const t = clamp(Math.log10(links + 1) / Math.log10(30000), 0, 1);
    return 250 * (7000 / 250) ** t;
  },
  /** New → a short pluck (0.12 s) … 24+ years → a long ring (2.2 s). */
  decay(ageYears) {
    return 0.12 + clamp(ageYears / 24, 0, 1) * 2.08;
  },
  /** No edits this month → steady … 50+ → a wide wobble (45 cents). */
  vibratoDepth(edits) {
    return clamp(Math.log10(edits + 1) / Math.log10(51), 0, 1) * 45;
  },
  /** Busier pages wobble faster too: 4 Hz … 7 Hz. */
  vibratoRate(edits) {
    return 4 + clamp(edits / 50, 0, 1) * 3;
  },
};

/** The synth settings four articles make (by slot). */
export function soundOf(articles) {
  return {
    waveform: SoundMap.waveform(articles.waveform.topic),
    cutoffHz: SoundMap.cutoff(articles.filter.incomingLinks),
    decaySec: SoundMap.decay(articles.envelope.ageYears),
    vibratoCents: SoundMap.vibratoDepth(articles.effect.editsLastMonth),
    vibratoHz: SoundMap.vibratoRate(articles.effect.editsLastMonth),
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

  /** One note, attack to silence. */
  strike(midi) {
    if (!this.sound) return;
    this.wake();
    const { ctx, sound } = this;
    const t = ctx.currentTime + 0.005;
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

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
