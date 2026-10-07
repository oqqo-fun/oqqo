# Oqqo architecture

## Pieces

```
                 +--------------------+
  browser  <---> |  static site (dist) |
     |           +--------------------+
     |  plain HTTPS reads, no keys
     +--> Solana RPC    (getSlot)
     +--> DefiLlama     (chains list, entry named solana)
     +--> DexScreener   (pair search, chainId solana)
```

There is no backend. The site is static files plus three read-only calls made by the visitor's own browser.

## Source layout

- `src/index.html` is a template with three holes filled by the build: the contract strip, the social icons and the three info tiles.
- `src/register.json` is the register. One record per external fact, each with a state of `stated`, `absent` or `unconfirmed`.
- `src/tokens.json` holds every colour literal. The build turns it into `css/tokens.css` and into the favicon.
- `src/js/` holds small modules: `gate` (address and handle checks), `net` (polling, backoff, health), `parse` (response shapes), `fmt` (dash fallback), `market` (round logic for the simulator), `motion`, `field` (hero canvas) and `main`.

## Register-driven rendering

The build reads the register, validates it and renders markup from it. An unstated record produces an inert element: no `href`, no copy button, `aria-disabled` set. A stated record produces the live element. The Content Security Policy is generated from the stated feed records, so the allowed origins can never drift from the origins the code actually contacts.

## Polling

Each feed is a poller with injected time, randomness and visibility, which is why the gates can run it on a fast fake clock.

- Success: schedule the next read at the feed's interval and reset the failure count.
- Failure: wait for an equal-jitter exponential delay, `cap/2 + random * cap/2`, where `cap = min(max, base * 2^failures)`.
- Hidden tab: stop scheduling. Resume when the tab is visible again.
- Health: Connecting until the first slot read, Live while reads succeed, Offline after two failures in a row or when the browser reports no network.

## Motion

Scroll reveals use one `IntersectionObserver` that adds a class. CSS transitions do the rest. Parallax and the progress bar use CSS scroll-driven animations. Where those are not supported, a passive scroll listener copies three raw document measurements into custom properties and CSS divides them. No scroll arithmetic runs in script.

## Simulator

`market.js` is pure. A round is created from a coin and a price, advanced by timestamps, and settled by comparing a printed price with the strike. The simulator never touches a wallet.

## Security notes

- Strict CSP: scripts and styles from the same origin, fonts from Google Fonts, connections only to the three feed origins.
- No inline script and no inline style attributes. Dynamic values are set through the CSS object model.
- Remote text is written with `textContent`, never as markup.
