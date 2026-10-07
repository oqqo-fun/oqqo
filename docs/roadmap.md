# Oqqo roadmap

The roadmap is ordered by dependency, not by calendar. A stage opens when the one before it has shipped and passed its gates.

## Stage 1 · Public site and simulator (shipped)

- Live slot, chain health, locked value and busiest pairs.
- Play-money simulator with a ninety-second countdown.
- Register of external facts with inert slots for anything not yet announced.
- Release gates that build fixtures for both branches of every slot.

## Stage 2 · Round program on devnet

- Per-round program account that holds stakes.
- Strike, lock and close logic with the refund path for doubtful prices.
- Public test rounds with no value attached.
- An independent read of the program before anything moves to mainnet.

## Stage 3 · Price source integration

- Closing price read from a public oracle, with freshness and confidence checks.
- Void-and-refund when either check fails.
- Documentation of the exact comparison rule, including ties.

## Stage 4 · Mainnet rounds with caps

- A small set of deep coins.
- Hard caps on pool size relative to on-chain liquidity.
- The contract address announced through the register, shown in full at the top of the site.

## Stage 5 · Openers and builders

- Anyone can open a round on an eligible coin.
- Read endpoints for rounds and settled results.
- Opener rewards, once the share is stated in the register.

## Not on the list

Order books, leverage, custody of funds between rounds and any operator power to choose a result.
