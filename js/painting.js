// The painting a patch makes, after Mondrian's Broadway Boogie Woogie: streets
// of equal squares crossing a white ground, with a few bigger blocks in the
// fields between them. There is no black. Every shape is one of four colours,
// and each colour is a note, so the same note lives in many places; its size
// picks the octave, from the large blocks (lowest) to the squares on the
// streets (highest). White is quiet.
// The four article titles decide where the streets and blocks go and how the
// squares are coloured: the same articles always make the same painting.

export const SLOTS = ['waveform', 'filter', 'envelope', 'effect'];

/** The four colours, in the order of the notes they play (lowest first). */
export const COLOURS = ['yellow', 'red', 'blue', 'grey'];

/**
 * The four sizes, lowest note first: each plays its colour's note in its own
 * octave. Large blocks are lowest, then medium, then small; the squares on the
 * streets are highest.
 */
export const REGISTERS = ['large', 'medium', 'small', 'square'];

/** Width × height, in squares, that each size of block can take. */
const BLOCK_SIZES = {
  small: [[1, 2], [2, 1], [2, 2]],
  medium: [[2, 3], [3, 2], [2, 4], [4, 2]],
  large: [[3, 3], [3, 4], [4, 3], [4, 4], [3, 5], [5, 3], [4, 5], [5, 4], [5, 5], [4, 6], [6, 4], [3, 6], [6, 3]],
};

/** Which of REGISTERS a shape plays in, by its size (an inner block too). */
function registerOf(shape) {
  if (shape.kind === 'square') return 3;
  const area = shape.w * shape.h;
  return area <= 4 ? 2 : area <= 8 ? 1 : 0;
}

/** Squares across the painting's shorter side; the longer side gets as many as fit. */
const SHORT_SIDE = 24;

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

/** One random number for one square, so a square keeps its colour when the window changes size. */
const cellRandom = (seed, row, col, salt) =>
  seeded(seed ^ Math.imul(row + 1, 73856093) ^ Math.imul(col + 1, 19349663) ^ Math.imul(salt, 83492791))();

/** [[weight, value], …] → a value, chosen by [r] in 0–1. */
function weighted(options, r) {
  const total = options.reduce((sum, [w]) => sum + w, 0);
  let at = r * total;
  for (const [w, value] of options) if ((at -= w) < 0) return value;
  return options[options.length - 1][1];
}

/** How many squares across and down a painting of W × H pixels has. */
export function gridFor(W, H) {
  const size = Math.min(W, H) / SHORT_SIDE;
  return { cols: Math.max(1, Math.round(W / size)), rows: Math.max(1, Math.round(H / size)) };
}

/**
 * Where the streets run, as fractions of the way across: some close in pairs,
 * most with a field between, a few far apart; near both edges, as in the painting.
 */
function streetPositions(random) {
  const out = [];
  let f = 0.01 + random() * 0.04;
  while (f < 0.985) {
    out.push(f);
    const r = random();
    f += r < 0.2 ? 0.04 + random() * 0.03 : r < 0.6 ? 0.14 + random() * 0.08 : 0.24 + random() * 0.1;
  }
  return out;
}

/** Fractions → square indices along a side of [n], at least one white square apart. */
function snap(fractions, n) {
  const out = [];
  for (const f of fractions) {
    const i = Math.min(n - 1, Math.round(f * (n - 1)));
    if (!out.length || i - out[out.length - 1] >= 2) out.push(i);
  }
  return out;
}

/**
 * The painting on a [cols] × [rows] grid of squares:
 * { cols, rows, shapes: [{ id, kind: 'square' | 'block', colour, register, col, row, w, h }] }
 * in grid units, [register] indexing REGISTERS. Squares are 1 × 1 and lie on the
 * streets; blocks are bigger, sit in the fields, and may hold a smaller block
 * (listed after, so on top).
 * [titles] are the four articles in slot order.
 */
export function paint(titles, cols, rows) {
  const seed = hash(titles.join('|'));
  const random = seeded(seed);

  // Full-length streets, then a few short ones running between two crossings.
  const xs = snap(streetPositions(random), cols); // vertical streets, by column
  const ys = snap(streetPositions(random), rows); // horizontal streets, by row
  const vertical = Array.from({ length: rows }, () => new Uint8Array(cols));
  const horizontal = Array.from({ length: rows }, () => new Uint8Array(cols));
  xs.forEach((c) => vertical.forEach((line) => (line[c] = 1)));
  ys.forEach((r) => horizontal[r].fill(1));

  const shortStreets = (parallel, crossings, n, lay) => {
    for (let k = 0; k < 3; k++) {
      const at = Math.round(random() * (n - 1));
      const from = Math.floor(random() * crossings.length);
      const to = Math.min(crossings.length - 1, from + 1 + Math.floor(random() * 2));
      // Not on or beside a full street, or it would read as a double one.
      if (from === to || parallel.some((p) => Math.abs(p - at) < 2)) continue;
      lay(at, crossings[from], crossings[to]);
    }
  };
  shortStreets(ys, xs, rows, (r, c0, c1) => { for (let c = c0; c <= c1; c++) horizontal[r][c] = 1; });
  shortStreets(xs, ys, cols, (c, r0, r1) => { for (let r = r0; r <= r1; r++) vertical[r][c] = 1; });

  const onStreet = (r, c) => horizontal[r][c] || vertical[r][c];

  // The squares: mostly yellow, with a red, blue or grey one every few, and
  // crossings usually coloured. Never two coloured squares in a row.
  const colours = Array.from({ length: rows }, () => new Array(cols).fill(null));
  const isAccent = (r, c) => colours[r][c] && colours[r][c] !== 'yellow';
  const accent = (r) => weighted([[0.38, 'red'], [0.36, 'blue'], [0.26, 'grey']], r);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!onStreet(r, c)) continue;
      const crossing = horizontal[r][c] && vertical[r][c];
      const besideAccent = (c > 0 && horizontal[r][c] && isAccent(r, c - 1)) || (r > 0 && vertical[r][c] && isAccent(r - 1, c));
      const coloured = !besideAccent && cellRandom(seed, r, c, 1) < (crossing ? 0.65 : 0.3);
      colours[r][c] = coloured ? accent(cellRandom(seed, r, c, 2)) : 'yellow';
    }
  }

  const shapes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (colours[r][c]) shapes.push({ kind: 'square', colour: colours[r][c], col: c, row: r, w: 1, h: 1 });
    }
  }

  // The blocks, in the fields between full streets: first one of every size
  // and colour, so every note has a shape to play it, then more at random.
  const taken = Array.from({ length: rows }, () => new Uint8Array(cols));
  const bx = [-1, ...xs, cols];
  const by = [-1, ...ys, rows];
  const fields = [];
  for (let j = 0; j < by.length - 1; j++) {
    for (let i = 0; i < bx.length - 1; i++) {
      const c0 = bx[i] + 1;
      const r0 = by[j] + 1;
      const fw = bx[i + 1] - c0;
      const fh = by[j + 1] - r0;
      if (fw >= 1 && fh >= 1) fields.push({ c0, r0, fw, fh });
    }
  }
  const shuffled = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const k = Math.floor(random() * (i + 1));
      [out[i], out[k]] = [out[k], out[i]];
    }
    return out;
  };

  // Each block stays a shape of its own: white between it and any other block,
  // between a yellow or grey one and the (yellow) streets, and never beside a
  // square of its own colour. Red and blue blocks may lean on a street.
  const canPlace = (colour, col, row, w, h) => {
    const keepsOff = colour === 'yellow' || colour === 'grey';
    for (let r = row - 1; r <= row + h; r++) {
      for (let c = col - 1; c <= col + w; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        const inside = r >= row && r < row + h && c >= col && c < col + w;
        if (taken[r][c] || (onStreet(r, c) && (inside || keepsOff || colours[r][c] === colour))) return false;
      }
    }
    return true;
  };
  const touchesStreet = (col, row, w, h) =>
    (col > 0 && onStreet(row, col - 1)) || (row > 0 && onStreet(row - 1, col)) ||
    (col + w < cols && onStreet(row, col + w)) || (row + h < rows && onStreet(row + h, col));

  const place = (size, colour) => {
    for (const [w, h] of shuffled(BLOCK_SIZES[size])) {
      for (const { c0, r0, fw, fh } of shuffled(fields)) {
        // Never filling a field: some white is always left.
        if (w > fw || h > fh || (w === fw && h === fh)) continue;
        const spots = [];
        for (let row = r0; row + h <= r0 + fh; row++) {
          for (let col = c0; col + w <= c0 + fw; col++) if (canPlace(colour, col, row, w, h)) spots.push([col, row]);
        }
        if (!spots.length) continue;
        // Mostly against a street, as in the painting, when it can be.
        const leaning = spots.filter(([col, row]) => touchesStreet(col, row, w, h));
        const pool = leaning.length && random() < 0.7 ? leaning : spots;
        const [col, row] = pool[Math.floor(random() * pool.length)];
        for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) taken[r][c] = 1;
        shapes.push({ kind: 'block', colour, col, row, w, h });
        // Often a smaller block inside a big one, in another colour (grey or yellow most of all).
        if (w >= 3 && h >= 3 && random() < 0.5) {
          const iw = Math.max(1, Math.round(w * 0.42));
          const ih = Math.max(1, Math.round(h * 0.42));
          const others = [[0.4, 'grey'], [0.3, 'yellow'], [0.15, 'red'], [0.15, 'blue']].filter(([, k]) => k !== colour);
          shapes.push({ kind: 'block', colour: weighted(others, random()), col: col + (w - iw) / 2, row: row + (h - ih) / 2, w: iw, h: ih });
        }
        return true;
      }
    }
    return false;
  };

  for (const size of ['large', 'medium', 'small']) for (const colour of shuffled(COLOURS)) place(size, colour);
  const extra = Math.round(fields.length * 0.5);
  for (let k = 0; k < extra; k++) {
    const size = weighted([[0.5, 'small'], [0.35, 'medium'], [0.15, 'large']], random());
    place(size, weighted([[0.36, 'red'], [0.32, 'blue'], [0.18, 'yellow'], [0.14, 'grey']], random()));
  }

  shapes.forEach((shape) => (shape.register = registerOf(shape)));
  shapes.forEach((shape, id) => (shape.id = id));
  return { cols, rows, shapes };
}

/** The shape at a point in grid units (the topmost, for a block inside a block), or null on white. */
export function shapeAt(painting, x, y) {
  const { shapes } = painting;
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (x >= s.col && x < s.col + s.w && y >= s.row && y < s.row + s.h) return s;
  }
  return null;
}
