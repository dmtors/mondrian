// A slider shaped like an infinity sign: a thumb slides round a figure-eight
// track with notches along it, snapping from one to the next, and shows the
// current notch's name inside it. The track has no
// ends, so it goes on round forever, the last notch beside the first. Drag the
// thumb (or press anywhere on the track), or use the arrow keys.
//
// Where the track crosses itself, a drag carries on along the strand it is on:
// the thumb only looks near where it already is, so it never jumps to the
// other strand.

const SVG = 'http://www.w3.org/2000/svg';
const W = 200; // viewBox: 200 × 100
const H = 100;
const SAMPLES = 480;

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/** Points round a lemniscate of Bernoulli, from its right tip, upward first round the right loop. */
function track() {
  const a = 92; // the loops' tips 8 units from the edges, so the track spans the control
  const points = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (2 * Math.PI * i) / SAMPLES;
    const d = 1 + Math.sin(t) ** 2;
    points.push({ x: W / 2 + (a * Math.cos(t)) / d, y: H / 2 - (a * Math.sin(t) * Math.cos(t)) / d });
  }
  // Distance along the track to each point, to space the notches evenly.
  const along = [0];
  for (let i = 1; i <= SAMPLES; i++) {
    const p = points[i - 1];
    const q = points[i % SAMPLES];
    along.push(along[i - 1] + Math.hypot(q.x - p.x, q.y - p.y));
  }
  return { points, along, length: along[SAMPLES] };
}

/**
 * Makes [el] (a role="slider" element) an infinity slider with [count]
 * notches. [label](i) names a notch for screen readers; [onTurn](i, how) runs
 * when the user moves it to a new notch, [how] being 'drag' or 'key'. Returns
 * { set(i) } to move it without calling onTurn.
 */
export function infinity(el, { count, label = String, onTurn }) {
  const { points, along, length } = track();
  // Notches half a step from the start, so none sits on the crossing.
  const notchSample = Array.from({ length: count }, (_, k) => {
    const s = ((k + 0.5) / count) * length;
    return along.findIndex((d) => d >= s) % SAMPLES;
  });
  const notchOf = (sample) => ((Math.round((along[sample] / length) * count - 0.5) % count) + count) % count;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  svg.append(svgEl('path', { class: 'track', d: `M${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}Z` }));
  const ticks = notchSample.map((i) => {
    const tick = svgEl('circle', { class: 'tick', cx: points[i].x, cy: points[i].y, r: 3 });
    svg.append(tick);
    return tick;
  });
  el.append(svg);
  // The thumb is HTML over the track (not part of the SVG), so its text stays
  // a readable size however wide the track is drawn.
  const thumb = document.createElement('span');
  thumb.className = 'thumb';
  thumb.setAttribute('aria-hidden', 'true');
  el.append(thumb);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', String(count - 1));

  let index = 0;
  let at = notchSample[0]; // the sample the drag is following

  function set(i) {
    index = i;
    const p = points[notchSample[i]];
    thumb.style.left = `${(p.x / W) * 100}%`;
    thumb.style.top = `${(p.y / H) * 100}%`;
    thumb.textContent = label(i);
    ticks.forEach((t, k) => t.classList.toggle('on', k === i));
    el.setAttribute('aria-valuenow', String(i));
    el.setAttribute('aria-valuetext', label(i));
  }

  function turnTo(i, how) {
    if (i === index) return;
    set(i);
    onTurn(i, how);
  }

  /** The pointer in viewBox units. */
  function local(event) {
    const m = svg.getScreenCTM().inverse();
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  }

  /** The nearest sample to [p]: anywhere, or (following a drag) only within [reach] samples of [from]. */
  function nearest(p, from = null, reach = SAMPLES / 10) {
    let best = -1;
    let bestDistance = Infinity;
    const check = (i) => {
      const d = Math.hypot(points[i].x - p.x, points[i].y - p.y);
      if (d < bestDistance) [best, bestDistance] = [i, d];
    };
    if (from === null) for (let i = 0; i < SAMPLES; i++) check(i);
    else for (let k = -reach; k <= reach; k++) check((from + k + SAMPLES) % SAMPLES);
    return { sample: best, distance: bestDistance };
  }

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.focus();
    try { el.setPointerCapture(e.pointerId); } catch {}
    el.classList.add('sliding');
    // Grabbing the thumb keeps its strand; pressing elsewhere jumps there.
    const p = local(e);
    const thumbPoint = points[notchSample[index]];
    at = Math.hypot(p.x - thumbPoint.x, p.y - thumbPoint.y) < 14 ? notchSample[index] : nearest(p).sample;
    turnTo(notchOf(at), 'drag');
  });
  el.addEventListener('pointermove', (e) => {
    if (!el.classList.contains('sliding')) return;
    const p = local(e);
    let found = nearest(p, at);
    // Far from where it was (a fast flick, or a jump across): look everywhere.
    if (found.distance > 30) found = nearest(p);
    at = found.sample;
    turnTo(notchOf(at), 'drag');
  });
  const release = () => el.classList.remove('sliding');
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  el.addEventListener('keydown', (e) => {
    const step = { ArrowUp: 1, ArrowRight: 1, PageUp: 1, ArrowDown: -1, ArrowLeft: -1, PageDown: -1 }[e.key];
    let next = null;
    if (step) next = (index + step + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation(); // the arrows move the slider, nothing else
    at = notchSample[next];
    turnTo(next, 'key');
  });

  set(0);
  return { set };
}
