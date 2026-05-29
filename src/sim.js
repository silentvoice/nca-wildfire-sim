export const CHANNELS = Object.freeze({
  fuel: 0,
  heat: 1,
  moisture: 2,
  burned: 3,
  retardant: 4,
  ember: 5,
  prediction: 6,
  hiddenA: 7,
  hiddenB: 8,
});

export const CHANNEL_COUNT = Object.keys(CHANNELS).length;

export const DEFAULT_CONFIG = Object.freeze({
  width: 116,
  height: 76,
  seed: 11,
  windAngle: -0.25,
  windStrength: 0.72,
  dryness: 0.58,
  spread: 0.72,
  firefighter: 0.48,
  autoControl: false,
});

const NEIGHBORS = Object.freeze([
  [-1, -1, Math.SQRT1_2],
  [0, -1, 1],
  [1, -1, Math.SQRT1_2],
  [-1, 0, 1],
  [1, 0, 1],
  [-1, 1, Math.SQRT1_2],
  [0, 1, 1],
  [1, 1, Math.SQRT1_2],
]);

export function createSimulation(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const width = Math.max(24, Math.floor(config.width));
  const height = Math.max(24, Math.floor(config.height));
  const cells = width * height;
  const current = new Float32Array(cells * CHANNEL_COUNT);
  const next = new Float32Array(cells * CHANNEL_COUNT);

  const sim = {
    width,
    height,
    current,
    next,
    tick: 0,
    seed: config.seed,
    config,
    stats: emptyStats(),
  };

  seedTerrain(sim, config.seed);
  paintCells(sim, width * 0.13, height * 0.52, 4.5, "ignite", 1);
  sim.stats = measure(sim);
  return sim;
}

export function setConfig(sim, patch) {
  sim.config = { ...sim.config, ...patch };
  return sim;
}

export function resetSimulation(sim, options = {}) {
  const fresh = createSimulation({ ...sim.config, ...options });
  sim.width = fresh.width;
  sim.height = fresh.height;
  sim.current = fresh.current;
  sim.next = fresh.next;
  sim.tick = fresh.tick;
  sim.seed = fresh.seed;
  sim.config = fresh.config;
  sim.stats = fresh.stats;
  return sim;
}

export function step(sim, steps = 1) {
  const count = Math.max(1, Math.floor(steps));
  for (let i = 0; i < count; i += 1) {
    stepOnce(sim);
  }
  sim.stats = measure(sim);
  return sim;
}

export function paintCells(sim, cx, cy, radius, tool, amount = 1) {
  const r = Math.max(0.5, radius);
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(sim.width - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(sim.height - 1, Math.ceil(cy + r));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.hypot(dx, dy);
      if (distance > r) continue;
      const falloff = (1 - distance / r) ** 1.6;
      const idx = offset(sim, x, y);

      if (tool === "ignite") {
        sim.current[idx + CHANNELS.heat] = clamp01(sim.current[idx + CHANNELS.heat] + amount * falloff);
        sim.current[idx + CHANNELS.ember] = clamp01(sim.current[idx + CHANNELS.ember] + amount * 0.7 * falloff);
      } else if (tool === "water") {
        sim.current[idx + CHANNELS.heat] = clamp01(sim.current[idx + CHANNELS.heat] - amount * 0.85 * falloff);
        sim.current[idx + CHANNELS.moisture] = clamp01(sim.current[idx + CHANNELS.moisture] + amount * 0.65 * falloff);
        sim.current[idx + CHANNELS.retardant] = clamp01(sim.current[idx + CHANNELS.retardant] + amount * 0.18 * falloff);
      } else if (tool === "line") {
        sim.current[idx + CHANNELS.retardant] = clamp01(sim.current[idx + CHANNELS.retardant] + amount * 0.9 * falloff);
        sim.current[idx + CHANNELS.fuel] = clamp01(sim.current[idx + CHANNELS.fuel] - amount * 0.5 * falloff);
        sim.current[idx + CHANNELS.heat] = clamp01(sim.current[idx + CHANNELS.heat] - amount * 0.25 * falloff);
      } else if (tool === "grow") {
        sim.current[idx + CHANNELS.fuel] = clamp01(sim.current[idx + CHANNELS.fuel] + amount * 0.45 * falloff);
        sim.current[idx + CHANNELS.moisture] = clamp01(sim.current[idx + CHANNELS.moisture] + amount * 0.08 * falloff);
        sim.current[idx + CHANNELS.burned] = clamp01(sim.current[idx + CHANNELS.burned] - amount * 0.32 * falloff);
      }
    }
  }
}

export function readCell(sim, x, y) {
  const gx = clamp(Math.floor(x), 0, sim.width - 1);
  const gy = clamp(Math.floor(y), 0, sim.height - 1);
  const idx = offset(sim, gx, gy);
  return {
    x: gx,
    y: gy,
    fuel: sim.current[idx + CHANNELS.fuel],
    heat: sim.current[idx + CHANNELS.heat],
    moisture: sim.current[idx + CHANNELS.moisture],
    burned: sim.current[idx + CHANNELS.burned],
    retardant: sim.current[idx + CHANNELS.retardant],
    ember: sim.current[idx + CHANNELS.ember],
    prediction: sim.current[idx + CHANNELS.prediction],
    hiddenA: sim.current[idx + CHANNELS.hiddenA],
    hiddenB: sim.current[idx + CHANNELS.hiddenB],
  };
}

export function measure(sim) {
  const total = sim.width * sim.height;
  let burning = 0;
  let burned = 0;
  let fuel = 0;
  let retardant = 0;
  let highRisk = 0;
  let heat = 0;

  for (let cell = 0; cell < total; cell += 1) {
    const idx = cell * CHANNEL_COUNT;
    const h = sim.current[idx + CHANNELS.heat];
    const b = sim.current[idx + CHANNELS.burned];
    const f = sim.current[idx + CHANNELS.fuel];
    const r = sim.current[idx + CHANNELS.retardant];
    const p = sim.current[idx + CHANNELS.prediction];
    burning += h > 0.28 && f > 0.03 ? 1 : 0;
    burned += b > 0.62 ? 1 : 0;
    highRisk += p > 0.68 && f > 0.08 ? 1 : 0;
    fuel += f;
    retardant += r;
    heat += h;
  }

  return {
    burning,
    burned,
    highRisk,
    fuel: fuel / total,
    retardant: retardant / total,
    heat: heat / total,
  };
}

function seedTerrain(sim, seed) {
  const { width, height, current } = sim;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = offset(sim, x, y);
      const nx = x / width;
      const ny = y / height;
      const canopy = fbm(nx * 7.2, ny * 5.6, seed);
      const ridge = Math.abs(ny - 0.52 - 0.12 * Math.sin(nx * 8.4 + fbm(nx * 3, ny * 3, seed + 9)));
      const river = smoothstep(0.0, 0.035, ridge);
      const dryness = sim.config.dryness;
      const edgeShade = smoothstep(0, 0.08, nx) * smoothstep(0, 0.08, 1 - nx);
      const moisture = clamp01(0.22 + (1 - dryness) * 0.35 + (1 - canopy) * 0.22 + (1 - river) * 0.4);
      const fuel = clamp01((0.24 + canopy * 0.72 + dryness * 0.2) * river * edgeShade);

      current[idx + CHANNELS.fuel] = fuel;
      current[idx + CHANNELS.moisture] = moisture;
      current[idx + CHANNELS.heat] = 0;
      current[idx + CHANNELS.burned] = 0;
      current[idx + CHANNELS.retardant] = 0;
      current[idx + CHANNELS.ember] = 0;
      current[idx + CHANNELS.prediction] = 0;
      current[idx + CHANNELS.hiddenA] = (hash2(x, y, seed + 33) - 0.5) * 0.08;
      current[idx + CHANNELS.hiddenB] = (hash2(x, y, seed + 57) - 0.5) * 0.08;
    }
  }
}

function stepOnce(sim) {
  const { width, height, current, next, config } = sim;
  const windX = Math.cos(config.windAngle) * config.windStrength;
  const windY = Math.sin(config.windAngle) * config.windStrength;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = offset(sim, x, y);
      const fuel = current[idx + CHANNELS.fuel];
      const heat = current[idx + CHANNELS.heat];
      const moisture = current[idx + CHANNELS.moisture];
      const burned = current[idx + CHANNELS.burned];
      const retardant = current[idx + CHANNELS.retardant];
      const ember = current[idx + CHANNELS.ember];
      const hiddenA = current[idx + CHANNELS.hiddenA];
      const hiddenB = current[idx + CHANNELS.hiddenB];

      let heatSum = 0;
      let heatMax = 0;
      let windHeat = 0;
      let neighborRetardant = 0;

      for (const [dx, dy, weight] of NEIGHBORS) {
        const nidx = offsetOrNull(sim, x + dx, y + dy);
        if (nidx === -1) continue;
        const neighborHeat = current[nidx + CHANNELS.heat];
        const neighborRet = current[nidx + CHANNELS.retardant];
        const downwind = Math.max(0, -(dx * windX + dy * windY));
        heatSum += neighborHeat * weight;
        heatMax = Math.max(heatMax, neighborHeat);
        windHeat += neighborHeat * (0.35 + downwind * 1.45) * weight;
        neighborRetardant += neighborRet * weight;
      }

      const avgHeat = heatSum / 6.828;
      const avgRetardant = neighborRetardant / 6.828;
      const localFuel = fuel * (1 - burned);
      const dryFuel = localFuel * (1 - moisture * 0.72);
      const edge = Math.max(0, heatMax - heat * 0.35);

      const h0 = Math.tanh(
        avgHeat * 2.4 +
          windHeat * 1.25 +
          edge * 1.1 +
          hiddenA * 0.62 -
          moisture * 1.35 -
          retardant * 1.65 -
          0.18,
      );
      const h1 = Math.tanh(
        dryFuel * 0.9 +
          ember * 0.7 +
          heat * 1.4 +
          avgHeat * 0.8 +
          hiddenB * 0.58 -
          avgRetardant * 1.25 -
          burned * 1.8 -
          0.7,
      );
      const prediction = sigmoid(
        h0 * 2.1 +
          h1 * 1.4 +
          heat * 1.2 +
          avgHeat * 2.4 +
          windHeat * 1.0 -
          retardant * 1.45 -
          moisture * 0.8 -
          0.82,
      );

      const localClock = hash2(x, y, sim.seed + sim.tick * 17);
      const asynchronous = localClock > 0.1 ? 1 : 0.22;
      const ignitionGate = clamp01((avgHeat + windHeat * 0.42 + heat * 0.28 + ember * 0.2 - 0.025) * 3.4);
      const ignition = prediction * dryFuel * config.spread * asynchronous * ignitionGate;
      const diffusion = windHeat * 0.014 * localFuel;
      const cooling = 0.06 + moisture * 0.04 + retardant * 0.09 + burned * 0.12 + (1 - localFuel) * 0.1;
      const newHeat = clamp01(heat + ignition * 0.14 + diffusion - heat * cooling);
      const newBurned = clamp01(burned + Math.max(0, newHeat - 0.22) * (0.009 + config.spread * 0.005));
      const newFuel = clamp01(fuel - newHeat * (0.004 + config.dryness * 0.005) - newBurned * 0.0015);

      const controlSignal =
        config.autoControl && localFuel > 0.03
          ? sigmoid((prediction + edge + dryFuel - retardant - 0.86) * 7) * config.firefighter
          : 0;
      const newRetardant = clamp01(retardant * 0.997 + controlSignal * 0.05 - newHeat * 0.002);
      const newMoisture = clamp01(moisture + controlSignal * 0.018 - newHeat * (0.002 + config.dryness * 0.003));
      const newEmber = clamp01(ember * 0.82 + newHeat * 0.16 + avgHeat * 0.03 - newMoisture * 0.035);

      next[idx + CHANNELS.fuel] = newFuel;
      next[idx + CHANNELS.heat] = newHeat;
      next[idx + CHANNELS.moisture] = newMoisture;
      next[idx + CHANNELS.burned] = newBurned;
      next[idx + CHANNELS.retardant] = newRetardant;
      next[idx + CHANNELS.ember] = newEmber;
      next[idx + CHANNELS.prediction] = prediction;
      next[idx + CHANNELS.hiddenA] = clamp(hiddenA * 0.88 + (h0 - hiddenA) * 0.18 + (avgHeat - heat) * 0.08, -1, 1);
      next[idx + CHANNELS.hiddenB] = clamp(hiddenB * 0.9 + (h1 - hiddenB) * 0.16 + (prediction - 0.5) * 0.04, -1, 1);
    }
  }

  sim.current = next;
  sim.next = current;
  sim.tick += 1;
}

function emptyStats() {
  return {
    burning: 0,
    burned: 0,
    highRisk: 0,
    fuel: 0,
    retardant: 0,
    heat: 0,
  };
}

function offset(sim, x, y) {
  return (y * sim.width + x) * CHANNEL_COUNT;
}

function offsetOrNull(sim, x, y) {
  if (x < 0 || y < 0 || x >= sim.width || y >= sim.height) return -1;
  return offset(sim, x, y);
}

function fbm(x, y, seed) {
  let value = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    value += smoothNoise(x * freq, y * freq, seed + octave * 19) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return value / norm;
}

function smoothNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function hash2(x, y, seed) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1442695041;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
