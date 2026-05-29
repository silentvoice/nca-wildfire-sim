import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANNELS,
  CHANNEL_COUNT,
  createSimulation,
  measure,
  paintCells,
  readCell,
  resetSimulation,
  setConfig,
  step,
} from "../src/sim.js";

test("terrain generation is deterministic for a seed", () => {
  const a = createSimulation({ seed: 42, width: 48, height: 32 });
  const b = createSimulation({ seed: 42, width: 48, height: 32 });
  assert.deepEqual([...a.current], [...b.current]);
});

test("fire evolves from local heat and consumes fuel", () => {
  const sim = createSimulation({ seed: 4, width: 54, height: 36, autoControl: false, spread: 0.95 });
  const before = measure(sim);
  step(sim, 45);
  const after = measure(sim);
  assert.ok(after.burning > before.burning, `expected more burning cells, got ${before.burning} -> ${after.burning}`);
  assert.ok(after.fuel < before.fuel, `expected less fuel, got ${before.fuel} -> ${after.fuel}`);
});

test("step replay is deterministic for the same seed and controls", () => {
  const options = { seed: 21, width: 48, height: 32, autoControl: true, windStrength: 0.8 };
  const a = createSimulation(options);
  const b = createSimulation(options);
  step(a, 30);
  step(b, 30);
  assert.deepEqual([...a.current], [...b.current]);
  assert.deepEqual(a.stats, b.stats);
});

test("manual line brush adds retardant and lowers fuel", () => {
  const sim = createSimulation({ seed: 8, width: 40, height: 30 });
  const before = readCell(sim, 20, 15);
  paintCells(sim, 20, 15, 5, "line", 1);
  const after = readCell(sim, 20, 15);
  assert.ok(after.retardant > before.retardant);
  assert.ok(after.fuel <= before.fuel);
});

test("water brush cools a hot cell and raises moisture", () => {
  const sim = createSimulation({ seed: 2, width: 40, height: 30 });
  paintCells(sim, 18, 15, 3, "ignite", 1);
  const hot = readCell(sim, 18, 15);
  paintCells(sim, 18, 15, 3, "water", 1);
  const cool = readCell(sim, 18, 15);
  assert.ok(cool.heat < hot.heat);
  assert.ok(cool.moisture > hot.moisture);
});

test("fuel brush regrows fuel and lowers burned state", () => {
  const sim = createSimulation({ seed: 5, width: 40, height: 30 });
  paintCells(sim, 22, 15, 4, "ignite", 1);
  step(sim, 80);
  const before = readCell(sim, 22, 15);
  paintCells(sim, 22, 15, 5, "grow", 1);
  const after = readCell(sim, 22, 15);
  assert.ok(after.fuel >= before.fuel, `expected fuel to regrow: ${before.fuel} -> ${after.fuel}`);
  assert.ok(after.burned <= before.burned, `expected burned state to fall: ${before.burned} -> ${after.burned}`);
});

test("setConfig and resetSimulation keep dimensions, buffers, and stats coherent", () => {
  const sim = createSimulation({ seed: 3, width: 40, height: 30, dryness: 0.4 });
  setConfig(sim, { dryness: 0.7, autoControl: true });
  assert.equal(sim.config.dryness, 0.7);
  assert.equal(sim.config.autoControl, true);
  resetSimulation(sim, { seed: 99, width: 44, height: 31 });
  assert.equal(sim.width, 44);
  assert.equal(sim.height, 31);
  assert.equal(sim.seed, 99);
  assert.equal(sim.current.length, 44 * 31 * CHANNEL_COUNT);
  assert.equal(sim.next.length, 44 * 31 * CHANNEL_COUNT);
  assert.deepEqual(sim.stats, measure(sim));
});

test("local prediction and control channels stay bounded", () => {
  const sim = createSimulation({ seed: 13, width: 52, height: 34, autoControl: true, firefighter: 0.85 });
  step(sim, 20);
  let maxPrediction = 0;
  let maxRetardant = 0;
  for (let i = 0; i < sim.current.length; i += CHANNEL_COUNT) {
    for (const channel of [
      CHANNELS.fuel,
      CHANNELS.heat,
      CHANNELS.moisture,
      CHANNELS.burned,
      CHANNELS.retardant,
      CHANNELS.ember,
      CHANNELS.prediction,
    ]) {
      const value = sim.current[i + channel];
      assert.ok(value >= 0 && value <= 1, `channel ${channel} out of bounds: ${value}`);
    }
    const hiddenA = sim.current[i + CHANNELS.hiddenA];
    const hiddenB = sim.current[i + CHANNELS.hiddenB];
    assert.ok(hiddenA >= -1 && hiddenA <= 1, `hiddenA out of bounds: ${hiddenA}`);
    assert.ok(hiddenB >= -1 && hiddenB <= 1, `hiddenB out of bounds: ${hiddenB}`);
    const prediction = sim.current[i + CHANNELS.prediction];
    const retardant = sim.current[i + CHANNELS.retardant];
    maxPrediction = Math.max(maxPrediction, prediction);
    maxRetardant = Math.max(maxRetardant, retardant);
  }
  assert.ok(maxPrediction > 0.15);
  assert.ok(maxRetardant > 0.02);
});
