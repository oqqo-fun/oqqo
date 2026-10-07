# Reference measurements (measured from the fetched page source and runtime script)

Layout
- Shell: max-width 1440, side padding 48 (40 inside sections, 20 under 600).
- Header: sticky, 64 tall, 86% paper with blur 20 / saturate 180, hairline bottom.
- Ticker strip: 12px mono, cell padding 10x22, loop 70000ms linear, edge mask 8%/92%.
- Hero: pill badge, h1 clamp(56,9.2vw,132) / lh .9 / ls -.06em / w600, two masked lines.
- Stage: radius 32, padding 72 64 0, dark window radius 16 16 0 0, chrome bar 40, 2-col auto-fit min 440.
- Stat row: auto-fit min 240, tile padding 56 32 52 0, number clamp(44,4.4vw,64) w600 ls -.05em.
- Section pad: 128 40 (how, tape), 140 (why), 144/128 (dark panel). Alternate paper / #f5f5f3 / dark.
- Cards: radius 28 pad 32 (light), radius 24 pad 36 (dark). Tape row pad 18 16, gap 24, 4 columns 2.3/.7/1.3/1fr.
- Closing band: radius 32, min-height 620, copy left, ring art right.

Motion
- Ease: cubic-bezier(.16,1,.3,1). Hover colour transitions .18s.
- Hero line: translateY(108%) -> 0, 1200ms, delays 140/240. Card: 36px rise, 1000ms. Rise: 16px, 1000ms.
- Scroll reveal: IntersectionObserver rootMargin 0 0 -8% 0, threshold .08, 28px rise, 1000ms, stagger 0/60/80/120/160/240.
- Pulse dot: opacity 1 -> .2 -> 1, 1400ms ease-in-out, infinite.
- Value flash 1600ms ease-out; bar fill .6s; modal 240 fade / 500 rise.
- Page transition: 260ms out, 680ms in, slide 28px.
- Reduced motion: transitions off, scroll-behavior auto.
