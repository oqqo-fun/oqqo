// Hero background: a falling field of base58 glyphs on a canvas.
// Colours come from the token variables, never from literals in this file.
import { prefersReduced } from './motion.js';

const GLYPHS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const STEP = 22;
const FRAME_MS = 1000 / 30;

export function startField(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const css = getComputedStyle(document.documentElement);
  const dim = css.getPropertyValue('--glyph').trim();
  const head = css.getPropertyValue('--glyph-head').trim();
  const fade = css.getPropertyValue('--void-14').trim();

  let w = 0, h = 0, cols = 0, drops = [], speeds = [];
  let raf = 0, last = 0, visible = true, running = false;

  const rnd = (n) => Math.floor(Math.random() * n);
  const glyph = () => GLYPHS[rnd(GLYPHS.length)];

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '500 15px ui-monospace, "Geist Mono", monospace';
    ctx.textBaseline = 'top';
    cols = Math.ceil(w / STEP);
    drops = Array.from({ length: cols }, () => -rnd(Math.ceil(h / STEP)));
    speeds = Array.from({ length: cols }, () => 0.35 + Math.random() * 0.75);
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < cols; i++) {
      const y = drops[i] * STEP;
      if (y >= -STEP && y < h) {
        ctx.fillStyle = head;
        ctx.fillText(glyph(), i * STEP, y);
        ctx.fillStyle = dim;
        ctx.fillText(glyph(), i * STEP, y - STEP);
      }
      drops[i] += speeds[i];
      if (drops[i] * STEP > h + rnd(h * 0.6)) { drops[i] = -rnd(12); speeds[i] = 0.35 + Math.random() * 0.75; }
    }
  }

  function paintStatic() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < cols; i++) {
      const rows = Math.ceil(h / STEP);
      for (let j = 0; j < rows; j++) {
        if (Math.random() < 0.72) continue;
        ctx.fillStyle = Math.random() < 0.12 ? head : dim;
        ctx.fillText(glyph(), i * STEP, j * STEP);
      }
    }
  }

  function play() {
    if (running || prefersReduced() || !visible || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  size();
  if (prefersReduced()) { paintStatic(); } else { play(); }

  new ResizeObserver(() => { size(); if (prefersReduced()) paintStatic(); }).observe(canvas);
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    visible ? play() : pause();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
}
