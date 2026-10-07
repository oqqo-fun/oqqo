import { DASH } from './fmt.js';

export const prefersReduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function flash(el) {
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('flash');
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

export function countTo(el, to, fmt, dur = 900) {
  if (prefersReduced()) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(to * ease(t));
    if (t < 1 && el._count === step) requestAnimationFrame(step);
    else if (t >= 1) el.textContent = fmt(to);
  };
  el._count = step;
  requestAnimationFrame(step);
}

// First value counts up from zero. Later changes swap in place and flash.
export function setValue(el, value, fmt) {
  if (!el) return;
  el.classList.remove('sk');
  if (value === null || value === undefined || !Number.isFinite(value)) {
    el._v = null;
    el._count = null;
    el.textContent = DASH;
    return;
  }
  if (el._v === undefined || el._v === null) {
    el._v = value;
    countTo(el, value, fmt);
    return;
  }
  if (value !== el._v) {
    el._v = value;
    el._count = null;
    el.textContent = fmt(value);
    flash(el);
  }
}
