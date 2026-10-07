// Formatting. Anything missing or non-finite becomes the dash.
export const DASH = '—';
const ok = (n) => typeof n === 'number' && Number.isFinite(n);

export function fmtInt(n) {
  return ok(n) ? Math.round(n).toLocaleString('en-US') : DASH;
}

export function fmtCompactUsd(n) {
  if (!ok(n)) return DASH;
  const abs = Math.abs(n);
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [v, s] of units) {
    if (abs >= v) return '$' + (n / v).toFixed(abs >= v * 100 ? 0 : abs >= v * 10 ? 1 : 2) + s;
  }
  return '$' + n.toFixed(0);
}

export function fmtPrice(n) {
  if (!ok(n)) return DASH;
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  if (n === 0) return '$0';
  return '$' + n.toPrecision(3);
}

export function fmtPct(n) {
  if (!ok(n)) return DASH;
  const s = Math.abs(n).toFixed(Math.abs(n) >= 100 ? 0 : 2);
  return (n > 0 ? '▲ ' : n < 0 ? '▼ ' : '') + s + '%';
}

export function fmtMs(n) {
  return ok(n) ? Math.round(n) + ' ms' : DASH;
}

export function fmtRate(n) {
  return ok(n) ? n.toFixed(1) + ' / s' : DASH;
}
