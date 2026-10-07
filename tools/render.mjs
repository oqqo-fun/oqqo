// Register-driven markup. Pure functions: register in, strings out.
import { isBase58Ca, deriveHandle } from '../src/js/gate.js';

export const STATES = ['stated', 'absent', 'unconfirmed'];

const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
const ICON_GH = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isHttpsUrl = (v) => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };

export function validateRegister(reg) {
  const errs = [];
  const recs = reg && reg.records;
  if (!recs || typeof recs !== 'object') return ['register has no records'];
  for (const need of ['chain', 'rpc', 'contract', 'x', 'github', 'lockedValueFeed', 'pairsFeed']) {
    if (!recs[need]) errs.push('missing record: ' + need);
  }
  for (const [id, r] of Object.entries(recs)) {
    if (!STATES.includes(r.state)) { errs.push(id + ': state must be stated, absent or unconfirmed'); continue; }
    if (typeof r.label !== 'string') errs.push(id + ': label missing');
    if (r.state === 'stated') {
      if (typeof r.value !== 'string' || !r.value.trim()) errs.push(id + ': stated record needs a value');
    } else if (r.value !== null) {
      errs.push(id + ': ' + r.state + ' record must carry a null value');
    }
  }
  const c = recs.contract;
  if (c && c.state === 'stated' && !isBase58Ca(c.value)) errs.push('contract: value is not a base58 string of 32 to 44 characters');
  for (const k of ['x', 'github']) {
    const r = recs[k];
    if (r && r.state === 'stated' && !deriveHandle(k, r.value)) errs.push(k + ': value is not an https profile URL on the expected host');
  }
  for (const k of ['rpc', 'lockedValueFeed', 'pairsFeed']) {
    const r = recs[k];
    if (r && r.state === 'stated' && !isHttpsUrl(r.value)) errs.push(k + ': value must be an https URL');
  }
  return errs;
}

const stated = (r) => r && r.state === 'stated';

export function renderSocial(reg) {
  const one = (kind, name, icon) => {
    const rec = reg.records[kind];
    const handle = stated(rec) ? deriveHandle(kind, rec.value) : null;
    if (handle) {
      return '<a class="soc" href="' + esc(rec.value) + '" target="_blank" rel="noopener noreferrer" data-social="' + kind + '" data-state="stated" aria-label="Oqqo on ' + name + ' (' + (kind === 'x' ? '@' : '') + esc(handle) + ')">' + icon + '</a>';
    }
    return '<span class="soc" role="img" aria-disabled="true" data-social="' + kind + '" data-state="' + esc(rec.state) + '" aria-label="' + name + ', link not announced yet">' + icon + '</span>';
  };
  return '<div class="social">' + one('x', 'X', ICON_X) + one('github', 'GitHub', ICON_GH) + '</div>';
}

export function renderCa(reg) {
  const c = reg.records.contract;
  if (stated(c) && isBase58Ca(c.value)) {
    const v = esc(c.value);
    return '<div class="ca" data-ca-state="stated"><div class="shell ca-in"><span class="ca-label">Contract</span>' +
      '<button type="button" class="ca-value" data-copy="' + v + '" aria-label="Copy contract address ' + v + '"><span class="ca-text">' + v + '</span><span class="ca-act" data-copy-label>Copy</span></button>' +
      '<span class="sr-only" role="status" aria-live="polite" data-copy-status></span></div></div>';
  }
  return '<div class="ca is-inert" data-ca-state="' + esc(c.state) + '"><div class="shell ca-in"><span class="ca-label">Contract</span>' +
    '<span class="ca-value" aria-disabled="true"><span class="ca-text">Address not announced yet. It will appear here in full.</span><span class="ca-act">Pending</span></span></div></div>';
}

const STATE_WORD = { stated: 'Confirmed', absent: 'Pending', unconfirmed: 'Unverified' };

export function renderTiles(reg) {
  const r = reg.records;
  const tile = (key, label, state, body) =>
    '<div class="tile" data-tile="' + key + '"><div class="tile-k"><span>' + label + '</span><span class="tile-s" data-state="' + state + '">' + STATE_WORD[state] + '</span></div>' + body + '</div>';

  const chain = stated(r.chain)
    ? tile('chain', 'Chain', 'stated', '<div class="tile-v">' + esc(r.chain.value) + '</div>')
    : tile('chain', 'Chain', r.chain.state, '<div class="tile-v is-empty">Not announced yet</div>');

  let contract;
  if (stated(r.contract) && isBase58Ca(r.contract.value)) {
    const v = esc(r.contract.value);
    contract = tile('contract', 'Contract', 'stated', '<button type="button" class="tile-v mono" data-copy="' + v + '" aria-label="Copy contract address ' + v + '"><span>' + v + '</span> <span class="tile-copy" data-copy-label>Copy</span></button>');
  } else {
    contract = tile('contract', 'Contract', r.contract.state, '<div class="tile-v is-empty">Not announced yet</div>');
  }

  let rpc;
  if (stated(r.rpc)) {
    rpc = tile('rpc', 'RPC', 'stated', '<div class="tile-v mono">' + esc(new URL(r.rpc.value).host) + '</div>');
  } else {
    rpc = tile('rpc', 'RPC', r.rpc.state, '<div class="tile-v is-empty">Not announced yet</div>');
  }
  return chain + contract + rpc;
}

export function feedOrigins(reg) {
  const out = [];
  for (const k of ['rpc', 'lockedValueFeed', 'pairsFeed']) {
    if (stated(reg.records[k])) out.push(new URL(reg.records[k].value).origin);
  }
  return out;
}

export function cspString(reg, { headerOnly = false } = {}) {
  const parts = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' https://cdn.dexscreener.com https://dd.dexscreener.com",
    'connect-src ' + (feedOrigins(reg).join(' ') || "'none'"),
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'"
  ];
  if (headerOnly) parts.push("frame-ancestors 'none'");
  return parts.join('; ');
}

export function renderMeta(reg, tokens) {
  const m = [];
  const r = reg.records;
  if (stated(r.rpc)) m.push('<meta name="oqqo-rpc" content="' + esc(r.rpc.value) + '">');
  if (stated(r.lockedValueFeed)) m.push('<meta name="oqqo-llama" content="' + esc(r.lockedValueFeed.value) + '" data-slug="' + esc(r.lockedValueFeed.slug || 'solana') + '">');
  if (stated(r.pairsFeed)) m.push('<meta name="oqqo-dex" content="' + esc(r.pairsFeed.value) + '" data-tag="' + esc(r.pairsFeed.tag || 'solana') + '">');
  m.push('<meta name="theme-color" content="' + esc(tokens['n-0']) + '">');
  return m.join('\n');
}

export function renderFavicon(tokens) {
  const bg = tokens['n-950'];
  const ring = tokens['brand-lime'];
  // Two open rings echo the brand mark: geometric, no text, no XML comments.
  return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="Oqqo">' +
    '<rect width="32" height="32" rx="8" fill="' + bg + '"/>' +
    '<circle cx="16" cy="16" r="10.5" fill="none" stroke="' + ring + '" stroke-width="3.4" stroke-dasharray="29 4.5 29 3.5" transform="rotate(-165 16 16)"/>' +
    '<circle cx="16" cy="16" r="5.2" fill="none" stroke="' + ring + '" stroke-width="2.8" stroke-dasharray="27 5.7" transform="rotate(-165 16 16)"/>' +
    '</svg>\n';
}
