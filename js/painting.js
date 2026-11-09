// The painting a patch makes: one rectangle per note, every rectangle touching
// its neighbours, the lowest note far bigger than the highest. The four article
// titles decide the arrangement, and each slot's article claims a rectangle to
// colour (waveform red, filter blue, envelope yellow, effect black). The same
// articles always make the same painting.

export const SLOTS = ['waveform', 'filter', 'envelope', 'effect'];

/**
 * The reference notes the layout is sized from (C major pentatonic, C4–G5):
 * rectangle i is always the i-th lowest note, whatever key and scale is played.
 */
export const NOTES = [60, 62, 64, 67, 69, 72, 74, 76, 79];

export const PAINT_FOR = { waveform: 'red', filter: 'blue', envelope: 'yellow', effect: 'black' };

/** How much bigger lower notes are: area ∝ wavelength^SIZE_CONTRAST, so C4 is ~22× G5. */
const SIZE_CONTRAST = 2.8;

export const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** A stable 32-bit string hash (Java's String.hashCode). */
export function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return h;
}

/** A small seeded random generator (mulberry32): same seed, same numbers. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The painting in a unit square: [{ index, note, l, t, r, b, paint }], one per note.
 * [titles] are the four articles in slot order.
 */
export function paint(titles) {
  const random = seeded(hash(titles.join('|')));
  const weights = NOTES.map((n) => (1 / frequency(n)) ** SIZE_CONTRAST);
  const boxes = {};
  place(tree(weights, random), [0, 0, 1, 1], 0.5, 0.5, random, boxes);

  // Colours: each article claims a rectangle (its own pick, the next free one if taken).
  const paints = NOTES.map(() => 'white');
  SLOTS.forEach((slot, k) => {
    const colour = PAINT_FOR[slot];
    let i = Math.abs(hash(titles[k] || '')) % NOTES.length;
    // Black stays small, as in Mondrian: it never takes the biggest rectangles.
    while (paints[i] !== 'white' || (colour === 'black' && i < 3)) i = (i + 1) % NOTES.length;
    paints[i] = colour;
  });

  return NOTES.map((note, index) => {
    const [l, t, r, b] = boxes[index];
    return { index, note, l, t, r, b, paint: paints[index] };
  });
}

/**
 * Pairs notes into a tree by joining small groups first, so a tiny note sits
 * beside other small ones rather than as a sliver off a big one. [random]
 * varies which pairs join (among the smallest few) and their order.
 */
function tree(weights, random) {
  const nodes = weights.map((weight, note) => ({ weight, note }));
  while (nodes.length > 1) {
    nodes.sort((x, y) => x.weight - y.weight);
    const a = nodes.shift();
    // Usually the next smallest; sometimes the one after, for variety.
    const pick = nodes.length > 1 && Math.floor(random() * 3) === 0 ? 1 : 0;
    const [b] = nodes.splice(pick, 1);
    const [first, second] = random() < 0.5 ? [a, b] : [b, a];
    nodes.push({ weight: a.weight + b.weight, first, second });
  }
  return nodes[0];
}

/**
 * Cuts [box] between a node's two groups in proportion to their weight, across
 * its longer side (either way when nearly square). The lighter group goes on
 * the side nearer the centre, so small notes gather in the middle and big
 * ones reach the edge.
 */
function place(node, box, cx, cy, random, out) {
  if (node.note !== undefined) {
    out[node.note] = box;
    return;
  }
  const [heavy, light] = node.first.weight >= node.second.weight ? [node.first, node.second] : [node.second, node.first];
  const [l, t, r, b] = box;
  const w = r - l;
  const h = b - t;
  const across = Math.abs(w - h) < 0.15 * Math.max(w, h) ? random() < 0.5 : w >= h;
  const share = light.weight / node.weight;
  if (across) {
    const lightRight = (l + r) / 2 < cx;
    const x = lightRight ? r - w * share : l + w * share;
    place(heavy, lightRight ? [l, t, x, b] : [x, t, r, b], cx, cy, random, out);
    place(light, lightRight ? [x, t, r, b] : [l, t, x, b], cx, cy, random, out);
  } else {
    const lightBelow = (t + b) / 2 < cy;
    const y = lightBelow ? b - h * share : t + h * share;
    place(heavy, lightBelow ? [l, t, r, y] : [l, y, r, b], cx, cy, random, out);
    place(light, lightBelow ? [l, y, r, b] : [l, t, r, y], cx, cy, random, out);
  }
}
