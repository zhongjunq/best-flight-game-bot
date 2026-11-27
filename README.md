# Canyon Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zhongjunq/best-flight-game-bot/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zhongjunq/best-flight-game-bot/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete, original flight game that runs offline in a desktop browser from its
own files. You fly a bush plane down a winding canyon in chase view: thread the
glowing rings, drop a parcel on the target, and put her down on the runway — all
while the fuel gauge falls and the canyon walls close in.

## How to play

Serve the game and open it in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| ← → / A D | Bank and turn |
| ↑ / W | Climb |
| ↓ / S | Descend |
| Shift / E | Throttle up |
| Q | Throttle down |
| Space | Drop the parcel (Courier Drop missions) |
| P / Esc | Pause |

Mouse or touch also works: press and drag sideways to steer, click to confirm.

## Missions

The game cycles three mission types, one harder each round:

1. **Ring Run** — fly through every glowing ring before the clock runs out.
   Consecutive rings build a combo multiplier up to x5.
2. **Courier Drop** — release the parcel over the pulsing ground target with
   Space. Accuracy is scored; a wild drop scores nothing.
3. **Precision Landing** — slow down, line up and touch down on the runway.
   A gentle, centred landing refuels the plane.

Fuel burns with the throttle, and scraping a canyon wall or the ground damages
the airframe — three hard scrapes and the flight is over. The canyon winds, so
holding the centre line takes constant small corrections; climbing bleeds speed
and diving buys it back. Times of day cycle dawn, day and dusk as levels pass.

## What's inside

- `game/` — the playable game as static files: `index.html` plus ES modules in
  `game/src/` (flight model, canyon terrain, chase-view renderer, HUD,
  synthesised WebAudio sounds, screenshot staging). No library, no network.
- `screenshots/` — 3 screenshots taken from the game itself in a browser.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with the vendored make.fun
  library (`vendor/makefun-game.ts`).
- `serve.ts` — a tiny static server for local play-testing.

Hand it in locally with `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

<sub>Entered on [make.fun](https://make.fun/?ref=yean4thj&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
