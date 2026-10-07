// Polling with exponential backoff and jitter. Every dependency on time, randomness
// and page visibility is injected so the gates can drive it with a fast fake clock.

export function backoffDelay(failures, { base = 1000, max = 30000 } = {}, rng = Math.random) {
  const cap = Math.min(max, base * 2 ** Math.max(0, failures));
  // Equal jitter: half the window is fixed, half is random. Never zero, never above cap.
  return Math.round(cap / 2 + rng() * (cap / 2));
}

export function createPoller({ task, interval, base = 1000, max = 30000, env, onResult, onError }) {
  const e = env;
  let timer = null;
  let failures = 0;
  let running = false;
  let inflight = false;

  function schedule(ms) {
    clearTimer();
    timer = e.setTimeout(run, ms);
  }
  function clearTimer() {
    if (timer !== null) { e.clearTimeout(timer); timer = null; }
  }
  async function run() {
    timer = null;
    if (!running) return;
    if (e.isHidden()) return; // paused; resume() restarts on visibility
    if (inflight) return;
    inflight = true;
    try {
      const value = await task();
      failures = 0;
      onResult && onResult(value, { failures });
      inflight = false;
      if (running && !e.isHidden()) schedule(interval);
    } catch (err) {
      failures += 1;
      onError && onError(err, { failures });
      inflight = false;
      if (running && !e.isHidden()) schedule(backoffDelay(failures - 1, { base, max }, e.rng));
    }
  }
  function onVisibility() {
    if (!running) return;
    if (e.isHidden()) clearTimer();
    else if (timer === null && !inflight) run();
  }
  return {
    start() {
      if (running) return;
      running = true;
      e.onVisibility(onVisibility);
      run();
    },
    stop() { running = false; clearTimer(); },
    get failures() { return failures; }
  };
}

// Chain health: Connecting until the first read lands, Live while reads succeed,
// Offline after two failures in a row (or when the browser reports no network).
export function nextHealth(prev, event) {
  switch (event.type) {
    case 'ok': return 'live';
    case 'fail': return event.failures >= 2 ? 'offline' : prev;
    case 'offline': return 'offline';
    case 'online': return prev === 'offline' ? 'connecting' : prev;
    default: return prev;
  }
}

export function browserEnv() {
  return {
    setTimeout: (f, ms) => setTimeout(f, ms),
    clearTimeout: (t) => clearTimeout(t),
    rng: Math.random,
    isHidden: () => document.hidden,
    onVisibility: (f) => document.addEventListener('visibilitychange', f)
  };
}

export async function fetchJson(url, init = {}, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}
