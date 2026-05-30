# NCA Fireline

NCA Fireline is a small browser simulator for learning neural cellular
automata by playing with fire spread.

Open it here:

https://silentvoice.github.io/nca-wildfire-sim/

The whole thing is plain HTML, CSS, and JavaScript. There is no build step and
no dependency tree. I wanted the code to stay close enough to the idea that you
can read it in one sitting, change a few numbers, refresh the page, and see the
rule behave differently.

## What To Try

1. Let the default fire run for a few seconds.
2. Switch the view to `Risk` and watch the yellow field appear ahead of the
   flame.
3. Turn on `Cell rule`. High-risk cells will start laying cyan fireline.
4. Paint with `Ignite`, `Water`, `Line`, and `Fuel`.
5. Change wind and dryness, then hit `Reset` for a new terrain seed.
6. Hover the field to inspect one cell's local state vector.

The fun part is that no cell sees the whole map. Each cell reads a 3x3
neighborhood, runs the same small update rule, and writes its next state. Fire,
risk, and fireline only look global because that local rule runs everywhere,
over and over.

## Run Locally

Serve the folder with any static server. Native ES modules need `http://` or
`https://`, so opening `index.html` directly is not enough.

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Read The Code

Start with [`src/sim.js`](src/sim.js). That file has the entire simulation:

- `CHANNELS` names the numbers stored in each cell.
- `createSimulation()` allocates the grid and seeds terrain.
- `paintCells()` is how the brush tools change local channels.
- `stepOnce()` is the shared cell rule.
- `measure()` produces the HUD numbers.

The browser work lives in [`src/app.js`](src/app.js): drawing pixels, wiring
controls, reading hover state, and keeping the canvases sized.

## Cell Channels

Each cell stores a short vector:

| Channel | Meaning |
| --- | --- |
| `fuel` | Burnable material left in the cell. |
| `heat` | Current local fire intensity. |
| `moisture` | Resistance to ignition. |
| `burned` | How much of this cell has already burned. |
| `retardant` | Fireline or water/retardant protection. |
| `ember` | Short-lived heat memory. |
| `prediction` | Local risk estimate. |
| `hiddenA`, `hiddenB` | Private scratchpad memory carried between ticks. |

This version is hand-tuned instead of trained. That is intentional: the update
rule is readable, so the project works as a stepping stone before training an
NCA with gradient descent.

## Tests

```bash
npm test
npm run lint
```

The tests focus on the simulation core: deterministic terrain, deterministic
replay, spread, brush effects, reset/config behavior, and channel bounds.

## License

MIT
