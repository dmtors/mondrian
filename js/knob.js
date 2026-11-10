// A knob with notches: drag it round (or press a notch), or use the arrow keys.
// It snaps from notch to notch. A [cyclic] knob turns all the way round, its
// last notch beside its first; otherwise the notches spread over a 270° sweep
// with a gap at the bottom, from lowest (bottom left) to highest (bottom right).
// With [textPointer], the pointer is the current notch's name, written along
// it from the centre outward (or, on the left half, from the tip inward, so it
// never reads upside down), shrunk to fit when the name is long.

const SVG = 'http://www.w3.org/2000/svg';
const SWEEP = 270;

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/** Where a text pointer runs: from this far out from the centre, for this long (in viewBox units). */
const TEXT_START = 4;
const TEXT_LENGTH = 32; // inside the face (radius 38)
const TEXT_SIZE = 13;

/**
 * Makes [el] (a role="slider" element) a knob with [count] notches. [label](i)
 * names a notch (for screen readers, and on the pointer with [textPointer]);
 * [onTurn](i, how) runs when the user turns it to a new notch, [how] being
 * 'drag' or 'key'. Returns { set(i) } to move it without calling onTurn.
 */
export function knob(el, { count, cyclic = false, label = String, onTurn, textPointer = false }) {
  const angleOf = (i) => (cyclic ? (360 / count) * i : -SWEEP / 2 + (SWEEP / (count - 1)) * i);

  const svg = svgEl('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' });
  const ticks = Array.from({ length: count }, (_, i) => {
    const a = (angleOf(i) * Math.PI) / 180;
    const tick = svgEl('circle', { class: 'tick', cx: 50 + 45 * Math.sin(a), cy: 50 - 45 * Math.cos(a), r: 3.2 });
    svg.append(tick);
    return tick;
  });
  svg.append(svgEl('circle', { class: 'face', cx: 50, cy: 50, r: textPointer ? 38 : 34 }));
  const pointer = svgEl('g', { class: 'pointer' });
  const text = textPointer ? svgEl('text', { class: 'pointer-text', 'dominant-baseline': 'central' }) : null;
  pointer.append(text || svgEl('rect', { x: 46, y: 20, width: 8, height: 18 }));
  svg.append(pointer);
  el.append(svg);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', String(count - 1));

  let index = 0;
  let shown = null; // the pointer's angle, unwrapped, so it always turns the short way round

  function set(i) {
    index = i;
    ticks.forEach((t, k) => t.classList.toggle('on', k === i));
    let a = angleOf(i);
    if (shown !== null && cyclic) a += 360 * Math.round((shown - a) / 360);
    shown = a;
    pointer.style.transform = `rotate(${a}deg)`;
    if (text) writePointer(label(i), angleOf(i));
    el.setAttribute('aria-valuenow', String(i));
    el.setAttribute('aria-valuetext', label(i));
  }

  /** The name along the pointer: outward on the right half, inward on the left, so it reads the right way up. */
  function writePointer(name, angle) {
    const left = ((angle % 360) + 360) % 360 > 180;
    text.textContent = name;
    text.setAttribute('transform', `rotate(${left ? 90 : -90} 50 50)`);
    text.setAttribute('x', String(left ? 50 - TEXT_START : 50 + TEXT_START));
    text.setAttribute('y', '50');
    text.setAttribute('text-anchor', left ? 'end' : 'start');
    text.setAttribute('font-size', String(TEXT_SIZE));
    const length = text.getComputedTextLength();
    if (length > TEXT_LENGTH) text.setAttribute('font-size', String((TEXT_SIZE * TEXT_LENGTH) / length));
  }

  function turnTo(i, how) {
    if (i === index) return;
    set(i);
    onTurn(i, how);
  }

  /** The notch nearest the pointer's direction from the knob's centre. */
  function notchAt(event) {
    const box = el.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    if (Math.hypot(dx, dy) < 4) return index; // too close to the middle to tell
    const a = (Math.atan2(dx, -dy) * 180) / Math.PI; // clockwise from the top, −180–180
    if (cyclic) return ((Math.round(a / (360 / count)) % count) + count) % count;
    const clamped = Math.max(-SWEEP / 2, Math.min(SWEEP / 2, a));
    return Math.round((clamped + SWEEP / 2) / (SWEEP / (count - 1)));
  }

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.focus();
    try { el.setPointerCapture(e.pointerId); } catch {}
    el.classList.add('turning');
    turnTo(notchAt(e), 'drag');
  });
  el.addEventListener('pointermove', (e) => {
    if (el.classList.contains('turning')) turnTo(notchAt(e), 'drag');
  });
  const release = () => el.classList.remove('turning');
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  el.addEventListener('keydown', (e) => {
    const step = { ArrowUp: 1, ArrowRight: 1, PageUp: 1, ArrowDown: -1, ArrowLeft: -1, PageDown: -1 }[e.key];
    let next = null;
    if (step) next = cyclic ? (index + step + count) % count : Math.max(0, Math.min(count - 1, index + step));
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation(); // the arrows turn the knob, nothing else
    turnTo(next, 'key');
  });

  set(0);
  return { set };
}
