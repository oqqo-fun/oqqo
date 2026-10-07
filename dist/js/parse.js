// Response parsers. Each returns null for a shape it cannot trust, so callers fall back to a dash.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);

export function parseSlot(json) {
  const n = json && typeof json === 'object' ? json.result : null;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function parseLockedValue(chains, slug = 'solana') {
  if (!Array.isArray(chains)) return null;
  const hit = chains.find((c) => c && typeof c.name === 'string' && c.name.toLowerCase().replace(/\s+/g, '-') === slug);
  return hit ? num(hit.tvl) : null;
}

export function parsePairs(json, tag = 'solana', limit = 8) {
  const list = json && Array.isArray(json.pairs) ? json.pairs : null;
  if (!list) return null;
  const seen = new Set();
  const out = [];
  for (const p of list) {
    if (!p || p.chainId !== tag) continue;
    const key = p.pairAddress || p.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const base = p.baseToken || {};
    const quote = p.quoteToken || {};
    const tx = (p.txns && p.txns.h24) || {};
    out.push({
      id: String(key),
      symbol: typeof base.symbol === 'string' && base.symbol ? base.symbol.slice(0, 14) : null,
      quote: typeof quote.symbol === 'string' && quote.symbol ? quote.symbol.slice(0, 14) : null,
      dex: typeof p.dexId === 'string' ? p.dexId : null,
      price: num(p.priceUsd),
      volume: num(p.volume && p.volume.h24),
      change: num(p.priceChange && p.priceChange.h24),
      liquidity: num(p.liquidity && p.liquidity.usd),
      buys: num(tx.buys),
      sells: num(tx.sells),
      logo: p.info && typeof p.info.imageUrl === 'string' && /^https:\/\/(cdn|dd)\.dexscreener\.com\//.test(p.info.imageUrl) ? p.info.imageUrl : null
    });
  }
  return out.slice(0, limit * 4);
}

export const SORTS = {
  volume: (a, b) => (b.volume ?? -1) - (a.volume ?? -1),
  move: (a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0),
  depth: (a, b) => (b.liquidity ?? -1) - (a.liquidity ?? -1)
};

export function rank(pairs, mode, limit = 8) {
  const fn = SORTS[mode] || SORTS.volume;
  return pairs.slice().sort(fn).slice(0, limit);
}
