# Oqqo tokenomics

## Position

No token contract has been announced. The register record for the contract is `absent`, and the site shows an inert slot until that changes. This document therefore sets out the questions the design must answer and the rules any answer must obey. It states no supply, no allocation and no price, because none has been decided.

## What a token would be for

Any Oqqo token would have to earn its place by doing one of three jobs inside the rounds, and by doing nothing that pretends to be a return:

1. **Opening.** Rewarding the openers who bring good coins to rounds.
2. **Alignment.** Giving long-term participants a voice over which depth thresholds and price sources are allowed.
3. **Backstop.** Covering the rare cost of a voided round without taxing participants.

## Rules any design must follow

- **Stated before spent.** Every parameter is published as a register record before it is used.
- **No promised yield.** Nothing is described as income, profit or appreciation.
- **No hidden allocation.** Every holder category and its schedule is public in full before any sale.
- **Stakes are separate.** Round stakes never fund token programs. They return as payouts or refunds.
- **One address.** Once announced, the contract address is shown in full at the top of the site and in this repository, and nowhere else is treated as authoritative.

## Parameters to be stated

| Parameter | State |
| --- | --- |
| Contract address | absent |
| Total supply | absent |
| Holder categories | absent |
| Release schedule | absent |
| Fee split | absent |
| Opener share | absent |

When a row changes, the register changes first and this table follows.

## Verifying an address

Solana addresses are base58 strings of 32 to 44 characters. The site accepts any string of that shape for the contract slot and renders it with click-to-copy. Always compare an address against the register in this repository before acting on it.
