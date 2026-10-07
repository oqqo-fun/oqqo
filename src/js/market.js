// Simulator round logic. Pure: time and randomness are passed in, so gates can run it on a fast clock.
export const ROUND_MS = 90000;
export const LOCK_MS = 10000;

export function createRound({ now, price, rng = Math.random }) {
  const yes = 400 + Math.floor(rng() * 600);
  const no = 400 + Math.floor(rng() * 600);
  return { t0: now, strike: price, yes, no, mine: null, closed: false, result: null, print: null };
}

export function remaining(round, now) {
  return Math.max(0, ROUND_MS - (now - round.t0));
}

export const isLocked = (round, now) => remaining(round, now) <= LOCK_MS;

export function clockLabel(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export const pool = (round) => round.yes + round.no;

export function shares(round) {
  const y = Math.round((100 * round.yes) / pool(round));
  return { yes: y, no: 100 - y };
}

export function elapsedPct(round, now) {
  return Math.min(100, Math.max(0, ((now - round.t0) / ROUND_MS) * 100));
}

// One play-money pick per round. Choosing again moves the stake to the other side.
export function pick(round, side, amount) {
  if (round.closed) return round;
  if (round.mine) round[round.mine.side] -= round.mine.amount;
  round.mine = { side, amount };
  round[side] += amount;
  return round;
}

// Other simulated participants add stakes while the round is open.
export function drift(round, rng = Math.random) {
  const side = rng() < 0.5 ? 'yes' : 'no';
  const amount = 5 + Math.floor(rng() * 55);
  round[side] += amount;
  return { side, amount };
}

export function estimate(round) {
  if (!round.mine) return null;
  const sideTotal = round[round.mine.side];
  const multiple = pool(round) / sideTotal;
  return { multiple, payout: multiple * round.mine.amount };
}

// The simulator prints the last feed price nudged by a small simulated tick (up to 0.2%).
export function settle(round, lastPrice, rng = Math.random) {
  const print = lastPrice * (1 + (rng() - 0.5) * 0.004);
  round.closed = true;
  round.print = print;
  round.result = print > round.strike ? 'YES' : 'NO';
  const won = round.mine && round.mine.side.toUpperCase() === round.result;
  round.payout = won ? estimate(round).payout : 0;
  return round;
}
