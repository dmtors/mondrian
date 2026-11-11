import { SLOTS, COLOURS, paint, gridFor, shapeAt } from './painting.js';
import { KEYS as KEY_NAMES, MOODS, OCTAVE_SHIFTS, DEFAULT_KEY, DEFAULT_MOOD, tonesFor, octaveAllowed, nearestOctave, keySlug, keyFromSlug, moodById } from './scales.js';
import { knob } from './knob.js';
import { MOOD_PICTURES, commonsPage } from './mood-pictures.js';
import { infinity } from './infinity.js';
import { KNOB_MARKUP, SCREEN_MARKUP, drawPedal } from './pedal.js';
import { Synth, SoundMap, soundOf } from './synth.js';
import { articleSignals, search, articleUrl, randomArticle, SURPRISES, STARTER } from './wiki.js';

const LABELS = { waveform: 'Waveform', filter: 'Filter', envelope: 'Envelope', effect: 'Effect' };
const HINTS = {
  waveform: 'The more people have written the article, the richer the tone.',
  filter: 'The more references the article cites, the brighter the sound.',
  envelope: 'The more people read the article, the longer each note rings.',
  effect: 'The more recently the article was updated, the more the note wobbles. A trending article shimmers.',
};

/** Codex icons (@wikimedia/codex-icons), one for each slot's trust signal, and one for trending. */
const icon = (paths, size = 'small') =>
  `<span class="cdx-icon cdx-icon--${size}"><svg viewBox="0 0 20 20" aria-hidden="true">${paths}</svg></span>`;
const SIGNAL_ICONS = {
  // cdxIconUserAvatar: contributors
  waveform: icon('<path d="M12 11a6 6 0 016 6v2H2v-2a6 6 0 016-6z"/><circle cx="10" cy="5" r="4"/>'),
  // cdxIconReferences: references
  filter: icon('<path d="M7 1v18H1V1zM3 17h2V3H3z"/><path d="M11 1v18H5V1zM7 17h2V3H7z"/><path d="M6 12v2H2v-2zm4 0v2H6v-2zM14.37.075l4.66 17.387-5.796 1.553L8.575 1.628 14.371.075Zm.278 16.49 1.932-.517-3.623-13.523-1.932.517z"/><path d="m16.252 10.96.518 1.931-3.864 1.035-.518-1.931z"/>'),
  // cdxIconChart: page views
  envelope: icon('<path d="M3 17h16v2H1V1h2z"/><path d="M19 5v10H5v-1l4.5-5.5 3 3.5L18 5z"/>'),
  // cdxIconCalendar: last updated
  effect: icon('<path d="M10 14H7v-3h3z"/><path d="M7 3h6V1h2v2h5v15H0V3h5V1h2zM2 16h16V8H2z"/>'),
};
// cdxIconArrowUp: trending (Chart is page views)
const TRENDING_ICON = icon('<path d="M16.414 7.71 15 9.124l-4-4V19H9V5.124l-4 4L3.586 7.71l5.707-5.707h1.414z"/>', 'x-small');

/**
 * A Codex Thumbnail: the image when there is one, otherwise Codex's
 * placeholder (cdxIconImage). [setThumbnail] swaps between them.
 */
const THUMBNAIL = `<span class="cdx-thumbnail__placeholder"><span class="cdx-icon cdx-icon--medium cdx-thumbnail__placeholder__icon--vue"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 15H5l3.5-4 2 2L15 8z"/><path d="M19 19H1V1h18zM3 17h14V3H3z"/><circle cx="6.5" cy="6.5" r="1.5"/></svg></span></span><span class="cdx-thumbnail__image" hidden></span>`;
function setThumbnail(thumbnail, src) {
  const image = thumbnail.querySelector('.cdx-thumbnail__image');
  const url = src ? `url("${src.replace(/"/g, '%22')}")` : '';
  if (image.style.backgroundImage !== url) image.style.backgroundImage = url;
  image.hidden = !src;
  thumbnail.querySelector('.cdx-thumbnail__placeholder').hidden = Boolean(src);
}
/** The hash keys a shared link uses for each slot. */
const HASH_KEYS = { waveform: 'w', filter: 'f', envelope: 'e', effect: 'x' };
/**
 * The keyboard plays all sixteen notes, one row of four per size, in two
 * hands: the left plays the blocks, Q W E R the medium ones over A S D F the
 * large; the right plays the small blocks and squares, U I O P the squares
 * over J K L ; the small blocks. Each column is a colour: yellow, red, blue,
 * grey. Higher rows play higher.
 */
const KEY_ROWS = [
  ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],
  ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ['KeyU', 'KeyI', 'KeyO', 'KeyP'],
];
const KEY_NOTES = new Map(KEY_ROWS.flatMap((row, register) => row.map((code, c) => [code, { register, colour: COLOURS[c] }])));

const $ = (id) => document.getElementById(id);
const synth = new Synth();

const state = {
  titles: {}, // slot → title (drives the painting, even before the article loads)
  articles: {}, // slot → what was read from the article (drives the sound)
  loading: new Set(),
  failed: new Set(),
  key: DEFAULT_KEY, // 0–11, C to B
  mood: DEFAULT_MOOD,
  shift: 0, // octaves up or down from where the key starts
  tones: tonesFor(DEFAULT_KEY, DEFAULT_MOOD), // [register][colour]: the MIDI note each size and colour plays
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
  // The pitch and mood only go in the link when they're not the default.
  if (state.key !== DEFAULT_KEY || state.mood !== DEFAULT_MOOD) {
    params.set('k', keySlug(state.key));
    params.set('m', state.mood);
  }
  if (state.shift) params.set('o', String(state.shift));
  history.replaceState(null, '', `#${params.toString().replace(/\+/g, '%20')}`);
}

/** The pitch, mood and octave in the link, or the default. */
function tuningFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const key = keyFromSlug(params.get('k'));
  const mood = moodById(params.get('m'))?.id;
  const shift = Number(params.get('o'));
  const k = key ?? DEFAULT_KEY;
  return { key: k, mood: mood ?? DEFAULT_MOOD, shift: octaveAllowed(k, shift) ? shift : 0 };
}

function setTuning({ key, mood, shift }) {
  state.key = key;
  state.mood = mood;
  state.shift = shift;
  state.tones = tonesFor(key, mood, shift);
  knobs.pitch?.set(key);
  knobs.mood?.set(MOODS.findIndex((m) => m.id === mood));
  renderCredits(); // the footer credits the current mood's picture
  // Only as far as every note stays audible: no lower than C1, no higher than C8.
  const reachable = OCTAVE_SHIFTS.filter((s) => octaveAllowed(key, s));
  $('octave').textContent = `Octave ${reachable.indexOf(shift) + 1} of ${reachable.length}`;
  $('octave-down').disabled = !octaveAllowed(key, shift - 1);
  $('octave-up').disabled = !octaveAllowed(key, shift + 1);
  // The octave shows in the buttons' sizes: the higher it goes, the smaller
  // the − button gets, and the lower, the smaller the +, one Codex button
  // size for each octave away from the middle.
  sizeButton($('octave-down'), shift);
  sizeButton($('octave-up'), -shift);
  updateReset();
}

const BUTTON_SIZES = ['large', 'medium', 'small'];
/** A Codex button at the size [steps] down from large (0 or less: large), its icon to match. */
function sizeButton(button, steps) {
  const size = BUTTON_SIZES[Math.max(0, Math.min(BUTTON_SIZES.length - 1, steps))];
  BUTTON_SIZES.forEach((s) => button.classList.toggle(`cdx-button--size-${s}`, s === size));
  const icon = button.querySelector('.cdx-icon');
  icon.classList.toggle('cdx-icon--medium', size !== 'small');
  icon.classList.toggle('cdx-icon--small', size === 'small');
}

/** Load four articles at once (a whole new painting). */
/** True when the instrument is the starter patch in the default tuning. */
const isDefault = () =>
  sameTitles(titleList(), STARTER) && state.key === DEFAULT_KEY && state.mood === DEFAULT_MOOD && state.shift === 0;

const updateReset = () => ($('reset').disabled = isDefault());

/** Back to the starter articles (each slot's own article), pitch C, Sunny, the middle octave. */
function reset() {
  if (isDefault()) return;
  setTuning({ key: DEFAULT_KEY, mood: DEFAULT_MOOD, shift: 0 });
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
 * The die: four surprise articles and a random pitch, mood and octave. The
 * octave stays within one of the middle so the notes never go thin or muddy.
 */
let rolls = 0;
async function newSound() {
  const roll = ++rolls;
  synth.wake(); // while the click still counts as the user's gesture
  const key = Math.floor(Math.random() * 12);
  setTuning({ key, mood: pick(MOODS).id, shift: nearestOctave(key, pick([-1, 0, 1])) });
  writeHash();
  await surprise();
  // Once the new articles have shaped the sound, play it (unless the die was rolled again).
  if (roll === rolls) preview();
}

/**
 * A surprise article: usually (three times in five) a truly random one,
 * likely obscure, with few writers, references and readers, so the sound
 * changes a lot; otherwise a well-known one from the curated list. Falls back
 * to the curated list if Wikipedia can't be reached.
 */
const RANDOM_SHARE = 0.6;
async function surpriseTitle() {
  if (Math.random() < RANDOM_SHARE) {
    try {
      const title = await randomArticle();
      if (title && !titleList().includes(title)) return title;
    } catch {}
  }
  return pickSurprise();
}

function surprise(slots = SLOTS) {
  return Promise.all(slots.map(async (slot) => setSlot(slot, await surpriseTitle())));
}

// ---------- Rendering ----------

let painting = null; // { cols, rows, shapes } in grid units

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

/** Pixels per grid square, across and down: the grid fills the whole SVG, edge to edge. */
let cell = { w: 1, h: 1 };
let shapeEls = [];
let paintedFor = '';

/**
 * Draws the painting over the whole SVG, in its own pixels. Redrawn only when
 * the articles or the number of squares change; a resize that keeps the grid
 * just moves the shapes.
 */
function renderPainting() {
  const svg = $('painting');
  const { width: W, height: H } = svg.getBoundingClientRect();
  if (!W || !H) return;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const { cols, rows } = gridFor(W, H);
  cell = { w: W / cols, h: H / rows };
  const key = `${titleList().join('|')}#${cols}x${rows}`;
  if (key !== paintedFor) {
    paintedFor = key;
    painting = paint(titleList(), cols, rows);
    const group = svgEl('g');
    shapeEls = painting.shapes.map((shape) => {
      const el = svgEl('rect', { class: `shape ${shape.kind}`, 'data-paint': shape.colour });
      group.append(el);
      return el;
    });
    svg.replaceChildren(group);
  }
  painting.shapes.forEach((shape, i) => {
    const el = shapeEls[i];
    el.setAttribute('x', (shape.col * cell.w).toFixed(2));
    el.setAttribute('y', (shape.row * cell.h).toFixed(2));
    el.setAttribute('width', (shape.w * cell.w).toFixed(2));
    el.setAttribute('height', (shape.h * cell.h).toFixed(2));
  });
}

let watchingSize = false;
function watchPaintingSize() {
  if (watchingSize) return;
  watchingSize = true;
  new ResizeObserver(() => renderPainting()).observe($('painting'));
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** How long ago, in words: today, 3 days ago, 2 months ago, 4 years ago. */
function ago(days) {
  if (days === null) return 'a while ago';
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 60) return `${Math.floor(days)} days ago`;
  if (days < 730) return `${Math.floor(days / 30.4)} months ago`;
  return `${Math.floor(days / 365.25)} years ago`;
}

/**
 * A slot's trust signal and what it does to the sound, naming the slot:
 * { signal, sound }, e.g. '3 references' and 'muffled filter'.
 */
function readout(slot, a) {
  switch (slot) {
    case 'waveform': {
      const tone = { sine: 'pure', triangle: 'soft', square: 'hollow', sawtooth: 'rich' }[SoundMap.waveform(a.contributors)];
      return { signal: plural(a.contributors, 'contributor'), sound: `${tone} waveform` };
    }
    case 'filter': {
      const cutoff = SoundMap.cutoff(a.references);
      const feel = cutoff < 800 ? 'muffled' : cutoff < 2500 ? 'warm' : cutoff < 5000 ? 'bright' : 'brilliant';
      return { signal: plural(a.references, 'reference'), sound: `${feel} filter` };
    }
    case 'envelope': {
      const decay = SoundMap.decay(a.pageViews);
      const feel = decay < 0.45 ? 'short' : decay < 1.2 ? 'medium' : 'long';
      return { signal: `${compact.format(a.pageViews)} ${a.pageViews === 1 ? 'view' : 'views'} this month`, sound: `${feel} envelope` };
    }
    case 'effect': {
      const depth = SoundMap.vibratoDepth(a.daysSinceUpdate, a.trending);
      const feel = a.trending ? 'shimmer' : depth < 1 ? 'steady' : depth < 15 ? 'light wobble' : depth < 30 ? 'wobble' : 'big wobble';
      return { signal: `Updated ${ago(a.daysSinceUpdate)}`, sound: `${feel} effect` };
    }
  }
}

function renderSlots() {
  const container = $('slots');
  if (!container.children.length) {
    SLOTS.forEach((slot) => {
      // A Codex Card (a link card, as it opens the picker), styled as a pedal:
      // the article's lead image fills it, and a bordered panel over the
      // image holds the article as its title, the sound ('Muffled filter')
      // and the trust signal behind it, a Codex Info Chip when the effect is
      // trending, and the pedal face (pedal.js): the sound drawn on a
      // display, and a knob beside the sound it sets.
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'cdx-card cdx-card--is-link slot';
      card.dataset.slot = slot;
      card.innerHTML = `
        <span class="pedal-panel">
          ${SCREEN_MARKUP}
          <span class="cdx-card__text">
            <span class="cdx-card__text__title slot-title"></span>
            <span class="cdx-card__text__supporting-text slot-sound">${KNOB_MARKUP}<span class="slot-sound-text"></span></span>
            <span class="cdx-card__text__supporting-text slot-signal">${SIGNAL_ICONS[slot]}<span class="slot-readout"></span></span>
          </span>
          <span class="cdx-info-chip cdx-info-chip--warning slot-trend" hidden>${TRENDING_ICON}<span class="cdx-info-chip__text">Trending</span></span>
        </span>`;
      card.addEventListener('click', () => openPicker(slot));
      container.append(card);
    });
  }
  SLOTS.forEach((slot) => {
    const card = container.querySelector(`[data-slot="${slot}"]`);
    const loaded = state.articles[slot]?.title === state.titles[slot] ? state.articles[slot] : null;
    const loading = state.loading.has(slot);
    card.classList.toggle('loading', loading);
    // The article's lead image fills the card, behind the panel.
    const image = loaded?.thumbnail ? `url("${loaded.thumbnail.replace(/"/g, '%22')}")` : '';
    if (card.style.backgroundImage !== image) card.style.backgroundImage = image;
    card.classList.toggle('has-image', Boolean(image));
    card.querySelector('.slot-title').textContent = state.titles[slot] || '…';
    // Three lines: the article, what it does to the sound, and the trust
    // signal behind that. The sound line is held (blank) while loading, so the
    // card keeps its height.
    let text = 'Reading the article…';
    let sound = '\u00a0';
    if (state.failed.has(slot)) text = 'Couldn’t load. Tap to choose again.';
    else if (loaded) ({ signal: text, sound } = readout(slot, loaded));
    card.querySelector('.slot-readout').textContent = text;
    card.querySelector('.slot-sound-text').textContent = sound === '\u00a0' ? sound : sound.charAt(0).toUpperCase() + sound.slice(1);
    // Trending only matters to the effect, so only its card shows it.
    // The pedal face: the knob on the sound line, the sound drawn on the display (see pedal.js).
    drawPedal(card, slot, state.failed.has(slot) ? null : loaded);
    const trending = slot === 'effect' && Boolean(loaded?.trending);
    card.querySelector('.slot-trend').hidden = !trending;
    // While loading, a spinner stands in for the signal's icon.
    const line = card.querySelector('.slot-signal');
    line.querySelector('.spinner')?.remove();
    line.querySelector('.cdx-icon').hidden = loading;
    if (loading) line.prepend(Object.assign(document.createElement('span'), { className: 'spinner' }));
    const heard = sound.trim() ? `, ${sound}` : '';
    card.setAttribute('aria-label', `${LABELS[slot]}: ${state.titles[slot]}. ${text}${heard}${trending ? ', trending' : ''}. Change article.`);
  });
}

function renderCredits() {
  const picture = MOOD_PICTURES[state.mood];
  const links = SLOTS.map((s) => {
    const title = state.titles[s] || '';
    // The Attribution API's link keeps its wprov tag, so Wikipedia can count the visit.
    const loaded = state.articles[s]?.title === title ? state.articles[s] : null;
    return `<a href="${loaded?.link || articleUrl(title)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`;
  });
  $('credits').innerHTML = `This instrument is made from the Wikipedia articles ${links.slice(0, 3).join(', ')} and ${links[3]}. Article data from Wikipedia, available under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. The painting is inspired by <a href="https://en.wikipedia.org/wiki/Broadway_Boogie_Woogie" target="_blank" rel="noopener"><i>Broadway Boogie Woogie</i></a> by <a href="https://en.wikipedia.org/wiki/Piet_Mondrian" target="_blank" rel="noopener">Piet Mondrian</a>. Mood picture: <a href="${commonsPage(picture.file)}" target="_blank" rel="noopener">${escapeHtml(picture.alt)}</a> by ${escapeHtml(picture.author)}, ${pictureLicence(picture)}, from Wikimedia Commons.`;
}

/** A picture's licence as a phrase: 'available under CC BY 2.0' (linked), or 'in the public domain'. */
const pictureLicence = (p) =>
  p.license === 'Public domain'
    ? 'in the public domain'
    : `available under <a href="${p.licenseUrl}" target="_blank" rel="noopener">${p.license}</a>`;

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- Playing ----------

/** The note a shape plays: its colour's tone, in its size's octave. */
const noteOf = (shape) => state.tones[shape.register][COLOURS.indexOf(shape.colour)];

/** Plays one shape, pressing just that shape. */
function strike(shape) {
  synth.strike(noteOf(shape));
  press([shape]);
}

/** Plays a note by size and colour, pressing every shape that plays it. */
function strikeNote({ register, colour }) {
  if (!painting) return;
  synth.strike(state.tones[register][COLOURS.indexOf(colour)]);
  press(painting.shapes.filter((s) => s.colour === colour && s.register === register));
}

// A struck shape shrinks toward its centre for a moment, like a button pushed
// in, then springs back. Every shape moves in by the same number of pixels on
// each side, a fifth of a square, so all of them show the same gap.
const PRESS_MS = 110;
const PRESS_GAP = 0.2; // of a square
const pressTimers = new Map();
function press(shapes) {
  const gap = PRESS_GAP * Math.min(cell.w, cell.h);
  shapes.forEach((shape) => {
    const el = shapeEls[shape.id];
    const w = shape.w * cell.w;
    const h = shape.h * cell.h;
    clearTimeout(pressTimers.get(el));
    el.classList.add('pressing');
    el.style.transform = `scale(${(w - 2 * gap) / w}, ${(h - 2 * gap) / h})`;
    pressTimers.set(el, setTimeout(() => {
      el.classList.remove('pressing');
      el.style.transform = '';
      pressTimers.delete(el);
    }, PRESS_MS));
  });
}

function shapeUnder(event) {
  if (!painting) return null;
  const box = $('painting').getBoundingClientRect();
  return shapeAt(painting, (event.clientX - box.left) / cell.w, (event.clientY - box.top) / cell.h);
}

// Every finger (or the mouse) plays on its own: a note when it lands, then one
// for each new shape it slides onto, so dragging along a street plays a run.
const pointers = new Map();
function touch(event) {
  const shape = shapeUnder(event);
  const id = shape ? shape.id : -1;
  if (pointers.get(event.pointerId) === id) return;
  pointers.set(event.pointerId, id);
  if (shape) strike(shape);
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
    const note = KEY_NOTES.get(e.code);
    if (!note) return;
    e.preventDefault();
    synth.wake();
    strikeNote(note);
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
  showResults([], '');
  $('picker').showModal();
  $('picker-search').focus();
}

function choose(title) {
  $('picker').close();
  if (title && pickerSlot) setSlot(pickerSlot, title);
}

// The picker's search is a Codex TypeaheadSearch: suggestions drop down in a
// menu as you type. Focus stays in the field; the arrow keys move a
// highlight through the suggestions (announced through
// aria-activedescendant), Enter picks the highlighted one, or the first,
// and Escape closes the menu.
let suggestions = []; // the titles in the menu, in order
let highlighted = -1;

function openMenu(open) {
  $('picker-menu').hidden = !open;
  $('picker-typeahead').classList.toggle('cdx-typeahead-search--expanded', open);
  $('picker-search').setAttribute('aria-expanded', String(open));
  if (open) fitMenu();
}

/**
 * Keeps the menu inside what can be seen: it scrolls within the room left
 * below the field. On a phone that's the visual viewport, which shrinks when
 * the on-screen keyboard opens, so the menu never runs under the keyboard.
 */
function fitMenu() {
  const list = $('picker-results');
  if ($('picker-menu').hidden) return;
  const view = window.visualViewport;
  const bottom = view ? view.offsetTop + view.height : window.innerHeight;
  const room = bottom - list.getBoundingClientRect().top - 16;
  list.style.maxHeight = `${Math.max(120, Math.min(416, room))}px`;
}
window.addEventListener('resize', fitMenu);
window.visualViewport?.addEventListener('resize', fitMenu);
window.visualViewport?.addEventListener('scroll', fitMenu);

function highlight(index) {
  highlighted = index;
  const items = $('picker-results').querySelectorAll('[role="option"]');
  items.forEach((li, i) => li.classList.toggle('cdx-menu-item--highlighted', i === index));
  const active = items[index];
  if (active) {
    $('picker-search').setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  } else $('picker-search').removeAttribute('aria-activedescendant');
}

/** A message in the menu instead of suggestions (no matches, or no connection). */
function menuMessage(text) {
  suggestions = [];
  $('picker-results').innerHTML = `<li class="cdx-menu-item cdx-menu-item--disabled" role="presentation"><span class="cdx-menu-item__content cdx-typeahead-search__menu-message cdx-typeahead-search__menu-message--has-thumbnail"><span class="cdx-typeahead-search__menu-message__text">${escapeHtml(text)}</span></span></li>`;
  highlight(-1);
  openMenu(true);
}

function showResults(results, text) {
  const list = $('picker-results');
  list.replaceChildren();
  suggestions = results.map((r) => r.title);
  highlight(-1);
  if (!text) return openMenu(false);
  if (!results.length) return menuMessage(`No articles start with “${text}”.`);
  // Codex Menu Items, each with a thumbnail and description.
  results.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'cdx-menu-item cdx-menu-item--enabled cdx-menu-item--has-description';
    li.id = `picker-option-${i}`;
    li.setAttribute('role', 'option');
    li.innerHTML = `<span class="cdx-menu-item__content"><span class="cdx-thumbnail cdx-menu-item__thumbnail">${THUMBNAIL}</span>
      <span class="cdx-menu-item__text"><span class="cdx-menu-item__text__label"><bdi></bdi></span><span class="cdx-menu-item__text__description"><bdi></bdi></span></span></span>`;
    setThumbnail(li.querySelector('.cdx-thumbnail'), r.thumbnail);
    li.querySelector('.cdx-menu-item__text__label bdi').textContent = r.title;
    li.querySelector('.cdx-menu-item__text__description bdi').textContent = r.description;
    li.addEventListener('pointerenter', () => highlight(i));
    // Keep focus in the field while pressing an item.
    li.addEventListener('pointerdown', (e) => { e.preventDefault(); li.classList.add('cdx-menu-item--active'); });
    li.addEventListener('pointerup', () => li.classList.remove('cdx-menu-item--active'));
    li.addEventListener('pointerleave', () => li.classList.remove('cdx-menu-item--active'));
    li.addEventListener('click', () => choose(r.title));
    list.append(li);
  });
  openMenu(true);
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
        if (e.name !== 'AbortError') menuMessage('Couldn’t search. Check your connection.');
      }
    }, 200);
  });
  input.addEventListener('keydown', (e) => {
    const open = !$('picker-menu').hidden;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!suggestions.length) return;
      e.preventDefault();
      if (!open) openMenu(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      highlight((highlighted + step + suggestions.length + (highlighted < 0 && step < 0 ? 1 : 0)) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(suggestions[Math.max(0, highlighted)] ?? input.value.trim());
    } else if (e.key === 'Escape') {
      // The first Escape closes the menu, the next the dialog. (Done here:
      // once the first is stopped, Chrome ignores the next one otherwise.)
      e.preventDefault();
      if (open) {
        openMenu(false);
        highlight(-1);
      } else $('picker').close();
    }
  });
  // The menu closes when the field loses focus (pressing an item keeps it), and comes back on focus.
  input.addEventListener('blur', () => openMenu(false));
  input.addEventListener('focus', () => input.value.trim() && $('picker-results').children.length && openMenu(true));
  $('picker-surprise').addEventListener('click', () => {
    $('picker').close();
    surprise([pickerSlot]);
  });
}

// ---------- Pitch, mood and octave ----------

/** Lets a new sound be heard: a quick climb from the large blocks to the squares. */
const PREVIEW = [[0, 'yellow'], [1, 'yellow'], [2, 'red'], [2, 'blue'], [3, 'yellow']];
function preview() {
  PREVIEW.forEach(([register, colour], i) => setTimeout(() => strikeNote({ register, colour }), i * 110));
}

/** The squares' four colours in turn, quickly: how a mood sounds. */
function strum() {
  COLOURS.forEach((colour, i) => setTimeout(() => strikeNote({ register: 3, colour }), i * 45));
}

const knobs = {};

function setUpTuning() {
  const retune = (changes) => {
    const tuning = { key: state.key, mood: state.mood, shift: state.shift, ...changes };
    // A new pitch may not reach as far: keep the octave as near as still sounds.
    setTuning({ ...tuning, shift: nearestOctave(tuning.key, tuning.shift) });
    writeHash();
    synth.wake();
  };
  // Each notch of Pitch (round its infinity track) plays its home note on every
  // yellow square; each notch of Mood strums its four colours.
  knobs.pitch = infinity($('pitch'), {
    count: 12,
    label: (i) => KEY_NAMES[i],
    onTurn: (key) => {
      retune({ key });
      strikeNote({ register: 3, colour: 'yellow' });
    },
  });
  knobs.mood = knob($('mood'), {
    count: MOODS.length,
    cyclic: true, // all the way round: the eight dots evenly spaced, Spooky beside Dreamy
    picture: (i) => MOOD_PICTURES[MOODS[i].id], // a picture for each mood, in the knob's face
    label: (i) => MOODS[i].name,
    onTurn: (i) => {
      retune({ mood: MOODS[i].id });
      strum();
    },
  });
  // Fetch every mood's picture now, so turning the knob never waits for one.
  Object.values(MOOD_PICTURES).forEach(({ src }) => (new Image().src = src));
  const octave = (step) => {
    retune({ shift: state.shift + step });
    preview();
  };
  $('octave-down').addEventListener('click', () => octave(-1));
  $('octave-up').addEventListener('click', () => octave(1));
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
  $('toast-text').textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- Start ----------

function start() {
  watchPaintingSize();
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
