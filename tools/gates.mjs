// Release gates. 30 gates, synthetic fixtures only, fast fake clock. Exit code 1 if any gate fails.
// Mutation anchors read the current register at run time and flip whatever state they find.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, '.gate-tmp');
const read = (p) => readFileSync(join(root, p), 'utf8');
const mod = (p) => import(pathToFileURL(join(root, p)).href);

const { isBase58Ca, deriveHandle } = await mod('src/js/gate.js');
const { backoffDelay, createPoller, nextHealth } = await mod('src/js/net.js');
const { parseSlot, parseLockedValue, parsePairs, rank } = await mod('src/js/parse.js');
const fmt = await mod('src/js/fmt.js');
const market = await mod('src/js/market.js');
const { validateRegister } = await mod('tools/render.mjs');

/* ---------- synthetic fixtures ---------- */
let seed = 20251;
const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const synth = (n) => Array.from({ length: n }, () => B58[Math.floor(rng() * B58.length)]).join('');
const SYN_CA = synth(44);
const SYN_X = 'https://x.com/oqqo_fixture';
const SYN_GH = 'https://github.com/oqqo-fixture';

const baseReg = JSON.parse(read('src/register.json'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const setRec = (reg, id, state) => {
  const r = reg.records[id];
  r.state = state;
  r.value = state === 'stated' ? { contract: SYN_CA, x: SYN_X, github: SYN_GH }[id] : null;
};
// Mutation: flip the CURRENT state of each record. Nothing here assumes what the state is today.
const flipped = clone(baseReg);
for (const id of ['contract', 'x', 'github']) setRec(flipped, id, baseReg.records[id].state === 'stated' ? 'absent' : 'stated');
const allAbsent = clone(baseReg); for (const id of ['contract', 'x', 'github']) setRec(allAbsent, id, 'absent');
const allStated = clone(baseReg); for (const id of ['contract', 'x', 'github']) setRec(allStated, id, 'stated');
const badCa = clone(allStated); badCa.records.contract.value = synth(31);

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
function build(name, reg) {
  const regPath = join(tmp, name + '.json');
  writeFileSync(regPath, JSON.stringify(reg));
  const out = join(tmp, name);
  const r = spawnSync(process.execPath, [join(root, 'tools', 'build.mjs')], { env: { ...process.env, OQQO_OUT: out, OQQO_REGISTER: regPath }, encoding: 'utf8' });
  return { out, status: r.status, stderr: r.stderr };
}
const B = {
  absent: build('absent', allAbsent),
  stated: build('stated', allStated),
  flip: build('flip', flipped),
  bad: build('bad', badCa)
};
const html = (b) => readFileSync(join(b.out, 'index.html'), 'utf8');

/* ---------- helpers ---------- */
function walk(dir, skip = []) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (skip.some((s) => p.includes(s))) continue;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, skip)); else out.push(p);
  }
  return out;
}
const eq = (a, b, msg) => { if (a !== b) throw new Error((msg || 'mismatch') + ': got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const visibleText = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
const srcFiles = () => walk(join(root, 'src')).filter((f) => !f.endsWith('tokens.json'));
const css = read('src/css/base.css');
const main = read('src/js/main.js');

/* fast clock for poller gates */
function fakeEnv() {
  let now = 0; const q = []; let hidden = false; let vis = null;
  return {
    q, get now() { return now; },
    setTimeout(f, ms) { const t = { f, at: now + ms, id: q.length + 1 }; q.push(t); return t.id; },
    clearTimeout(id) { const i = q.findIndex((t) => t.id === id); if (i >= 0) q.splice(i, 1); },
    rng: () => 0.5,
    isHidden: () => hidden,
    onVisibility(f) { vis = f; },
    setHidden(h) { hidden = h; vis && vis(); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        q.sort((a, b) => a.at - b.at);
        if (!q.length || q[0].at > end) break;
        const t = q.shift(); now = t.at; t.f();
        await new Promise((r) => setImmediate(r));
      }
      now = end;
    }
  };
}

const gates = [];
const gate = (name, fn) => gates.push({ name, fn });

/* 1 */ gate('build: default register builds and writes dist files', () => {
  const b = build('default', baseReg);
  eq(b.status, 0, 'build exit ' + b.stderr);
  for (const f of ['index.html', 'favicon.svg', 'css/tokens.css', 'css/base.css', 'js/main.js', 'js/boot.js', '_headers', 'assets/logo-light.png', 'assets/cover.jpg']) ok(existsSync(join(b.out, f)), 'missing ' + f);
});
/* 2 */ gate('register: valid, one record per fact, states legal, no value on unstated', () => {
  eq(validateRegister(baseReg).length, 0, validateRegister(baseReg).join('; '));
  for (const r of Object.values(baseReg.records)) ok(['stated', 'absent', 'unconfirmed'].includes(r.state), 'bad state');
  for (const id of ['chain', 'rpc', 'contract', 'x', 'github']) ok(baseReg.records[id], 'record ' + id);
});
/* 3 */ gate('base58 gate: accepts 32 and 44 boundaries and 300 seeded strings', () => {
  ok(isBase58Ca(synth(32)) && isBase58Ca(synth(44)), 'boundaries');
  for (let i = 0; i < 300; i++) ok(isBase58Ca(synth(32 + Math.floor(rng() * 13))), 'random accepted');
});
/* 4 */ gate('base58 gate: never blanket-rejects, every alphabet char works as first char', () => {
  for (const c of B58) ok(isBase58Ca(c + synth(40)), 'first char ' + c);
});
/* 5 */ gate('base58 gate: rejects wrong length, 0x hex and 0 O I l', () => {
  ok(!isBase58Ca(synth(31)) && !isBase58Ca(synth(45)) && !isBase58Ca(''), 'length');
  ok(!isBase58Ca('0x' + 'a'.repeat(40)), 'hex');
  for (const c of '0OIl') ok(!isBase58Ca(c + synth(40)), 'char ' + c);
});
/* 6 */ gate('branch ABSENT: contract slot inert, social icons inert, no hrefs, tile says pending', () => {
  eq(B.absent.status, 0, 'build');
  const h = html(B.absent);
  ok(/data-ca-state="absent"/.test(h) && /class="ca is-inert"/.test(h), 'inert strip');
  ok(!/data-copy="/.test(h), 'copy attr must not exist');
  ok(!/href="https:\/\/(x|twitter|github)\.com/.test(h), 'no social hrefs');
  eq((h.match(/<span class="soc"[^>]*aria-disabled="true"/g) || []).length, 2, 'two inert icons');
  ok(/data-tile="contract"[\s\S]*?Not announced yet/.test(h), 'tile text');
});
/* 7 */ gate('branch STATED: full address, click-to-copy, exact hrefs, derived handles', () => {
  eq(B.stated.status, 0, 'build');
  const h = html(B.stated);
  ok(h.includes('data-copy="' + SYN_CA + '"') && h.includes('<span class="ca-text">' + SYN_CA + '</span>'), 'full address');
  ok(h.includes('href="' + SYN_X + '"') && h.includes('href="' + SYN_GH + '"'), 'hrefs');
  ok(h.includes('(@oqqo_fixture)') && h.includes('(oqqo-fixture)'), 'derived handles');
  ok(/data-ca-state="stated"/.test(h) && /data-copied|data-copy-label/.test(h), 'copy feedback hooks');
});
/* 8 */ gate('mutation: flipping the current state flips the rendered branch (state-independent)', () => {
  eq(B.flip.status, 0, 'build');
  const h = html(B.flip);
  const nowStated = baseReg.records.contract.state === 'stated';
  eq(/data-ca-state="stated"/.test(h), !nowStated, 'contract flipped');
  eq(h.includes('href="' + SYN_X + '"'), baseReg.records.x.state !== 'stated', 'x flipped');
  eq(h.includes('href="' + SYN_GH + '"'), baseReg.records.github.state !== 'stated', 'github flipped');
});
/* 9 */ gate('gate warning: a stated 31-char contract fails the build, never silently renders', () => {
  ok(B.bad.status !== 0, 'build must fail');
  ok(/base58/.test(B.bad.stderr), 'explains why');
});
/* 10 */ gate('social: both icons top-right in header at every breakpoint, icon only', () => {
  const h = html(B.absent);
  const head = h.match(/<header[\s\S]*?<\/header>/)[0];
  ok(/class="head-end"[\s\S]*class="social"/.test(head), 'inside head-end');
  const socials = head.match(/<(?:a|span) class="soc"[\s\S]*?<\/(?:a|span)>/g);
  eq(socials.length, 2, 'two icons');
  for (const s of socials) eq(s.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '').trim(), '', 'no text label');
  ok(!/\.(social|soc)\b[^{]*\{[^}]*display:\s*none/.test(stripComments(css)), 'never hidden');
  const mediaBlocks = css.match(/@media[^{]+\{[\s\S]*?\n\}/g) || [];
  for (const m of mediaBlocks) ok(!/\.soc\b|\.social\b/.test(m), 'no breakpoint touches social');
});
/* 11 */ gate('social: official X mark and GitHub Octicon paths', () => {
  const h = html(B.absent);
  ok(h.includes('M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17'), 'X path');
  ok(h.includes('M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59'), 'octicon path');
});
/* 12 */ gate('tiles: only Chain, Contract, RPC; no X or GitHub tile', () => {
  const h = html(B.stated);
  const tiles = [...h.matchAll(/data-tile="([a-z]+)"/g)].map((m) => m[1]);
  eq(tiles.join(','), 'chain,contract,rpc');
});
/* 13 */ gate('palette: chroma exactly 0 everywhere except tokens sampled from brand art', () => {
  const t = JSON.parse(read('src/tokens.json'));
  let n = 0;
  for (const [k, v] of Object.entries(t)) {
    for (const m of v.matchAll(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)) {
      n++;
      if (k.startsWith('brand-lime')) ok(Number(m[2]) > 0 && Math.abs(Number(m[3]) - 123.7) < 0.01, k + ' must carry the sampled brand hue');
      else eq(Number(m[2]), 0, k + ' chroma');
    }
  }
  ok(n > 20, 'tokens present');
  ok(t['brand-lime'] === 'oklch(0.884 0.206 123.7)', 'brand lime equals value sampled from brand/LOGO OQQO PNG');
});
/* 14 */ gate('palette: no colour literal outside the tokens file', () => {
  const bad = [];
  for (const f of srcFiles()) {
    let s = readFileSync(f, 'utf8');
    if (f.endsWith('.css')) s = stripComments(s);
    if (/oklch\(|rgba?\(|hsla?\(|hwb\(|lab\(|lch\(|oklab\(|color\(/.test(s)) bad.push(relative(root, f) + ' functional colour');
    if (/(^|[^&\w"'-])#[0-9a-fA-F]{3,8}\b/.test(s.replace(/href="#[^"]*"/g, '').replace(/&#\d+;/g, '').replace(/url\(#[^)]*\)/g, ''))) bad.push(relative(root, f) + ' hex');
    if (f.endsWith('.css') && /:[^;{}]*\b(white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|silver|navy|teal)\b[^;{}]*;/.test(s)) bad.push(relative(root, f) + ' named colour');
  }
  const r = read('tools/render.mjs');
  ok(!/oklch\(|#[0-9a-fA-F]{6}\b/.test(r), 'render.mjs carries no literal');
  eq(bad.join('; '), '');
});
/* 15 */ gate('favicon: SVG 32x32, no comments, no double hyphen, only token colours', () => {
  const svg = readFileSync(join(B.absent.out, 'favicon.svg'), 'utf8');
  ok(/width="32" height="32" viewBox="0 0 32 32"/.test(svg), 'size');
  ok(!/<!--/.test(svg) && !/--/.test(svg), 'no comment or double hyphen');
  const t = JSON.parse(read('src/tokens.json'));
  for (const m of svg.matchAll(/(?:fill|stroke)="(oklch\([^"]+\))"/g)) ok(Object.values(t).includes(m[1]), 'colour from tokens: ' + m[1]);
  ok(/<svg[^>]*>[\s\S]*<\/svg>/.test(svg) && !/<text/.test(svg), 'geometric only');
});
/* 16 */ gate('csp: header and meta cover every live origin and nothing else in connect-src', () => {
  const h = html(B.stated); const hd = readFileSync(join(B.stated.out, '_headers'), 'utf8');
  const origins = ['https://solana-rpc.publicnode.com', 'https://api.llama.fi', 'https://api.dexscreener.com'];
  const connect = (s) => (s.match(/connect-src ([^;"]+)/) || [])[1].split(' ').sort().join(' ');
  eq(connect(h), origins.slice().sort().join(' '), 'meta');
  eq(connect(hd), origins.slice().sort().join(' '), 'header');
  ok(/https:\/\/fonts\.googleapis\.com/.test(h) && /font-src https:\/\/fonts\.gstatic\.com/.test(h), 'fonts');
  ok(/img-src 'self' https:\/\/cdn\.dexscreener\.com/.test(h), 'pair logos');
  ok(/frame-ancestors 'none'/.test(hd), 'frame-ancestors in header');
  const urls = new Set((main + read('src/js/net.js') + read('src/js/parse.js')).match(/https?:\/\/[a-z0-9.-]+/g) || []);
  for (const u of urls) ok(u.includes('dexscreener.com'), 'script contacts only register-driven origins, found ' + u);
});
/* 17 */ gate('csp strict: no unsafe-inline/eval, no inline script, style attribute or handler', () => {
  const h = html(B.stated);
  ok(!/unsafe-inline|unsafe-eval/.test(h), 'unsafe');
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(h), 'inline script');
  ok(!/\sstyle="/.test(h), 'style attribute');
  ok(!/\son[a-z]+="/.test(h), 'inline handler');
  ok(!/\.innerHTML\s*=|insertAdjacentHTML|eval\(|new Function/.test(main), 'no markup injection in main.js');
});
/* 18 */ gate('no dates rendered', () => {
  const t = visibleText(html(B.stated)) + ' ' + html(B.stated).match(/<title>[\s\S]*?<\/title>/)[0];
  ok(!/\b(19|20)\d{2}\b/.test(t), 'year');
  ok(!/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b/i.test(t), 'month day');
  ok(!/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(t), 'numeric date');
});
/* 19 */ gate('css: no ch units anywhere', () => {
  for (const f of ['src/css/base.css', 'src/index.html', 'src/js/main.js']) ok(!/\d(?:\.\d+)?ch\b/.test(read(f)), f);
});
/* 20 */ gate('tap targets: interactive controls declare at least 44x44', () => {
  const c = stripComments(css);
  ok(/\.tap\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/.test(c), '.tap');
  ok(/\.soc\s*\{[^}]*width:\s*44px;\s*height:\s*44px/.test(c), '.soc');
  ok(/\.btn-sm\s*\{[^}]*height:\s*44px/.test(c), '.btn-sm');
  ok(/\.chip-b\s*\{[^}]*min-width:\s*44px;\s*min-height:\s*44px/.test(c), '.chip-b');
  ok(/\.side\s*\{[^}]*min-height:\s*44px/.test(c), '.side');
  ok(/\.ca-value\s*\{[^}]*min-height:\s*44px/.test(c), '.ca-value');
  ok(/\.foot-nav a\s*\{[^}]*min-height:\s*44px/.test(c), 'footer links');
  const h = html(B.absent);
  for (const cls of ['menu summary', 'tab']) ok(/class="[^"]*\btap\b/.test(h), cls);
});
/* 21 */ gate('reduced motion: media query kills animation, transition and reveal hiding', () => {
  const m = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/)[0];
  ok(/animation:\s*none\s*!important/.test(m) && /transition:\s*none\s*!important/.test(m), 'disables');
  ok(/\[data-rv\][^}]*opacity:\s*1/.test(m), 'reveal visible');
  ok(/prefersReduced/.test(main) && /prefersReduced/.test(read('src/js/field.js')), 'script respects it');
});
/* 22 */ gate('backoff: exponential, capped, equal jitter within [cap/2, cap]', () => {
  const o = { base: 1000, max: 30000 };
  eq(backoffDelay(0, o, () => 0), 500); eq(backoffDelay(0, o, () => 1), 1000);
  eq(backoffDelay(3, o, () => 1), 8000); eq(backoffDelay(10, o, () => 1), 30000); eq(backoffDelay(10, o, () => 0), 15000);
  for (let i = 0; i < 200; i++) { const d = backoffDelay(i % 9, o, rng); ok(d >= Math.min(30000, 1000 * 2 ** (i % 9)) / 2 && d <= 30000, 'bounds'); }
});
/* 23 */ gate('poller (fast clock): backs off on failure, resets on success, pauses hidden, resumes visible', async () => {
  const env = fakeEnv(); let fail = true; let calls = 0; const res = []; const errs = [];
  const p = createPoller({ interval: 2000, base: 1000, max: 30000, env, task: async () => { calls++; if (fail) throw new Error('x'); return calls; }, onResult: (v) => res.push(v), onError: (_e, i) => errs.push(i.failures) });
  p.start(); await env.advance(0);
  eq(calls, 1); await env.advance(750); eq(calls, 2);
  await env.advance(1500); eq(calls, 3);
  eq(errs.join(','), '1,2,3');
  fail = false; await env.advance(4000); ok(res.length >= 1, 'success'); eq(p.failures, 0);
  const before = calls; await env.advance(2000); ok(calls > before, 'keeps polling');
  env.setHidden(true); const h = calls; await env.advance(60000); eq(calls, h, 'paused while hidden');
  env.setHidden(false); await env.advance(10); ok(calls > h, 'resumed');
  p.stop();
});
/* 24 */ gate('health: Connecting -> Live -> Offline -> Live, offline event wins', () => {
  let s = 'connecting';
  s = nextHealth(s, { type: 'fail', failures: 1 }); eq(s, 'connecting');
  s = nextHealth(s, { type: 'ok' }); eq(s, 'live');
  s = nextHealth(s, { type: 'fail', failures: 1 }); eq(s, 'live');
  s = nextHealth(s, { type: 'fail', failures: 2 }); eq(s, 'offline');
  s = nextHealth(s, { type: 'ok' }); eq(s, 'live');
  s = nextHealth(s, { type: 'offline' }); eq(s, 'offline');
  s = nextHealth(s, { type: 'online' }); eq(s, 'connecting');
  const h = html(B.absent);
  for (const w of ['Live', 'Connecting', 'Offline']) ok(main.includes(w), w);
  ok(/data-health[^>]*role="status"/.test(h) && /@keyframes pulse/.test(css), 'pill + pulse');
});
/* 25 */ gate('parsers: slot, locked value by slug solana, solana-only pairs with dash gaps', () => {
  eq(parseSlot({ result: 12 }), 12); eq(parseSlot({ result: 'x' }), null); eq(parseSlot(null), null);
  eq(parseLockedValue([{ name: 'Base', tvl: 1 }, { name: 'Solana', tvl: 42.5 }], 'solana'), 42.5);
  eq(parseLockedValue([{ name: 'Base', tvl: 1 }], 'solana'), null); eq(parseLockedValue('x', 'solana'), null);
  const pairs = parsePairs({ pairs: [
    { chainId: 'base', pairAddress: 'a', baseToken: { symbol: 'X' } },
    { chainId: 'solana', pairAddress: 'b', baseToken: { symbol: 'AAA' }, quoteToken: { symbol: 'USDC' }, priceUsd: '2', volume: { h24: 10 }, liquidity: { usd: 5 }, info: { imageUrl: 'https://cdn.dexscreener.com/x.png' } },
    { chainId: 'solana', pairAddress: 'c', baseToken: { symbol: 'BBB' }, priceUsd: 'nope', volume: { h24: 99 }, info: { imageUrl: 'https://evil.example/x.png' } },
    { chainId: 'solana', pairAddress: 'b', baseToken: { symbol: 'DUP' } }
  ] }, 'solana');
  eq(pairs.length, 2); eq(pairs[0].logo, 'https://cdn.dexscreener.com/x.png'); eq(pairs[1].logo, null); eq(pairs[1].price, null);
  eq(rank(pairs, 'volume')[0].symbol, 'BBB'); eq(rank(pairs, 'depth')[0].symbol, 'AAA'); eq(parsePairs({}, 'solana'), null);
});
/* 26 */ gate('formatting: dash fallback for missing, NaN and infinite values', () => {
  for (const f of [fmt.fmtInt, fmt.fmtCompactUsd, fmt.fmtPrice, fmt.fmtPct, fmt.fmtMs, fmt.fmtRate]) { eq(f(null), fmt.DASH); eq(f(NaN), fmt.DASH); eq(f(Infinity), fmt.DASH); eq(f(undefined), fmt.DASH); }
  eq(fmt.fmtInt(454189795), '454,189,795'); eq(fmt.fmtCompactUsd(6534669502), '$6.53B'); eq(fmt.fmtPct(-1.5), '▼ 1.50%');
});
/* 27 */ gate('simulator round (fast clock): ninety seconds, lock, shares sum to 100, settle, refund none', () => {
  eq(market.ROUND_MS, 90000);
  const r = market.createRound({ now: 0, price: 100, rng });
  eq(market.clockLabel(market.remaining(r, 0)), '01:30'); eq(market.clockLabel(market.remaining(r, 89001)), '00:01');
  eq(market.clockLabel(market.remaining(r, 200000)), '00:00');
  ok(!market.isLocked(r, 79000) && market.isLocked(r, 80000), 'lock in last ten seconds');
  market.pick(r, 'yes', 25); market.drift(r, rng);
  const s = market.shares(r); eq(s.yes + s.no, 100);
  const before = market.pool(r); market.pick(r, 'no', 25); eq(market.pool(r), before, 'switching moves the stake');
  market.settle(r, 100, () => 1); ok(r.closed && r.result === 'YES', 'print above strike');
  const r2 = market.createRound({ now: 0, price: 100, rng }); market.settle(r2, 100, () => 0); eq(r2.result, 'NO');
});
/* 28 */ gate('scroll: observer + CSS only, passive fallback listener, no scroll arithmetic', () => {
  ok(/new IntersectionObserver/.test(main) && /rootMargin: '0px 0px -8% 0px'/.test(main) && /threshold: 0\.08/.test(main), 'observer');
  const listeners = main.match(/addEventListener\('scroll'[^)]*\)/g) || [];
  for (const l of listeners) ok(/passive:\s*true/.test(l), 'passive');
  ok(!/scroll(Top|Y)\s*[-+*/%]|pageYOffset\s*[-+*/%]|getBoundingClientRect|requestAnimationFrame\([^)]*scroll/.test(main), 'no scroll math');
  ok(/animation-timeline:\s*scroll\(root block\)/.test(css) && /animation-timeline:\s*view\(\)/.test(css), 'css timelines');
  ok(/translateY\(28px\)/.test(css) && /1000ms var\(--ease\)/.test(css), 'reveal timing matches measured values');
});
/* 29 */ gate('copy: zero shared content 2-grams with the reference, no reference brand words', () => {
  const stop = new Set('a an the and or but if of on in at to for from by with as is are was were be been it its this that these those you your we our they their them he she his her i me my not no so than then there here when while what which who whom how why all any each more most some such only own same too very can will just do does did has have had into over under up down out off again further once about above after before between during through against until per via nor yet still also'.split(' '));
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const grams = (w) => { const g = new Set(); for (let i = 0; i < w.length - 1; i++) if (!stop.has(w[i]) && !stop.has(w[i + 1])) g.add(w[i] + ' ' + w[i + 1]); return g; };
  const ref = readFileSync(join(root, 'reference', 'nyes-index.html'), 'utf8').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  // Placeholders, endpoint listings and URLs are identifiers, not copy.
  const copyHtml = html(B.stated)
    .replace(/<span class="(?:[^"]*\s)?sk(?:\s[^"]*)?"[^>]*>[^<]*<\/span>/g, ' ')
    .replace(/<div class="code-body[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, ' ');
  const mine = visibleText(copyHtml) + ' ' + (read('src/index.html').match(/<(?:title|meta)[^>]*(?:content|>)[^<]*/g) || []).join(' ').replace(/https?:\/\/\S+/g, ' ');
  const rg = grams(words(ref)); const shared = [...grams(words(mine))].filter((g) => rg.has(g));
  eq(shared.join(' | '), '', 'shared bigrams');
  ok(!/nyes/i.test(html(B.stated)), 'no reference brand name');
});
/* 30 */ gate('hygiene + supporting files + live features present', () => {
  for (const f of ['CLAUDE.md', '.claude']) ok(!existsSync(join(root, f)), f + ' must not exist');
  const files = walk(root, ['node_modules', '.gate-tmp', 'dist', 'brand', 'reference', 'gates.mjs']).filter((f) => ['.md', '.js', '.mjs', '.json', '.css', '.html'].includes(extname(f)) || f.endsWith('LICENSE'));
  for (const f of files) ok(!/Co-Authored-By|Generated with|Claude|Anthropic|ChatGPT|OpenAI|AI-generated/i.test(readFileSync(f, 'utf8')), 'attribution in ' + relative(root, f));
  for (const f of ['README.md', 'docs/whitepaper.md', 'docs/tokenomics.md', 'docs/roadmap.md', 'docs/architecture.md', '.github/CONTRIBUTING.md', '.github/SECURITY.md', 'LICENSE']) {
    ok(existsSync(join(root, f)), 'missing ' + f); if (f !== 'LICENSE') ok(/Oqqo/.test(read(f)), f + ' themed');
  }
  const h = html(B.stated);
  ok(/name="oqqo-rpc"[^>]*publicnode/.test(h) && /name="oqqo-llama"[^>]*data-slug="solana"/.test(h) && /name="oqqo-dex"[^>]*data-tag="solana"/.test(h), 'feeds');
  ok(/getSlot/.test(main) && /\/v2\/chains/.test(main) && /latest\/dex\/search/.test(main), 'three calls');
  ok(/visibilitychange/.test(read('src/js/net.js')) && /class="sk"/.test(h), 'hidden-tab pause + skeletons');
  ok(/id="field"/.test(h) && /countTo/.test(read('src/js/motion.js')) && /\.flash/.test(css), 'canvas, count-up, flash');
});

/* ---------- run ---------- */
ok(gates.length <= 30, 'max 30 gates');
const t0 = Date.now(); let failed = 0;
for (const g of gates) {
  try { await g.fn(); console.log('  PASS  ' + g.name); }
  catch (e) { failed++; console.log('  FAIL  ' + g.name + '\n        ' + (e && e.message)); }
}
rmSync(tmp, { recursive: true, force: true });
console.log('\n' + (gates.length - failed) + '/' + gates.length + ' gates passed in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
process.exit(failed ? 1 : 0);
