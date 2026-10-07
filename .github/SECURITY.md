# Security policy

## Scope

The Oqqo repository contains a static website and design documents. The site holds no keys, asks for no wallet and moves no funds. Round logic described in `docs/` is design intent and is not deployed.

## Reporting a problem

Please report privately and give us time to respond before sharing details. Include:

- what you found and where,
- steps to reproduce it,
- what you think the impact is.

Use the contact channel announced on the site once it is published. Until a channel is stated in the register, open a minimal issue that says you have a security report, without the details, and a maintainer will arrange a private route.

## What we care about most

- Anything that could make the contract slot show an address other than the one in the register.
- Anything that turns an inert social icon into a live link without a stated record.
- Content Security Policy bypasses, script injection through feed data and clipboard misuse.
- Any change that adds a key, a wallet prompt or a transaction to the site.

## Not in scope

Findings that need a compromised browser, reports about third-party feeds being slow or wrong, and automated scanner output without a demonstrated impact.

## Safe handling of addresses

Treat the register in this repository as the single source of truth for the contract address. Compare any address you are about to use with it, character by character, before acting.
