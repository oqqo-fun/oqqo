# Oqqo whitepaper

## Summary

Oqqo is a protocol for ninety-second YES-or-NO rounds on Solana coins. It is built on one observation: a call about the next minute and a half is only worth making when the chain underneath can confirm, pay out and settle inside that window. Solana can.

This paper describes the round, the roles around it and the rules that keep it honest. It states intent. Where a figure has not been decided, it says so instead of guessing.

## The round

1. **Open.** A coin with sufficient depth is chosen. The strike is set to its last traded price.
2. **Call.** Participants back YES (the closing price is above the strike) or NO (it is not). Each stake joins the shared pool of its side.
3. **Lock.** A short interval before the end, new stakes stop. The pool is visible to everyone and can no longer move.
4. **Close.** The clock reaches zero. The closing price is read from the price source and compared with the strike.
5. **Pay.** The winning side divides the whole pool in proportion to stake. If the source cannot be trusted, the round is void and every stake is returned.

The percentages shown on each side describe where stakes sit. They are not a forecast.

## Roles

- **Participant.** Backs a side. Needs no account beyond a wallet.
- **Opener.** Starts a round on a coin. Openers may be rewarded from settled rounds; the share is not yet stated.
- **Price source.** A public feed that supplies the closing price. The protocol never overrides it.

## Principles

**Self-custody.** Stakes rest in a program account made for each round. They leave only as payouts or refunds. No operator key can move them.

**No referee.** The result is a comparison of two numbers. There is no committee, no vote and no appeal.

**Refund on doubt.** A stale, missing or contradictory price voids the round. Doubt costs participants nothing.

**Depth before listing.** A coin must have real liquidity before it can host a round, because a thin book can be pushed past a strike cheaply.

## What the public site shows

The site reads three public feeds and publishes them beside a play-money simulator: the confirmed Solana slot from a public node, chain-wide locked value from DefiLlama, and the busiest Solana pairs from DexScreener. Each tile shows a dash when its feed fails. No figure is ever kept past its freshness and presented as current.

## Risks

Short rounds are easy to enter and easy to lose. Price sources can lag. Rules for pools of this kind differ by country, and some places restrict them. Participants are responsible for checking their own law.

## Status

The simulator is live. The contract address has not been announced, and nothing in this paper should be read as an offer of a token or of any return.
