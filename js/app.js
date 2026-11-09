import { SLOTS, NOTES, paint } from './painting.js';
import { KEYS as KEY_NAMES, SCALES, OCTAVE_SHIFTS, DEFAULT_KEY, DEFAULT_SCALE, notesFor, rootOctave, keySlug, keyFromSlug, scaleById } from './scales.js';
import { Synth, SoundMap, soundOf } from './synth.js';
import { articleSignals, search, articleUrl, SURPRISES, STARTER } from './wiki.js';

const LABELS = { waveform: 'Waveform', filter: 'Filter', envelope: 'Envelope', effect: 'Effect' };
const HINTS = {
  waveform: 'The article’s topic picks the tone. Science and technology are square, culture is sawtooth, geography is triangle, history and society are sine.',
  filter: 'The more pages link to the article, the brighter the sound.',
  envelope: 'The older the article, the longer each note rings.',
  effect: 'The more it’s been edited this month, the more the note wobbles.',
};
/** The hash keys a shared link uses for each slot. */
const HASH_KEYS = { waveform: 'w', filter: 'f', envelope: 'e', effect: 'x' };
/** Keys A–L play the notes, lowest to highest. */
const KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'];

const $ = (id) => document.getElementById(id);
const synth = new Synth();

const state = {
  titles: {}, // slot → title (drives the painting, even before the article loads)
  articles: {}, // slot → what was read from the article (drives the sound)
  loading: new Set(),
  failed: new Set(),
  key: DEFAULT_KEY, // 0–11, C to B
  scale: DEFAULT_SCALE,
  shift: 0, // octaves up or down from where the key starts
  notes: notesFor(DEFAULT_KEY, DEFAULT_SCALE), // what each rectangle plays, by index
};

const titleList = () => SLOTS.map((s) => state.titles[s]);
const sameTitles = (a, b) => a.every((t, i) => t === b[i]);

// ---------- Patch ----------

function titlesFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const titles = SLOTS.map((s) => params.get(HASH_KEYS[s])?.trim());
  return titles.every(Boolean) ? titles : null;
}

function writeHash() {
  const params = new URLSearchParams();
  SLOTS.forEach((s) => params.set(HASH_KEYS[s], state.titles[s]));
  // The key and scale only go in the link when they're not the default.
  if (state.key !== DEFAULT_KEY || state.scale !== DEFAULT_SCALE) {
    params.set('k', keySlug(state.key));
    params.set('s', state.scale);
  }
  if (state.shift) params.set('o', String(state.shift));
  history.replaceState(null, '', `#${params.toString().replace(/\+/g, '%20')}`);
}

/** The key and scale in the link, or the default. */
function tuningFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const key = keyFromSlug(params.get('k'));
  const scale = scaleById(params.get('s'))?.id;
  const shift = Number(params.get('o'));
  return { key: key ?? DEFAULT_KEY, scale: scale ?? DEFAULT_SCALE, shift: OCTAVE_SHIFTS.includes(shift) ? shift : 0 };
}

function setTuning({ key, scale, shift }) {
  state.key = key;
  state.scale = scale;
  state.shift = shift;
  state.notes = notesFor(key, scale, shift);
  $('key').value = String(key);
  $('scale').value = scale;
  // The octave is named by the note the instrument starts on: A2, A3, A4…
  $('octave').textContent = `${KEY_NAMES[key]}${rootOctave(key, shift)}`;
  $('octave-down').disabled = shift <= OCTAVE_SHIFTS[0];
  $('octave-up').disabled = shift >= OCTAVE_SHIFTS[OCTAVE_SHIFTS.length - 1];
  updateReset();
}

/** Load four articles at once (a whole new painting). */
/** True when the instrument is the starter patch in the default tuning. */
const isDefault = () =>
  sameTitles(titleList(), STARTER) && state.key === DEFAULT_KEY && state.scale === DEFAULT_SCALE && state.shift === 0;

const updateReset = () => ($('reset').disabled = isDefault());

/** Back to the starter articles (each slot's own article) and C major pentatonic, octave 4. */
function reset() {
  if (isDefault()) return;
  setTuning({ key: DEFAULT_KEY, scale: DEFAULT_SCALE, shift: 0 });
  usePatch(STARTER);
  toast('Back to the default sound');
}

function usePatch(titles) {
  SLOTS.forEach((slot, i) => (state.titles[slot] = titles[i]));
  writeHash();
  render();
  SLOTS.forEach((slot, i) => setSlot(slot, titles[i]));
}

async function setSlot(slot, title) {
  const previous = state.titles[slot];
  state.titles[slot] = title;
  state.loading.add(slot);
  state.failed.delete(slot);
  render();
  let article = null;
  let error = false;
  try {
    article = await articleSignals(title);
  } catch {
    error = true;
  }
  // A newer pick for this slot arrived while this one loaded: let it win.
  if (state.titles[slot] !== title) return;
  state.loading.delete(slot);
  if (article) {
    state.titles[slot] = article.title;
    state.articles[slot] = article;
  } else if (error) {
    state.failed.add(slot);
    toast('Couldn’t reach Wikipedia. Check your connection and try again.');
  } else {
    toast(`Couldn’t find an article called “${title}”.`);
    if (state.articles[slot]) state.titles[slot] = state.articles[slot].title;
    else if (previous && previous !== title) return setSlot(slot, previous);
    else return setSlot(slot, pickSurprise());
  }
  writeHash();
  updateSound();
  render();
}

function updateSound() {
  if (SLOTS.every((s) => state.articles[s] && state.articles[s].title === state.titles[s])) {
    synth.setSound(soundOf(state.articles));
  }
}

function pickSurprise() {
  const taken = new Set(titleList());
  const pool = SURPRISES.filter((t) => !taken.has(t));
  return pool[Math.floor(Math.random() * pool.length)];
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * The die: four surprise articles and a random key, scale and octave. The
 * octave stays within one of the middle so the notes never go thin or muddy.
 */
let rolls = 0;
async function newSound() {
  const roll = ++rolls;
  synth.wake(); // while the click still counts as the user's gesture
  setTuning({ key: Math.floor(Math.random() * 12), scale: pick(SCALES).id, shift: pick([-1, 0, 1]) });
  writeHash();
  await surprise();
  // Once the new articles have shaped the sound, play it (unless the die was rolled again).
  if (roll === rolls) preview();
}

function surprise(slots = SLOTS) {
  return Promise.all(slots.map((slot) => setSlot(slot, pickSurprise())));
}

// ---------- Rendering ----------

let blocks = [];

/** Width of the lines between rectangles: the same --rule as the card and input borders. */
const lineWidth = (svg) => parseFloat(getComputedStyle(svg).getPropertyValue('--rule')) || 2;

function render() {
  updateReset();
  renderPainting();
  renderSlots();
  renderCredits();
}

const SVG = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/** Builds the nine (block + flash) pairs once; later renders only move them. */
function paintingSkeleton(svg) {
  svg.replaceChildren();
  const group = svgEl('g');
  NOTES.forEach(() => group.append(svgEl('rect', { class: 'block' }), svgEl('rect', { class: 'flash' })));
  svg.append(group);
  return group;
}

/**
 * Stretches the unit-square painting over the whole SVG, in its own pixels.
 * Lines run only between rectangles: the outer ones reach the edge of the window.
 */
function layoutPainting(svg, group, painted) {
  const { width: W, height: H } = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const half = lineWidth(svg) / 2;
  const inset = (v) => (v <= 0.0001 || v >= 0.9999 ? 0 : half);
  const rects = group.querySelectorAll('.block');
  const flashes = group.querySelectorAll('.flash');
  painted.forEach((b, i) => {
    const x = b.l * W + inset(b.l);
    const y = b.t * H + inset(b.t);
    const geometry = {
      x,
      y,
      width: Math.max(0, b.r * W - inset(b.r) - x),
      height: Math.max(0, b.b * H - inset(b.b) - y),
    };
    // As CSS properties too, so changes animate where the browser supports it.
    for (const el of [rects[i], flashes[i]]) {
      Object.entries(geometry).forEach(([k, v]) => {
        el.setAttribute(k, v.toFixed(1));
        el.style[k] = `${v.toFixed(1)}px`;
      });
    }
    rects[i].dataset.paint = b.paint;
    rects[i].dataset.note = b.note;
  });
}

let paintingGroup = null;
function renderPainting() {
  const svg = $('painting');
  if (!paintingGroup) {
    paintingGroup = paintingSkeleton(svg);
    // Follow the window: resizing redraws at once, without the change animation.
    let settle;
    new ResizeObserver(() => {
      svg.classList.add('resizing');
      layoutPainting(svg, paintingGroup, blocks);
      clearTimeout(settle);
      settle = setTimeout(() => svg.classList.remove('resizing'), 150);
    }).observe(svg);
  }
  blocks = paint(titleList());
  layoutPainting(svg, paintingGroup, blocks);
}

function readout(slot, a) {
  const n = (x) => x.toLocaleString();
  switch (slot) {
    case 'waveform': {
      const topic = { STEM: 'Science', Culture: 'Culture', Geography: 'Geography', History_and_Society: 'History' }[a.topic] || 'No topic';
      return `${topic}, ${SoundMap.waveform(a.topic)}`;
    }
    case 'filter': {
      const cutoff = SoundMap.cutoff(a.incomingLinks);
      const feel = cutoff < 800 ? 'muffled' : cutoff < 2500 ? 'warm' : cutoff < 5000 ? 'bright' : 'brilliant';
      return `${n(a.incomingLinks)} links, ${feel}`;
    }
    case 'envelope': {
      const decay = SoundMap.decay(a.ageYears);
      const feel = decay < 0.45 ? 'short pluck' : decay < 1.2 ? 'medium ring' : 'long ring';
      return `${a.createdYear ? `Since ${a.createdYear}` : 'Age unknown'}, ${feel}`;
    }
    case 'effect': {
      const depth = SoundMap.vibratoDepth(a.editsLastMonth);
      const feel = depth < 1 ? 'steady' : depth < 15 ? 'light wobble' : depth < 30 ? 'wobble' : 'lots of wobble';
      const edits = a.editsLastMonth >= 50 ? '50+' : n(a.editsLastMonth);
      return `${edits} ${a.editsLastMonth === 1 ? 'edit' : 'edits'} this month, ${feel}`;
    }
  }
}

function renderSlots() {
  const container = $('slots');
  if (!container.children.length) {
    SLOTS.forEach((slot) => {
      const card = document.createElement('button');
      card.className = 'slot';
      card.dataset.slot = slot;
      card.innerHTML = `
        <span class="slot-label">${LABELS[slot]}</span>
        <span class="slot-title"></span>
        <span class="slot-readout"></span>
        <img class="thumb" alt="">`;
      card.addEventListener('click', () => openPicker(slot));
      container.append(card);
    });
  }
  SLOTS.forEach((slot) => {
    const card = container.querySelector(`[data-slot="${slot}"]`);
    const article = state.articles[slot];
    const loading = state.loading.has(slot);
    card.classList.toggle('loading', loading);
    const thumb = card.querySelector('.thumb');
    const src = article && article.title === state.titles[slot] ? article.thumbnail : null;
    if (src) { if (thumb.getAttribute('src') !== src) thumb.src = src; } else thumb.removeAttribute('src');
    card.querySelector('.slot-title').textContent = state.titles[slot] || '…';
    card.querySelector('.slot-readout').textContent = state.failed.has(slot)
      ? 'Couldn’t load. Tap to choose again.'
      : article && article.title === state.titles[slot]
        ? readout(slot, article)
        : 'Reading the article…';
    const label = card.querySelector('.slot-label');
    label.querySelector('.spinner')?.remove();
    if (loading) label.append(Object.assign(document.createElement('span'), { className: 'spinner' }));
    card.setAttribute('aria-label', `${LABELS[slot]}: ${state.titles[slot]}. ${card.querySelector('.slot-readout').textContent} Change article.`);
  });
}

function renderCredits() {
  const links = SLOTS.map((s) => {
    const title = state.titles[s] || '';
    return `<a href="${articleUrl(title)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`;
  });
  $('credits').innerHTML = `This instrument is made from the Wikipedia articles ${links.slice(0, 3).join(', ')} and ${links[3]}. Article data from Wikipedia, available under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.`;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- Playing ----------

function strike(index) {
  const block = blocks[index];
  if (!block) return;
  synth.strike(state.notes[index]);
  const flash = paintingGroup.querySelectorAll('.flash')[index];
  flash.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
}

function blockAt(event) {
  const box = $('painting').getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width;
  const y = (event.clientY - box.top) / box.height;
  return blocks.find((b) => x >= b.l && x <= b.r && y >= b.t && y <= b.b);
}

// Every finger (or the mouse) plays on its own: a note when it lands, then each new rectangle it slides into.
const pointers = new Map();
function touch(event) {
  const block = blockAt(event);
  const index = block ? block.index : -1;
  if (pointers.get(event.pointerId) === index) return;
  pointers.set(event.pointerId, index);
  if (block) strike(index);
}

function setUpPlaying() {
  const svg = $('painting');
  svg.addEventListener('pointerdown', (e) => {
    synth.wake();
    svg.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, null);
    touch(e);
    if (!synth.sound) toast('Still reading the articles…');
  });
  svg.addEventListener('pointermove', (e) => pointers.has(e.pointerId) && touch(e));
  const lift = (e) => pointers.delete(e.pointerId);
  svg.addEventListener('pointerup', lift);
  svg.addEventListener('pointercancel', lift);

  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select')) return;
    // − and + (with or without Shift, or on the number pad) move the octave.
    const octave = { '-': 'octave-down', _: 'octave-down', '+': 'octave-up', '=': 'octave-up' }[e.key];
    if (octave) {
      e.preventDefault();
      $(octave).click(); // does nothing at the limit, where the button is disabled
      return;
    }
    const index = KEYS.indexOf(e.code);
    if (index < 0) return;
    e.preventDefault();
    synth.wake();
    strike(index);
  });
}

// ---------- Picker ----------

let pickerSlot = null;
let searchTimer = 0;
let searchAbort = null;

function openPicker(slot) {
  pickerSlot = slot;
  $('picker-title').textContent = LABELS[slot];
  $('picker-hint').textContent = HINTS[slot];
  $('picker-search').value = '';
  $('picker-results').replaceChildren();
  $('picker').showModal();
  $('picker-search').focus();
}

function choose(title) {
  $('picker').close();
  if (title && pickerSlot) setSlot(pickerSlot, title);
}

function showResults(results, text) {
  const list = $('picker-results');
  list.replaceChildren();
  if (!results.length && text) {
    list.innerHTML = `<li class="empty">No articles start with “${escapeHtml(text)}”.</li>`;
    return;
  }
  results.forEach((r) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<img class="thumb" alt="" loading="lazy"><span class="text"><span class="title"></span><span class="description"></span></span>`;
    if (r.thumbnail) button.querySelector('.thumb').src = r.thumbnail;
    button.querySelector('.title').textContent = r.title;
    button.querySelector('.description').textContent = r.description;
    button.addEventListener('click', () => choose(r.title));
    li.append(button);
    list.append(li);
  });
}

function setUpPicker() {
  const input = $('picker-search');
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchAbort?.abort();
    const text = input.value.trim();
    if (!text) return showResults([], '');
    searchTimer = setTimeout(async () => {
      searchAbort = new AbortController();
      try {
        showResults(await search(text, searchAbort.signal), text);
      } catch (e) {
        if (e.name !== 'AbortError') $('picker-results').innerHTML = '<li class="empty">Couldn’t search. Check your connection.</li>';
      }
    }, 200);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = $('picker-results').querySelector('.title');
    choose(first ? first.textContent : input.value.trim());
  });
  $('picker-surprise').addEventListener('click', () => {
    $('picker').close();
    surprise([pickerSlot]);
  });
}

// ---------- Key and scale

/** Lets a new sound be heard: a quick run up the first five notes. */
function preview() {
  [0, 1, 2, 3, 4].forEach((i) => setTimeout(() => strike(i), i * 110));
}

function setUpTuning() {
  KEY_NAMES.forEach((name, i) => $('key').append(new Option(name, String(i))));
  SCALES.forEach((scale) => $('scale').append(new Option(scale.name, scale.id)));
  const change = (shift = state.shift) => {
    setTuning({ key: Number($('key').value), scale: $('scale').value, shift });
    writeHash();
    synth.wake();
    preview();
  };
  $('key').addEventListener('change', () => change());
  $('scale').addEventListener('change', () => change());
  $('octave-down').addEventListener('click', () => change(state.shift - 1));
  $('octave-up').addEventListener('click', () => change(state.shift + 1));
}

// ---------- Sharing ----------

/** Copy a link that reopens this painting, sound and tuning. */
async function share() {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied. Anyone who opens it gets this painting and sound.');
  } catch {
    prompt('Copy this link:', url);
  }
}

// ---------- Toast ----------

let toastTimer = 0;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- Start ----------

function start() {
  setUpPlaying();
  setUpPicker();
  setUpTuning();
  $('reset').addEventListener('click', reset);
  $('new-sound').addEventListener('click', newSound);
  $('share').addEventListener('click', share);
  $('open-about').addEventListener('click', () => $('about').showModal());
  // Click outside a dialog closes it.
  document.querySelectorAll('dialog').forEach((d) =>
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    }),
  );
  window.addEventListener('hashchange', () => {
    setTuning(tuningFromHash());
    const titles = titlesFromHash();
    if (titles && !sameTitles(titles, titleList())) usePatch(titles);
  });

  // A shared link opens its painting; otherwise always the default patch.
  setTuning(tuningFromHash());
  usePatch(titlesFromHash() || STARTER);
}

start();
