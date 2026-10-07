import { createPoller, nextHealth, browserEnv, fetchJson } from './net.js';
import { parseSlot, parseLockedValue, parsePairs, rank } from './parse.js';
import { DASH, fmtInt, fmtCompactUsd, fmtPrice, fmtPct, fmtMs, fmtRate } from './fmt.js';
import { setValue, flash, prefersReduced } from './motion.js';
import { startField } from './field.js';
import { createRound, remaining, isLocked, clockLabel, shares, pool, elapsedPct, pick, drift, estimate, settle } from './market.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const meta = (n) => { const m = document.querySelector('meta[name="' + n + '"]'); return m ? m.getAttribute('content') : null; };

const cfg = {
  rpc: meta('oqqo-rpc'),
  llama: meta('oqqo-llama'),
  slug: (document.querySelector('meta[name="oqqo-llama"]') || {}).dataset?.slug || 'solana',
  dex: meta('oqqo-dex'),
  tag: (document.querySelector('meta[name="oqqo-dex"]') || {}).dataset?.tag || 'solana'
};

const env = browserEnv();
const bind = (name, value, fmt) => $$('[data-bind="' + name + '"]').forEach((el) => setValue(el, value, fmt));
const bindText = (name, text) => $$('[data-bind="' + name + '"]').forEach((el) => { el.classList.remove('sk'); el.textContent = text; });

/* ---------- chain health ---------- */
const HEALTH_LABEL = { connecting: 'Connecting', live: 'Live', offline: 'Offline' };
let health = 'connecting';
function setHealth(next) {
  if (next === health) return;
  health = next;
  paintHealth();
}
function paintHealth() {
  $$('[data-health]').forEach((el) => {
    el.dataset.state = health;
    const label = $('[data-health-label]', el);
    if (label) label.textContent = HEALTH_LABEL[health];
  });
}
paintHealth();
window.addEventListener('offline', () => setHealth(nextHealth(health, { type: 'offline' })));
window.addEventListener('online', () => setHealth(nextHealth(health, { type: 'online' })));

/* ---------- slot ticker ---------- */
const rates = [];
let prevRead = null;
let slotSeen = false;

function drawSpark() {
  const pts = rates.slice(-30);
  if (pts.length < 2) return;
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = hi - lo || 1;
  const d = pts.map((v, i) => (i / (pts.length - 1) * 132).toFixed(1) + ',' + (40 - ((v - lo) / span) * 36).toFixed(1)).join(' ');
  $$('[data-spark]').forEach((poly) => poly.setAttribute('points', d));
  const lastY = 40 - ((pts[pts.length - 1] - lo) / span) * 36;
  $$('[data-spark-dot]').forEach((c) => c.setAttribute('cy', lastY.toFixed(1)));
}

if (cfg.rpc) {
  createPoller({
    interval: 2000,
    env,
    task: async () => {
      const t0 = performance.now();
      const json = await fetchJson(cfg.rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [{ commitment: 'confirmed' }] })
      });
      const slot = parseSlot(json);
      if (slot === null) throw new Error('shape');
      const at = performance.now();
      return { slot, ms: at - t0, at };
    },
    onResult: ({ slot, ms, at }) => {
      slotSeen = true;
      bind('slot', slot, fmtInt);
      bind('latency', ms, fmtMs);
      if (prevRead && at > prevRead.at && slot >= prevRead.slot) {
        const rate = (slot - prevRead.slot) / ((at - prevRead.at) / 1000);
        rates.push(rate);
        if (rates.length > 60) rates.shift();
        bind('rate', rate, fmtRate);
        drawSpark();
      }
      prevRead = { slot, at };
      setHealth(nextHealth(health, { type: 'ok' }));
    },
    onError: (_e, { failures }) => {
      setHealth(nextHealth(health, { type: 'fail', failures }));
      if (!slotSeen && failures >= 2) { bind('slot', null, fmtInt); bind('latency', null, fmtMs); bind('rate', null, fmtRate); }
    }
  }).start();
}

/* ---------- locked value ---------- */
let tvlSeen = false;
if (cfg.llama) {
  createPoller({
    interval: 60000,
    base: 2000,
    env,
    task: async () => {
      const v = parseLockedValue(await fetchJson(cfg.llama + '/v2/chains'), cfg.slug);
      if (v === null) throw new Error('shape');
      return v;
    },
    onResult: (v) => { tvlSeen = true; bind('tvl', v, fmtCompactUsd); },
    onError: (_e, { failures }) => { if (!tvlSeen && failures >= 2) bind('tvl', null, fmtCompactUsd); }
  }).start();
}

/* ---------- pairs board ---------- */
const board = {
  all: null,
  mode: 'volume',
  open: null,
  prevVol: new Map(),
  failed: false
};
const rowsEl = $('#board-rows');
const tickerEl = $('#ticker-track');
const sideEl = $('#side-rows');

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function logo(p) {
  const wrap = el('span', 'logo');
  wrap.setAttribute('aria-hidden', 'true');
  const initial = el('span', 'logo-i', (p.symbol || '?').slice(0, 1).toUpperCase());
  wrap.append(initial);
  if (p.logo) {
    const img = new Image();
    img.alt = '';
    img.width = 28;
    img.height = 28;
    img.decoding = 'async';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => wrap.classList.add('has-img'));
    img.addEventListener('error', () => img.remove());
    img.src = p.logo;
    wrap.append(img);
  }
  return wrap;
}

function detailCell(k, v) {
  const d = el('div', 'dcell');
  d.append(el('span', 'dk', k), el('span', 'dv', v));
  return d;
}

function buildRow(p, maxVol) {
  const wrap = el('div', 'row-wrap');
  const row = el('div', 'row');
  row.setAttribute('role', 'button');
  row.tabIndex = 0;
  const open = board.open === p.id;
  row.setAttribute('aria-expanded', String(open));
  row.setAttribute('aria-label', (p.symbol || 'Pair') + ' against ' + (p.quote || 'quote') + ', toggle depth');

  const pair = el('div', 'cell c-pair');
  const names = el('span', 'names');
  names.append(el('span', 'sym', p.symbol || DASH), el('span', 'quo', p.quote ? '/ ' + p.quote : ''));
  pair.append(logo(p), names);

  const price = el('div', 'cell c-price', fmtPrice(p.price));

  const vol = el('div', 'cell c-vol');
  const volNum = el('span', 'num', fmtCompactUsd(p.volume));
  const before = board.prevVol.get(p.id);
  if (before !== undefined && before !== p.volume) volNum.classList.add('flash');
  const bar = el('span', 'bar');
  bar.style.setProperty('--w', (maxVol > 0 && p.volume ? Math.max(4, Math.round((p.volume / maxVol) * 100)) : 0) + '%');
  vol.append(volNum, bar);

  const chg = el('div', 'cell c-chg ' + (p.change > 0 ? 'up' : p.change < 0 ? 'down' : ''), fmtPct(p.change));
  const chev = el('span', 'chev', 'â€º');
  chev.setAttribute('aria-hidden', 'true');
  chg.append(chev);

  row.append(pair, price, vol, chg);

  const detail = el('div', 'detail');
  detail.hidden = !open;
  detail.append(
    detailCell('Depth', fmtCompactUsd(p.liquidity)),
    detailCell('Venue', p.dex || DASH),
    detailCell('Buys 24h', fmtInt(p.buys)),
    detailCell('Sells 24h', fmtInt(p.sells))
  );

  const toggle = () => {
    board.open = board.open === p.id ? null : p.id;
    $$('.row', rowsEl).forEach((r) => {
      const w = r.parentElement;
      const isOpen = w.dataset.id === board.open;
      r.setAttribute('aria-expanded', String(isOpen));
      $('.detail', w).hidden = !isOpen;
    });
  };
  row.addEventListener('click', toggle);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  wrap.dataset.id = p.id;
  wrap.append(row, detail);
  return wrap;
}

function renderBoard() {
  if (!rowsEl) return;
  if (!board.all) {
    if (board.failed) {
      rowsEl.replaceChildren();
      const msg = el('div', 'board-empty');
      msg.append(el('span', 'dash-big', DASH + '  ' + DASH + '  ' + DASH), el('span', null, 'The pairs feed did not answer. Trying again shortly.'));
      rowsEl.append(msg);
    }
    return;
  }
  const top = rank(board.all, board.mode, 8);
  const maxVol = Math.max(0, ...top.map((p) => p.volume || 0));
  const frag = document.createDocumentFragment();
  top.forEach((p) => frag.append(buildRow(p, maxVol)));
  rowsEl.replaceChildren(frag);
  board.prevVol = new Map(board.all.map((p) => [p.id, p.volume]));
  rowsEl.classList.remove('is-stale');
}

function renderTicker() {
  if (!tickerEl || !board.all) return;
  const top = rank(board.all, 'volume', 12);
  const frag = document.createDocumentFragment();
  for (let pass = 0; pass < 2; pass++) {
    top.forEach((p) => {
      const c = el('div', 'tk');
      if (pass) c.setAttribute('aria-hidden', 'true');
      c.append(el('span', 'tk-s', p.symbol || DASH), el('span', 'tk-p', fmtPrice(p.price)), el('span', 'tk-c ' + (p.change > 0 ? 'up' : p.change < 0 ? 'down' : ''), fmtPct(p.change)));
      frag.append(c);
    });
  }
  tickerEl.replaceChildren(frag);
  tickerEl.parentElement.classList.remove('is-loading');
}

function renderSide() {
  if (!sideEl || !board.all) return;
  const top = rank(board.all, 'volume', 6);
  const frag = document.createDocumentFragment();
  top.forEach((p) => {
    const r = el('div', 'srow');
    r.append(el('span', 'ssym', p.symbol || DASH), el('span', 'sprice', fmtPrice(p.price)), el('span', 'svol', fmtCompactUsd(p.volume)));
    frag.append(r);
  });
  sideEl.replaceChildren(frag);
}

function renderPhone() {
  const host = $('#phone-rows');
  if (!host || !board.all) return;
  const top = rank(board.all, 'volume', 2);
  host.replaceChildren(...top.map((p) => {
    const r = el('div', 'prow');
    r.append(el('span', null, p.symbol || DASH), el('span', 'sub', fmtPrice(p.price)));
    return r;
  }));
}

let pairsSeen = false;
if (cfg.dex) {
  createPoller({
    interval: 30000,
    base: 2000,
    env,
    task: async () => {
      const list = parsePairs(await fetchJson(cfg.dex + '/latest/dex/search?q=SOL%20USDC'), cfg.tag);
      if (!list || !list.length) throw new Error('shape');
      return list;
    },
    onResult: (list) => {
      pairsSeen = true;
      board.failed = false;
      board.all = list;
      renderBoard();
      renderTicker();
      renderSide();
      renderPhone();
      const lead = rank(list, 'volume', 1)[0];
      const total = list.reduce((s, p) => s + (p.volume || 0), 0);
      bind('lead-vol', lead ? lead.volume : null, fmtCompactUsd);
      bindText('lead-sym', lead && lead.symbol ? lead.symbol + ' leads the board' : DASH);
      bind('pair-total', total || null, fmtCompactUsd);
    },
    onError: (_e, { failures }) => {
      if (pairsSeen) { rowsEl && rowsEl.classList.add('is-stale'); return; }
      if (failures >= 2) {
        board.failed = true;
        renderBoard();
        bind('lead-vol', null, fmtCompactUsd);
        bind('pair-total', null, fmtCompactUsd);
        bindText('lead-sym', DASH);
        tickerEl && tickerEl.parentElement.classList.remove('is-loading');
        tickerEl && tickerEl.replaceChildren(el('div', 'tk', DASH + '  feed unavailable'));
        sideEl && sideEl.replaceChildren(el('div', 'srow', DASH));
      }
    }
  }).start();
}

/* tabs */
const tabs = $$('[role="tab"]', $('#board-tabs') || document.createElement('div'));
function pickTab(t) {
  tabs.forEach((x) => { x.setAttribute('aria-selected', String(x === t)); x.tabIndex = x === t ? 0 : -1; });
  board.mode = t.dataset.mode;
  renderBoard();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => pickTab(t));
  t.addEventListener('keydown', (e) => {
    const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    const n = tabs[(i + k + tabs.length) % tabs.length];
    n.focus();
    pickTab(n);
  });
});

/* ---------- copy to clipboard ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'sr-only';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
document.addEventListener('click', async (e) => {
  const btn = e.target.closest ? e.target.closest('[data-copy]') : null;
  if (!btn) return;
  const ok = await copyText(btn.dataset.copy);
  const label = $('[data-copy-label]', btn);
  const status = $('[data-copy-status]');
  clearTimeout(btn._t);
  btn.dataset.copied = ok ? 'yes' : 'no';
  if (label) label.textContent = ok ? 'Copied' : 'Copy failed';
  if (status) status.textContent = ok ? 'Contract address copied' : 'Copy failed, select the address by hand';
  btn._t = setTimeout(() => {
    delete btn.dataset.copied;
    if (label) label.textContent = 'Copy';
    if (status) status.textContent = '';
  }, 1600);
});

/* ---------- mobile menu ---------- */
const menu = $('.menu');
if (menu) {
  $$('a', menu).forEach((a) => a.addEventListener('click', () => menu.removeAttribute('open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.removeAttribute('open'); });
}

/* ---------- scroll reveal: observer toggles a class, CSS does the rest ---------- */
const reveals = $$('[data-rv]');
if ('IntersectionObserver' in window && !prefersReduced()) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        const t = en.target;
        t.classList.add('in');
        t.addEventListener('transitionend', (ev) => { if (ev.propertyName === 'transform') t.classList.add('done'); }, { once: true });
        io.unobserve(t);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach((n) => io.observe(n));
} else {
  reveals.forEach((n) => n.classList.add('in'));
}

/* ---------- scroll progress: CSS scroll timeline where supported ---------- */
if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'scroll()'))) {
  const root = document.documentElement;
  const sync = () => {
    root.style.setProperty('--sy', root.scrollTop);
    root.style.setProperty('--doc', root.scrollHeight);
    root.style.setProperty('--view', root.clientHeight);
  };
  window.addEventListener('scroll', sync, { passive: true });
  sync();
}

/* ---------- hero field ---------- */
const field = $('#field');
if (field) startField(field);

/* ---------- simulator: live prices, play-money stakes ---------- */
const sim = { round: null, idx: 0, coin: null, stake: 5, nextAt: 0, lastDrift: 0 };
const $id = (id) => document.getElementById(id);
const mirror = (key, text) => $$('[data-mirror="' + key + '"]').forEach((n) => { n.textContent = text; });

function livePrice() {
  if (!board.all || !sim.coin) return null;
  const p = board.all.find((x) => x.id === sim.coin.id);
  return p && p.price ? p.price : sim.coin.price;
}

function paintSides() {
  const r = sim.round;
  if (!r) return;
  const s = shares(r);
  $id('m-yes-p').textContent = s.yes + '%';
  $id('m-no-p').textContent = s.no + '%';
  $id('m-yes').style.setProperty('--p', s.yes + '%');
  $id('m-no').style.setProperty('--p', s.no + '%');
  mirror('yes', s.yes + '%');
  mirror('no', s.no + '%');
  setValue($id('m-pool'), pool(r), fmtInt);
  const e = estimate(r);
  $id('m-est').textContent = e
    ? 'If ' + r.mine.side.toUpperCase() + ' wins you get back ' + fmtInt(e.payout) + ' play USDC (' + e.multiple.toFixed(2) + 'x), stake included.'
    : 'Choose a side to see a sample return.';
}

function setLocked(locked) {
  ['m-yes', 'm-no'].forEach((id) => { $id(id).disabled = locked; });
  $$('.chip-b').forEach((b) => { b.disabled = locked; });
}

function startRound(now) {
  const top = board.all ? rank(board.all.filter((p) => p.price && p.symbol && !/^(USD|EUR|PYUSD)|-/.test(p.symbol)), 'volume', 3) : [];
  if (!top.length) return false;
  sim.coin = top[sim.idx % top.length];
  sim.round = createRound({ now, price: sim.coin.price });
  sim.lastDrift = now;
  $id('m-stamp').hidden = true;
  $id('m-sym').textContent = sim.coin.symbol || DASH;
  mirror('sym', sim.coin.symbol || DASH);
  const strike = fmtPrice(sim.coin.price);
  const st = $id('m-strike');
  st.classList.remove('sk');
  st.textContent = strike;
  mirror('strike', strike);
  ['m-yes', 'm-no'].forEach((id) => $id(id).setAttribute('aria-pressed', 'false'));
  $id('m-pool')._v = undefined;
  setLocked(false);
  paintSides();
  return true;
}

function simTick() {
  if (document.hidden) return;
  const now = Date.now();
  if (!sim.round) {
    if (now >= sim.nextAt) startRound(now);
    return;
  }
  const r = sim.round;
  const left = remaining(r, now);
  const label = clockLabel(left);
  $id('m-clock').textContent = label;
  mirror('clock', label);
  const rest = 100 - elapsedPct(r, now) + '%';
  $$('.rhythm').forEach((el) => el.style.setProperty('--rest', rest));
  const px = livePrice();
  $id('m-now').textContent = fmtPrice(px);
  if (left > 0) {
    setLocked(isLocked(r, now));
    if (now - sim.lastDrift > 1400 && Math.random() < 0.6) {
      sim.lastDrift = now;
      const d = drift(r);
      paintSides();
      const add = $id('m-add');
      add.textContent = '+' + d.amount + ' ' + d.side.toUpperCase();
      flash(add);
    }
  } else if (!r.closed) {
    settle(r, px || r.strike);
    const out = $id('m-stamp');
    out.hidden = false;
    $id('m-result').textContent = r.result;
    $id('m-print').textContent = 'Print ' + fmtPrice(r.print) + ' against strike ' + fmtPrice(r.strike) + (r.mine ? ' · you ' + (r.payout ? 'collect ' + fmtInt(r.payout) : 'miss') + ' (play money)' : '');
    $id('m-last').textContent = (sim.coin.symbol || DASH) + ' closed ' + r.result;
    setLocked(true);
    sim.nextAt = now + 6000;
    sim.idx += 1;
    sim.round = null;
    sim.holdStamp = true;
  }
}

if ($id('sim')) {
  const sides = { 'm-yes': 'yes', 'm-no': 'no' };
  Object.keys(sides).forEach((id) => $id(id).addEventListener('click', () => {
    const r = sim.round;
    if (!r || r.closed || isLocked(r, Date.now())) return;
    pick(r, sides[id], sim.stake);
    Object.keys(sides).forEach((o) => $id(o).setAttribute('aria-pressed', String(o === id)));
    paintSides();
  }));
  $$('.chip-b').forEach((b) => b.addEventListener('click', () => {
    sim.stake = Number(b.dataset.stake);
    $$('.chip-b').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const r = sim.round;
    if (r && r.mine && !isLocked(r, Date.now())) { pick(r, r.mine.side, sim.stake); paintSides(); }
  }));
  setLocked(true);
  setInterval(simTick, 250);
}
