# Harbor Heat

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/adenadji06/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/adenadji06/gta6-01/reward.svg)

An original open-world crime game for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) on [make.fun](https://make.fun).

**Harbor Heat** drops you into Port Vermilion, a fictional coastal city, as Jax Marlowe — a driver with six jobs to pull and the whole VPD on his tail. Drive, steal, shoot, and outrun the law across six districts: Old Town, Downtown, North Hills, The Docks, Marina, and South Beach.

## Play

- **On foot and by car** — walk the streets, steal parked cars, or take Jax's own GT from the safehouse.
- **Six story missions** — First Wheels, The Collector, Hot Delivery (three-minute timer, two stars on your tail), Heat Wave, The Harbor Job, and The Long Goodbye. Markers, guide lines, cash rewards, and a save in localStorage.
- **Wanted 0–5 stars** — crimes raise your heat; VPD interceptors chase, ram, and bust you (10% cash loss). Lose the tail and the heat decays.
- **Combat** — pistol with mouse aim, 24 rounds, restock at the safehouse with R.
- **Living city** — 22 traffic cars looping the road grid, 36 pedestrians, a live minimap, procedural WebAudio (engine, sirens, gunshots).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk and drive |
| E | Enter / exit a car |
| Mouse + click | Aim and shoot |
| R | Restock ammo at the safehouse |
| P | Pause |
| M | Mute |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Build the submission dossier:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Static files only — no network requests, no build step, no dependencies. All art, characters, and places are original; nothing is taken from any existing game, film, or brand.

## License

MIT — see [LICENSE](LICENSE).
