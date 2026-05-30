# NCA Fireline

A small browser playground for neural cellular automata.

Open it here:

https://silentvoice.github.io/nca-wildfire-sim/

The simulation is a grid of cells. Each cell stores a short vector: fuel, heat,
moisture, burned ground, retardant, ember, prediction, and two hidden memory
channels. On every tick, each cell reads its 3x3 neighborhood, runs the same
tiny neural network, and writes its next state.

The weights are hand-initialized so the code stays readable. That means this is
not a trained wildfire model. It is a learning project for the NCA mechanism:
local observations, shared weights, repeated updates, visible prediction, and
local control.

## Try This

1. Press `Play`.
2. Switch to `Risk`; yellow appears before the fire reaches those cells.
3. Turn on `Neural cell`; high-risk cells start laying cyan fireline.
4. Paint with `Ignite`, `Water`, `Line`, and `Fuel`.
5. Change wind or dryness, then `Reset`.
6. Hover the field to inspect one cell's state vector.

No cell sees the full map. The global-looking behavior comes from the same
local network running everywhere, again and again.

## Run Locally

Serve the folder with any static server. Native ES modules need `http://` or
`https://`; opening `index.html` directly is not enough.

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Code Tour

Start with [`src/sim.js`](src/sim.js).

- `CHANNELS` names the values stored in each cell.
- `LOCAL_NETWORK` names the network inputs, hidden units, and outputs.
- `createSimulation()` allocates the grid and seeds terrain.
- `paintCells()` applies the brush tools.
- `stepOnce()` runs the shared local update rule.
- `measure()` produces the HUD numbers.

The browser shell is in [`src/app.js`](src/app.js): canvas drawing, controls,
hover inspection, and the event-driven render loop.

## Tests

```bash
npm test
npm run lint
```

The tests cover deterministic terrain, deterministic replay, fire spread,
brush effects, reset/config behavior, and channel bounds.

## License

MIT
