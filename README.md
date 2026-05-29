# NCA Fireline

NCA Fireline is a small browser playground for learning how neural cellular
automata can turn local observations into coordinated behavior.

Each cell stores a handful of continuous channels: fuel, heat, moisture,
burned area, retardant, ember, prediction, and two hidden channels. On every
tick, every cell runs the same tiny local update rule. It only sees its 3x3
neighborhood, but repeated local updates make global fire fronts, risk waves,
and firelines appear.

The project is intentionally simple:

- no build step
- no runtime dependencies
- one readable simulation module
- one main canvas plus small channel previews
- Node tests for the simulation core

Serve the folder with any static web server. The browser app uses native ES
modules, so it needs an `http://` or `https://` URL rather than `file://`.

```bash
python3 -m http.server 4173
```

Then visit:

```text
http://localhost:4173
```

## Why this is an NCA

A traditional cellular automaton has a fixed rule such as "count neighbors and
switch on or off." A neural cellular automaton keeps the same grid idea, but the
state is continuous and the rule looks more like a small neural network.

In this toy sim, the shared rule is hand-tuned instead of trained. That keeps
the project readable for learning while preserving the important NCA shape:

1. Every cell has the same rule.
2. Every cell sees only local state.
3. Hidden state persists over time.
4. A visible channel can be read as a prediction or control field.
5. Global behavior comes from repeated local communication.

The main rule lives in [`src/sim.js`](src/sim.js). Search for `h0`, `h1`, and
`prediction` to see the tiny "cell brain."

## State Channels

| Channel | Meaning |
| --- | --- |
| `fuel` | Burnable material left in the cell. |
| `heat` | Current local fire intensity. |
| `moisture` | Resistance to ignition. |
| `burned` | How much of the cell has already burned. |
| `retardant` | Fireline or water/retardant protection. |
| `ember` | Short-lived heat memory. |
| `prediction` | Local risk forecast produced by the cell rule. |
| `hiddenA`, `hiddenB` | Persistent private state used for local communication. |

## Controls

- **Ignite** adds heat and ember.
- **Water** cools cells and raises moisture.
- **Line** lays retardant and removes some fuel.
- **Fuel** regrows fuel in burned or sparse regions.
- **Cells toggle** lets local cells place their own fireline from the risk field.
- **View** switches between the composite view and individual state channels.
- **Scorched** in the Field panel counts cells whose `burned` channel is mostly full.
- **Risk** in the HUD counts fuel-bearing cells whose predicted risk is high.
- Painting is pointer-based. Use a mouse, trackpad, stylus, or touch input on the canvas.
- **Push** can go above 100% for exaggerated wind experiments.

## Tests

```bash
npm test
npm run lint
```

The tests check deterministic terrain and replay, spread, control, bounds,
configuration, reset behavior, and brush behavior. They are deliberately focused
on the simulation core so readers can change the UI freely without wrestling a
test harness.

## References

This project was inspired by:

- John Whitaker, "Playing Games with Neural Cellular Automata"
- John Whitaker's NCA quick-start gist
- Distill, "Growing Neural Cellular Automata"
- Mordvintsev and Niklasson, "muNCA: Texture Generation with Ultra-Compact Neural Cellular Automata"
- fast.ai Lesson 20, especially the NCA section

## License

MIT
