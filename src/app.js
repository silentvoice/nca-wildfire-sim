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
} from "./sim.js";

const canvas = document.querySelector("#field");
const ctx = canvas.getContext("2d", { alpha: false });
const buffer = document.createElement("canvas");
const bufferCtx = buffer.getContext("2d", { alpha: false });
const channels = {
  fuel: document.querySelector("#fuel-channel").getContext("2d", { alpha: false }),
  prediction: document.querySelector("#prediction-channel").getContext("2d", { alpha: false }),
  retardant: document.querySelector("#retardant-channel").getContext("2d", { alpha: false }),
};

const controls = {
  play: document.querySelector("#play"),
  reset: document.querySelector("#reset"),
  auto: document.querySelector("#auto-control"),
  toolInputs: [...document.querySelectorAll("input[name='tool']")],
  view: document.querySelector("#view"),
  wind: document.querySelector("#wind"),
  windStrength: document.querySelector("#wind-strength"),
  dryness: document.querySelector("#dryness"),
  spread: document.querySelector("#spread"),
  crew: document.querySelector("#crew"),
  brush: document.querySelector("#brush"),
};

const labels = {
  tick: document.querySelector("#tick-value"),
  burning: document.querySelector("#burning-value"),
  burned: document.querySelector("#burned-value"),
  risk: document.querySelector("#risk-value"),
  fuel: document.querySelector("#fuel-value"),
  heat: document.querySelector("#heat-value"),
  wind: document.querySelector("#wind-value"),
  brush: document.querySelector("#brush-value"),
  cell: document.querySelector("#cell-readout"),
};

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const state = {
  sim: createSimulation(),
  paused: reducedMotionQuery.matches,
  pointer: null,
  hover: null,
  lastTime: performance.now(),
  accumulator: 0,
};

syncGridGeometry();

wireControls();
resizeCanvas();
requestAnimationFrame(frame);

function wireControls() {
  syncPlayButton();
  controls.play.addEventListener("click", () => {
    state.paused = !state.paused;
    syncPlayButton();
  });

  controls.reset.addEventListener("click", () => {
    resetSimulation(state.sim, { seed: state.sim.seed + 1 });
    state.hover = null;
    resetCellReadout();
    syncGridGeometry();
  });

  for (const input of [
    controls.auto,
    controls.wind,
    controls.windStrength,
    controls.dryness,
    controls.spread,
    controls.crew,
  ]) {
    input.addEventListener("input", updateConfigFromControls);
  }
  controls.brush.addEventListener("input", () => {
    labels.brush.textContent = controls.brush.value;
  });
  reducedMotionQuery.addEventListener("change", () => {
    if (reducedMotionQuery.matches) {
      state.paused = true;
      syncPlayButton();
    }
  });
  updateConfigFromControls();

  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("visibilitychange", () => {
    state.lastTime = performance.now();
    state.accumulator = 0;
  });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", () => {
    state.pointer = null;
    state.hover = null;
    resetCellReadout();
  });
  window.addEventListener("pointerup", () => {
    state.pointer = null;
  });
}

function updateConfigFromControls() {
  setConfig(state.sim, {
    autoControl: controls.auto.checked,
    windAngle: (Number(controls.wind.value) / 180) * Math.PI,
    windStrength: Number(controls.windStrength.value) / 100,
    dryness: Number(controls.dryness.value) / 100,
    spread: Number(controls.spread.value) / 100,
    firefighter: Number(controls.crew.value) / 100,
  });
  labels.wind.textContent = `${controls.wind.value} deg`;
}

function onPointerDown(event) {
  canvas.setPointerCapture(event.pointerId);
  state.pointer = pointerToCell(event);
  paintAtPointer(state.pointer);
}

function onPointerMove(event) {
  const point = pointerToCell(event);
  state.hover = point;
  if (state.pointer) {
    state.pointer = point;
    paintAtPointer(point);
  }
}

function paintAtPointer(point) {
  paintCells(state.sim, point.x, point.y, Number(controls.brush.value), selectedTool(), 1);
  state.sim.stats = measure(state.sim);
}

function pointerToCell(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * state.sim.width,
    y: ((event.clientY - rect.top) / rect.height) * state.sim.height,
  };
}

function frame(time) {
  const delta = Math.min(80, time - state.lastTime);
  state.lastTime = time;
  state.accumulator += delta;

  if (!state.paused && !document.hidden) {
    while (state.accumulator > 30) {
      step(state.sim, 1);
      state.accumulator -= 30;
    }
  }

  draw();
  updateReadouts();
  requestAnimationFrame(frame);
}

function syncPlayButton() {
  controls.play.textContent = state.paused ? "Play" : "Pause";
  controls.play.setAttribute("aria-pressed", String(!state.paused));
}

function syncGridGeometry() {
  document.documentElement.style.setProperty("--grid-ratio", `${state.sim.width} / ${state.sim.height}`);
  buffer.width = state.sim.width;
  buffer.height = state.sim.height;
  for (const channel of Object.values(channels)) {
    channel.canvas.width = state.sim.width;
    channel.canvas.height = state.sim.height;
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
}

function draw() {
  drawMainField();
  drawMiniChannel(channels.fuel, CHANNELS.fuel, "fuel");
  drawMiniChannel(channels.prediction, CHANNELS.prediction, "prediction");
  drawMiniChannel(channels.retardant, CHANNELS.retardant, "retardant");
}

function drawMainField() {
  const { sim } = state;
  const image = bufferCtx.createImageData(sim.width, sim.height);
  const mode = controls.view.value;

  for (let y = 0; y < sim.height; y += 1) {
    for (let x = 0; x < sim.width; x += 1) {
      const src = (y * sim.width + x) * CHANNEL_COUNT;
      const dst = (y * sim.width + x) * 4;
      const color = colorForCell(sim.current, src, mode);
      image.data[dst] = color[0];
      image.data[dst + 1] = color[1];
      image.data[dst + 2] = color[2];
      image.data[dst + 3] = 255;
    }
  }

  bufferCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);

  if (state.hover) {
    const scaleX = canvas.width / sim.width;
    const scaleY = canvas.height / sim.height;
    const x = Math.floor(state.hover.x);
    const y = Math.floor(state.hover.y);
    ctx.strokeStyle = "rgba(246, 244, 218, 0.86)";
    ctx.lineWidth = 2;
    ctx.strokeRect((x - 1) * scaleX, (y - 1) * scaleY, 3 * scaleX, 3 * scaleY);
  }

  drawWindArrow();
}

function colorForCell(grid, i, mode) {
  const fuel = grid[i + CHANNELS.fuel];
  const heat = grid[i + CHANNELS.heat];
  const moisture = grid[i + CHANNELS.moisture];
  const burned = grid[i + CHANNELS.burned];
  const retardant = grid[i + CHANNELS.retardant];
  const prediction = grid[i + CHANNELS.prediction];
  const ember = grid[i + CHANNELS.ember];

  if (mode === "heat") return heatColor(heat, ember);
  if (mode === "prediction") return riskColor(prediction, fuel);
  if (mode === "retardant") return lineColor(retardant, heat);
  if (mode === "fuel") return fuelColor(fuel, moisture, burned);

  const base = fuelColor(fuel, moisture, burned);
  const fire = heatColor(heat, ember);
  const line = lineColor(retardant, heat);
  const risk = riskColor(prediction, fuel);
  const heatMix = clamp01((heat * fuel + ember * 0.35) * 1.65);
  const lineMix = clamp01(retardant * 0.9);
  const riskMix = clamp01(Math.max(0, prediction - 0.55) * 0.45);
  return mix(mix(mix(base, risk, riskMix), fire, heatMix), line, lineMix);
}

function drawMiniChannel(context, channel, mode) {
  const { sim } = state;
  const image = context.createImageData(sim.width, sim.height);
  for (let y = 0; y < sim.height; y += 1) {
    for (let x = 0; x < sim.width; x += 1) {
      const src = (y * sim.width + x) * CHANNEL_COUNT;
      const dst = (y * sim.width + x) * 4;
      const value = sim.current[src + channel];
      const color =
        mode === "fuel"
          ? fuelColor(value, sim.current[src + CHANNELS.moisture], sim.current[src + CHANNELS.burned])
          : mode === "prediction"
            ? riskColor(value, sim.current[src + CHANNELS.fuel])
            : lineColor(value, sim.current[src + CHANNELS.heat]);
      image.data[dst] = color[0];
      image.data[dst + 1] = color[1];
      image.data[dst + 2] = color[2];
      image.data[dst + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function updateReadouts() {
  const stats = state.sim.stats;
  labels.tick.textContent = String(state.sim.tick);
  labels.burning.textContent = String(stats.burning);
  labels.burned.textContent = `${Math.round((stats.burned / (state.sim.width * state.sim.height)) * 100)}%`;
  labels.risk.textContent = String(stats.highRisk);
  labels.fuel.textContent = `${Math.round(stats.fuel * 100)}%`;
  labels.heat.textContent = `${Math.round(stats.heat * 100)}%`;

  if (state.hover) {
    const cell = readCell(state.sim, state.hover.x, state.hover.y);
    setCellReadout([
      `${cell.x},${cell.y}`,
      `fuel ${percent(cell.fuel)}`,
      `heat ${percent(cell.heat)}`,
      `risk ${percent(cell.prediction)}`,
      `line ${percent(cell.retardant)}`,
    ]);
  } else {
    resetCellReadout();
  }
}

function resetCellReadout() {
  setCellReadout(["hover a cell"]);
}

function setCellReadout(values) {
  labels.cell.replaceChildren(...values.map((value) => {
    const item = document.createElement("span");
    item.textContent = value;
    return item;
  }));
}

function drawWindArrow() {
  const angle = state.sim.config.windAngle;
  const strength = state.sim.config.windStrength;
  const centerX = canvas.width - 62;
  const centerY = 54;
  const length = 22 + strength * 28;
  const tipX = centerX + Math.cos(angle) * length;
  const tipY = centerY + Math.sin(angle) * length;
  ctx.save();
  ctx.strokeStyle = "rgba(246, 244, 218, 0.85)";
  ctx.fillStyle = "rgba(246, 244, 218, 0.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 33, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function fuelColor(fuel, moisture, burned) {
  const ash = [25, 24, 22];
  const dry = [108, 112, 50];
  const wet = [24, 103, 79];
  const canopy = mix(dry, wet, moisture * 0.9);
  return mix(ash, canopy, fuel * (1 - burned * 0.9));
}

function heatColor(heat, ember) {
  const cold = [17, 18, 17];
  const emberColor = [204, 58, 35];
  const flame = [255, 175, 54];
  const white = [255, 247, 202];
  return mix(mix(cold, emberColor, ember), mix(flame, white, clamp01(heat - 0.62) * 1.8), clamp01(heat * 1.35));
}

function riskColor(prediction, fuel) {
  const quiet = [18, 24, 22];
  const risk = [255, 211, 77];
  const severe = [255, 79, 61];
  return mix(quiet, mix(risk, severe, clamp01(prediction * 1.2 - 0.35)), clamp01(prediction * fuel * 1.25));
}

function lineColor(retardant, heat) {
  const base = [11, 21, 23];
  const line = [74, 229, 204];
  const steam = [219, 253, 238];
  return mix(base, mix(line, steam, clamp01(heat * 0.9)), clamp01(retardant * 1.1));
}

function mix(a, b, t) {
  const p = clamp01(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * p),
    Math.round(a[1] + (b[1] - a[1]) * p),
    Math.round(a[2] + (b[2] - a[2]) * p),
  ];
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function selectedTool() {
  return controls.toolInputs.find((input) => input.checked)?.value ?? "ignite";
}
