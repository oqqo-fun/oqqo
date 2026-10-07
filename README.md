# Oqqo

Oqqo is a protocol for short YES-or-NO rounds on Solana coins. A round lasts ninety seconds. A strike is fixed at the last traded price, participants back a side, and the closing price decides which side splits the stakes.

This repository holds the public site for [oqqo.fun](https://oqqo.fun) and the design documents behind the protocol.

## What the site does

- Shows a live **simulator** of a round. Prices are real, stakes are play money, nothing moves on chain.
- Reads the Solana **slot** from a public node every two seconds and reports chain health as Live, Connecting or Offline.
- Reads Solana **locked value** from DefiLlama and the busiest **pairs** from DexScreener.
- Shows a dash when a source fails, backs off with jitter before retrying, and sleeps while the tab is hidden.

## Layout

| Path | Purpose |
| --- | --- |
| `src/` | Page template, styles, scripts, register and tokens |
| `src/register.json` | One record per external fact: chain, RPC, contract, X, GitHub, feeds |
| `src/tokens.json` | The only file that holds colour literals |
| `tools/build.mjs` | Static build, writes `dist/` |
| `tools/gates.mjs` | The release gates |
| `brand/`, `reference/` | Supplied brand art and the study notes. Read only |
| `docs/` | Whitepaper, tokenomics, roadmap, architecture |

## Commands

```bash
npm run build   # writes dist/
npm run gates   # builds fixtures and checks every gate, exits non-zero on failure
npm run serve   # serves dist/ on http://localhost:4173
```

Nothing to install. The build and the gates use only Node 20 or newer.

## Deploying

Upload the contents of `dist/`. The `_headers` file carries the Content Security Policy and is understood by Cloudflare Pages.

## The register

Every outside fact lives in `src/register.json` as a single record with a state of `stated`, `absent` or `unconfirmed`. Only a `stated` record may render a value or a link. To announce the contract address, set `contract.state` to `stated` and put the address in `value`. The build checks that it is a base58 string of 32 to 44 characters. The same applies to the X and GitHub records, which store a full profile URL; the handle is derived from it.

## Licence

MIT. See `LICENSE`.
