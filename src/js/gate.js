// Contract-address gate. Solana addresses are base58 strings of 32 to 44 characters.
// The gate accepts every string in that shape. It never rejects on a guessed prefix,
// a guessed checksum or a character class beyond the base58 alphabet itself.
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isBase58Ca(value) {
  return typeof value === 'string' && B58.test(value);
}

// Register records store the URL. The handle is always derived from it.
const SEGMENT = {
  x: /^[A-Za-z0-9_]{1,15}$/,
  github: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
};
const HOSTS = {
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
  github: ['github.com', 'www.github.com']
};

export function deriveHandle(kind, url) {
  if (typeof url !== 'string') return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (!HOSTS[kind] || !HOSTS[kind].includes(u.hostname)) return null;
  const first = u.pathname.split('/').filter(Boolean)[0];
  if (!first || !SEGMENT[kind].test(first)) return null;
  return first;
}
