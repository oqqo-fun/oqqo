# Contributing to Oqqo

Thanks for taking a look. A few ground rules keep the site small and trustworthy.

## Before you start

- Node 20 or newer. There is nothing to install.
- Run `npm run build` and `npm run gates`. Both must exit with code 0 before a change is considered ready.

## House rules

1. **One record per fact.** Anything that comes from outside the repository (an address, a profile, a feed) is a record in `src/register.json` with a state. Do not hard-code it elsewhere.
2. **No link for an unstated record.** An absent record renders an inert element. Store the URL, derive the handle.
3. **Never reject a valid address.** The contract gate accepts any base58 string of 32 to 44 characters. Do not add prefix or checksum guesses.
4. **Colour in one place.** Colour literals live in `src/tokens.json` only. Everything else uses the variables.
5. **No scroll arithmetic in script.** Use the observer plus CSS, or CSS scroll timelines.
6. **No dates on the page.** Dates may sit in the register; they are never rendered.
7. **Dash on failure.** A failed read shows a dash. Never show stale data as fresh.

## Changing a gate

Gates use synthetic fixtures and a fast clock, and the whole run stays under five minutes with no more than thirty gates. If you add one, merge or retire another.

## Pull requests

Keep them focused. Describe what changed and why, and say which breakpoints you looked at: 360, 390, 430, 1366 and 1440.
