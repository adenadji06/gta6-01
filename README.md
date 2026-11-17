[![make.fun — gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/adenadji06/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/adenadji06/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Harbor Heat — Port Vermilion

An original open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): the most complete rendition of the genre an agent can build — a city to explore on foot and by car, traffic and pedestrians, stealable cars, a wanted system with police chases, six story missions, combat, a HUD with a live minimap, a start screen and saving. It runs offline in a desktop browser from static files, with keyboard and mouse, and no network requests.

Everything in it is original: the city of Port Vermilion, its districts (Old Town, Downtown, North Hills, The Docks, Marina, South Beach), its people (Jax Marlowe, Ray, the Vermilion PD), its cars and its story. No Rockstar Games name, logo, character, map or asset appears anywhere.

## The story

Jax Marlowe came home to settle a debt. Six jobs stand between him and the boat out — and the whole Vermilion police force is in the way.

1. **First Wheels** — get a car, any car, to Ray's Garage.
2. **The Collector** — collect $900 at the Docks. His friends will object.
3. **Hot Delivery** — run a package from the Marina to North Hills in 100 seconds, with a patrol car already on you.
4. **Heat Wave** — lose a three-star wanted level by staying out of sight.
5. **The Harbor Job** — crack the Harbor Bank vault, grab $5,000, escape a four-star tail.
6. **The Long Goodbye** — five stars, sixty seconds, one boat at the Pier.

Finish all six and the city is yours in free roam.

## Systems

- **On foot and by car** — walk the sidewalks, steal any parked or driven car (the driver objects, the law notices), drive with acceleration, steering, handbrake drifts and crash damage.
- **Traffic and pedestrians** — cars follow the road grid, wait at jams and turn at intersections; pedestrians stroll, flee gunfire and scatter from speeding cars.
- **Wanted level and police** — 0–5 stars for theft, shootings and hit pedestrians; cruisers spawn to the heat, chase, ram and try to bust you on foot. Break line of sight to cool off.
- **Combat** — mouse-aimed pistol (12-round magazine, reload), punches, drive-bys, and armed goons who shoot back.
- **HUD and minimap** — cash, health, ammo, speed, car condition, flashing wanted stars, mission card with a live waypoint, distance readout, and a minimap with police, goon, pickup and objective blips.
- **Start and save** — title screen with continue/new game, pause, and progress (cash, jobs done) saved to localStorage after every job. Busted or wasted costs a fine and a trip to the Safehouse or St. Vera Hospital.
- **Sound** — fully synthesised WebAudio: engine hum, two-tone sirens, gunshots, crashes and jingles. No audio files. `M` mutes.

## Play

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Or open `game/index.html` directly from any static server. Node 22 or a modern desktop browser is all it needs.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot · drive (W accelerate, S brake/reverse, A/D steer) |
| Shift | Run |
| E | Enter / steal a car · exit a car |
| Mouse + Click | Aim and shoot (works on foot and as a drive-by) |
| F | Punch |
| R | Reload |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

## Layout

- `game/index.html` + `game/style.css` — page shell.
- `game/src/config.js` — tuning, palette, the city bible (districts, landmarks).
- `game/src/world.js` — the seeded city: roads, blocks, buildings, parks, beach and bay, plus collision.
- `game/src/sim.js` — the simulation: player, cars, traffic AI, pedestrians, police pursuit, combat, wanted heat, pickups, particles.
- `game/src/missions.js` — the six-job story.
- `game/src/render.js` — canvas drawing: city, cars, people, HUD, minimap, screens.
- `game/src/audio.js` — synthesised sound. `game/src/input.js` — keyboard + mouse.
- `game/src/shots.js` — the four staged screenshots (`?shot=start|play|chase|end`).
- `main.ts` — hands the entry in: copies `game/` + `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `serve.ts` — the local static server. `shots.json` — the screenshot list.

## License

MIT — see [LICENSE](LICENSE).
