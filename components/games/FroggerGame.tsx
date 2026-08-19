'use client';

import { useEffect, useRef } from 'react';
import { useGameLoop } from '@/lib/games/useGameLoop';

interface FroggerGameProps {
  paused: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640 — se escala con CSS al contenedor
const CANVAS_H = ROWS * CELL; // 560
// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const JUMP_MS = 120;
const FROG_START_COL = Math.floor(COLS / 2); // 8

const ROUND_TIME_BASE_MS = 15000;
const ROUND_TIME_STEP_MS = 1000; // -1s per level
const ROUND_TIME_MIN_MS = 6000;

const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;

// 5 goal mouths, each spanning 2 of the 16 columns; the remaining columns
// are the dividers a landing frog dies against.
const GOAL_STARTS = [1, 4, 7, 10, 13];
const GOAL_COUNT = GOAL_STARTS.length;

function roundTimeMs(level: number): number {
  return Math.max(
    ROUND_TIME_MIN_MS,
    ROUND_TIME_BASE_MS - (level - 1) * ROUND_TIME_STEP_MS,
  );
}

// ── Skin system ───────────────────────────────────────────────────────────────

type Skin = {
  name: string;
  // Painted under the whole canvas before the zone rows — kept pure black
  // for neon so nothing but glow reads on top of it; null elsewhere since
  // the per-row zone fills already cover the full canvas.
  boardBg: string | null;
  zoneBg: { goal: string; river: string; safe: string; road: string };
  goalMouthBg: string;
  goalMouthBorder: string;
  goalFlag: string;
  carColors: string[];
  truckBody: string;
  truckCab: string;
  logBody: string;
  logGrain: string;
  turtleBody: string;
  turtleShell: string;
  turtleSubmerged: string;
  frogBody: string;
  frogEyeWhite: string;
  frogEyePupil: string;
  hudText: string;
  hudTimerHigh: string;
  hudTimerMid: string;
  hudTimerLow: string;
  wheelColor: string;
  // CRT-style 4px white top highlight on solid blocks (retro).
  blockHighlight: boolean;
  // shadowBlur/shadowColor glow + neon stroke outlines.
  glow: boolean;
};

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'Classic',
    boardBg: null,
    zoneBg: {
      goal: '#0d3b1a',
      river: '#0a2a4a',
      safe: '#123d1f',
      road: '#1a1a1a',
    },
    goalMouthBg: '#145c2c',
    goalMouthBorder: '#d4af37',
    goalFlag: '#3ef07a',
    carColors: ['#e63946', '#f4d35e', '#3a86ff'],
    truckBody: '#9aa0a6',
    truckCab: '#5c6066',
    logBody: '#7a4a26',
    logGrain: 'rgba(0,0,0,0.3)',
    turtleBody: '#3ec96a',
    turtleShell: '#1f7a3d',
    turtleSubmerged: 'rgba(60,180,110,0.35)',
    frogBody: '#39ff6a',
    frogEyeWhite: '#ffffff',
    frogEyePupil: '#0a1a0a',
    hudText: '#ffffff',
    hudTimerHigh: '#39ff6a',
    hudTimerMid: '#f4d35e',
    hudTimerLow: '#e63946',
    wheelColor: '#111111',
    blockHighlight: false,
    glow: false,
  },

  retro: {
    name: 'Retro',
    boardBg: null,
    zoneBg: {
      goal: '#1c6b4a',
      river: '#25588f',
      safe: '#2c7a52',
      road: '#3a3a3a',
    },
    goalMouthBg: '#20835c',
    goalMouthBorder: '#ffd54f',
    goalFlag: '#81c784',
    carColors: ['#e57373', '#ffd54f', '#4dd0e1'],
    truckBody: '#b0b8c1',
    truckCab: '#6c7580',
    logBody: '#c78a4a',
    logGrain: 'rgba(0,0,0,0.22)',
    turtleBody: '#81c784',
    turtleShell: '#4c9a5b',
    turtleSubmerged: 'rgba(129,199,132,0.35)',
    frogBody: '#a8e063',
    frogEyeWhite: '#ffffff',
    frogEyePupil: '#1c3018',
    hudText: '#f0f0f0',
    hudTimerHigh: '#81c784',
    hudTimerMid: '#ffd54f',
    hudTimerLow: '#e57373',
    wheelColor: '#1a1a1a',
    blockHighlight: true,
    glow: false,
  },

  neon: {
    name: 'Neon',
    boardBg: '#000000',
    zoneBg: {
      goal: '#001510',
      river: '#00060f',
      safe: '#001208',
      road: '#020202',
    },
    goalMouthBg: '#001f14',
    goalMouthBorder: '#00ffff',
    goalFlag: '#00ff88',
    carColors: ['#ff2d78', '#ffe600', '#00e5ff'],
    truckBody: '#8b2fff',
    truckCab: '#ff0080',
    logBody: '#ff8c00',
    logGrain: 'rgba(255,255,255,0.18)',
    turtleBody: '#00ff66',
    turtleShell: '#00ffaa',
    turtleSubmerged: 'rgba(0,255,102,0.35)',
    frogBody: '#39ff14',
    frogEyeWhite: '#eaffea',
    frogEyePupil: '#001a00',
    hudText: '#00ffff',
    hudTimerHigh: '#00ff66',
    hudTimerMid: '#ffff00',
    hudTimerLow: '#ff0040',
    wheelColor: '#111111',
    blockHighlight: false,
    glow: true,
  },
};

// Tracks the last shadowColor/shadowBlur written per canvas context so
// applyGlow/clearGlow only touch ctx when the value actually changes —
// shadowBlur is one of Canvas2D's most expensive properties to set, and
// the Neon skin toggles it 60-75 times per frame. Keyed by ctx (not a
// module-level variable) so a remounted FroggerGame gets a fresh
// baseline instead of inheriting stale state from a previous instance.
const glowState = new WeakMap<
  CanvasRenderingContext2D,
  { color: string; blur: number }
>();

function applyGlow(ctx: CanvasRenderingContext2D, skin: Skin, color: string) {
  if (!skin.glow) return;
  const last = glowState.get(ctx);
  if (last?.color !== color) ctx.shadowColor = color;
  if (last?.blur !== 12) ctx.shadowBlur = 12;
  glowState.set(ctx, { color, blur: 12 });
}

function clearGlow(ctx: CanvasRenderingContext2D) {
  const last = glowState.get(ctx);
  if (last?.blur === 0) return;
  ctx.shadowBlur = 0;
  glowState.set(ctx, { color: last?.color ?? '', blur: 0 });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Direction = 'up' | 'down' | 'left' | 'right';

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Entity {
  col: number;
  width: number;
  type: 'car' | 'truck' | 'log' | 'turtle';
  submerged?: boolean;
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

interface FroggerState {
  frog: Frog;
  lanes: Lane[];
  level: number;
  score: number;
  lives: number;
  goals: boolean[];
  timeLeft: number; // ms
  maxRowReached: number; // lowest row index reached this round (0 = top)
  riverTime: number; // ms, drives turtle submersion cycle
  pendingDir: Direction | null;
  gameOver: boolean;
}

const DIR_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// ── Lane construction ────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Lays out entities evenly around the loop with a random shared phase and a
// width cap derived from the spacing, so there is always at least a 1-cell
// gap between consecutive entities — keeping every lane traversable.
function layoutLaneEntities(
  type: Entity['type'],
  widthRange: [number, number],
  trackable: boolean,
): Entity[] {
  const count = randomInt(2, 3);
  const spacing = COLS / count;
  const maxWidth = Math.max(1, Math.floor(spacing) - 1);
  const [minW, maxW] = widthRange;
  const cappedMax = Math.max(minW, Math.min(maxW, maxWidth));
  const phase = Math.random() * spacing;

  const entities: Entity[] = [];
  for (let i = 0; i < count; i++) {
    entities.push({
      col: (i * spacing + phase) % COLS,
      width: randomInt(minW, cappedMax),
      type,
      submerged: trackable ? false : undefined,
    });
  }
  return entities;
}

function buildRoadLaneEntities(laneIndex: number): Entity[] {
  const isTruckLane = laneIndex % 2 === 1;
  return isTruckLane
    ? layoutLaneEntities('truck', [2, 3], false)
    : layoutLaneEntities('car', [1, 2], false);
}

function buildRiverLaneEntities(laneIndex: number): Entity[] {
  const isTurtleLane = laneIndex % 3 === 2;
  return isTurtleLane
    ? layoutLaneEntities('turtle', [2, 3], true)
    : layoutLaneEntities('log', [2, 4], false);
}

function buildLanes(level: number): Lane[] {
  const speedMul = Math.pow(1.15, level - 1);
  const lanes: Lane[] = [];

  // Road lanes: rows ROW_ROAD_TOP..ROW_ROAD_BOT — speeds spread 1.5 → 4 px/frame.
  const roadLaneCount = ROW_ROAD_BOT - ROW_ROAD_TOP + 1;
  for (let laneIndex = 0; laneIndex < roadLaneCount; laneIndex++) {
    const row = ROW_ROAD_TOP + laneIndex;
    const dir: 1 | -1 = laneIndex % 2 === 0 ? 1 : -1;
    const spread = (4 - 1.5) / Math.max(1, roadLaneCount - 1);
    const speed = (1.5 + laneIndex * spread) * speedMul;
    lanes.push({ row, speed, dir, entities: buildRoadLaneEntities(laneIndex) });
  }

  // River lanes: rows ROW_RIVER_TOP..ROW_RIVER_BOT — speeds spread 1 → 3 px/frame.
  const riverLaneCount = ROW_RIVER_BOT - ROW_RIVER_TOP + 1;
  for (let laneIndex = 0; laneIndex < riverLaneCount; laneIndex++) {
    const row = ROW_RIVER_TOP + laneIndex;
    const dir: 1 | -1 = laneIndex % 2 === 0 ? -1 : 1;
    const spread = (3 - 1) / Math.max(1, riverLaneCount - 1);
    const speed = (1 + laneIndex * spread) * speedMul;
    lanes.push({ row, speed, dir, entities: buildRiverLaneEntities(laneIndex) });
  }

  return lanes;
}

function createInitialState(): FroggerState {
  const level = 1;
  return {
    frog: {
      col: FROG_START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: FROG_START_COL,
      targetRow: ROW_START,
    },
    lanes: buildLanes(level),
    level,
    score: 0,
    lives: 3,
    goals: new Array(GOAL_COUNT).fill(false),
    timeLeft: roundTimeMs(level),
    maxRowReached: ROW_START,
    riverTime: 0,
    pendingDir: null,
    gameOver: false,
  };
}

// ── Collision & support detection (step 5) ──────────────────────────────────

function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  return lanes.some((lane) => {
    if (lane.row !== frog.row) return false;
    if (lane.row < ROW_ROAD_TOP || lane.row > ROW_ROAD_BOT) return false;
    return lane.entities.some(
      (e) => frog.col >= e.col && frog.col < e.col + e.width,
    );
  });
}

function getSupport(frog: Frog, lanes: Lane[]): Entity | null {
  const lane = lanes.find(
    (l) =>
      l.row === frog.row && l.row >= ROW_RIVER_TOP && l.row <= ROW_RIVER_BOT,
  );
  if (!lane) return null;
  const entity = lane.entities.find(
    (e) => frog.col >= e.col && frog.col < e.col + e.width,
  );
  if (!entity) return null;
  if (entity.type === 'turtle' && entity.submerged) return null;
  return entity;
}

function goalIndexForCol(col: number): number {
  return GOAL_STARTS.findIndex((start) => col >= start && col < start + 2);
}

type GoalOutcome = 'occupied' | 'died';

// Marks the mouth the frog landed on if it's free; mutates `goals` in place.
function checkGoal(frog: Frog, goals: boolean[]): GoalOutcome {
  const idx = goalIndexForCol(frog.col);
  if (idx === -1 || goals[idx]) return 'died';
  goals[idx] = true;
  return 'occupied';
}

// ── Per-frame lane simulation ────────────────────────────────────────────────

function moveLaneEntities(lanes: Lane[], dt: number): void {
  for (const lane of lanes) {
    for (const entity of lane.entities) {
      entity.col += (lane.speed * lane.dir * dt) / 16;
      if (lane.dir === 1 && entity.col > COLS) {
        entity.col = -entity.width;
      } else if (lane.dir === -1 && entity.col + entity.width < 0) {
        entity.col = COLS;
      }
    }
  }
}

// Deterministic per-lane phase so not all turtle groups submerge in sync.
function updateTurtleSubmersion(lanes: Lane[], riverTime: number): void {
  for (const lane of lanes) {
    for (const entity of lane.entities) {
      if (entity.type !== 'turtle') continue;
      const phase = (lane.row * 877) % TURTLE_CYCLE_MS;
      const t = (riverTime + phase) % TURTLE_CYCLE_MS;
      entity.submerged = t >= TURTLE_VISIBLE_MS;
    }
  }
}

// ── Drawing (pure, given a 2D context, current state and the active skin) ───

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawBackground(ctx: CanvasRenderingContext2D, skin: Skin): void {
  if (skin.boardBg) {
    ctx.fillStyle = skin.boardBg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  for (let row = 0; row < ROWS; row++) {
    let color: string;
    if (row === ROW_GOALS) color = skin.zoneBg.goal;
    else if (row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT)
      color = skin.zoneBg.river;
    else if (row === ROW_SAFE_MID || row === ROW_START)
      color = skin.zoneBg.safe;
    else color = skin.zoneBg.road;
    ctx.fillStyle = color;
    ctx.fillRect(0, row * CELL, CANVAS_W, CELL);
  }
}

function drawGoals(
  ctx: CanvasRenderingContext2D,
  goals: boolean[],
  skin: Skin,
): void {
  GOAL_STARTS.forEach((startCol, i) => {
    const x = startCol * CELL;
    const y = ROW_GOALS * CELL;
    const w = 2 * CELL;
    ctx.fillStyle = skin.goalMouthBg;
    ctx.fillRect(x + 2, y + 2, w - 4, CELL - 4);
    applyGlow(ctx, skin, skin.goalMouthBorder);
    ctx.strokeStyle = skin.goalMouthBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
    clearGlow(ctx);
    if (goals[i]) {
      applyGlow(ctx, skin, skin.goalFlag);
      ctx.fillStyle = skin.goalFlag;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + CELL / 2, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      clearGlow(ctx);
    }
  });
}

function drawRoadEntities(
  ctx: CanvasRenderingContext2D,
  lanes: Lane[],
  skin: Skin,
): void {
  for (const lane of lanes) {
    if (lane.row < ROW_ROAD_TOP || lane.row > ROW_ROAD_BOT) continue;
    lane.entities.forEach((e, i) => {
      const x = e.col * CELL;
      const y = lane.row * CELL;
      const w = e.width * CELL;
      if (e.type === 'car') {
        const color = skin.carColors[(i + lane.row) % skin.carColors.length];
        applyGlow(ctx, skin, color);
        ctx.fillStyle = color;
        ctx.fillRect(x + 3, y + 8, w - 6, CELL - 16);
        if (skin.blockHighlight) {
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(x + 3, y + 8, w - 6, 4);
        }
        if (skin.glow) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 3.5, y + 8.5, w - 7, CELL - 17);
        }
        clearGlow(ctx);
        ctx.fillStyle = skin.wheelColor;
        const wheelXLeft = x + 8;
        const wheelXRight = x + w - 8;
        for (let wheelIdx = 0; wheelIdx < 2; wheelIdx++) {
          const wx = wheelIdx === 0 ? wheelXLeft : wheelXRight;
          ctx.beginPath();
          ctx.arc(wx, y + CELL - 8, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        applyGlow(ctx, skin, skin.truckBody);
        ctx.fillStyle = skin.truckBody;
        ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
        if (skin.blockHighlight) {
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(x + 2, y + 6, w - 4, 4);
        }
        if (skin.glow) {
          ctx.strokeStyle = skin.truckBody;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2.5, y + 6.5, w - 5, CELL - 13);
        }
        clearGlow(ctx);
        applyGlow(ctx, skin, skin.truckCab);
        ctx.fillStyle = skin.truckCab;
        const cabW = CELL * 0.6;
        const cabX = lane.dir === 1 ? x + w - cabW - 2 : x + 2;
        ctx.fillRect(cabX, y + 4, cabW, CELL - 8);
        clearGlow(ctx);
      }
    });
  }
}

function drawRiverEntities(
  ctx: CanvasRenderingContext2D,
  lanes: Lane[],
  skin: Skin,
): void {
  for (const lane of lanes) {
    if (lane.row < ROW_RIVER_TOP || lane.row > ROW_RIVER_BOT) continue;
    for (const e of lane.entities) {
      const x = e.col * CELL;
      const y = lane.row * CELL;
      const w = e.width * CELL;
      if (e.type === 'log') {
        applyGlow(ctx, skin, skin.logBody);
        ctx.fillStyle = skin.logBody;
        ctx.fillRect(x + 1, y + 6, w - 2, CELL - 12);
        if (skin.blockHighlight) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(x + 1, y + 6, w - 2, 4);
        }
        clearGlow(ctx);
        ctx.strokeStyle = skin.logGrain;
        ctx.lineWidth = 1;
        for (let lx = x + 6; lx < x + w - 4; lx += 8) {
          ctx.beginPath();
          ctx.moveTo(lx, y + 8);
          ctx.lineTo(lx, y + CELL - 8);
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < e.width; i++) {
          const cx = x + i * CELL + CELL / 2;
          const cy = y + CELL / 2;
          if (e.submerged) {
            ctx.strokeStyle = skin.turtleSubmerged;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 14, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            applyGlow(ctx, skin, skin.turtleBody);
            ctx.fillStyle = skin.turtleBody;
            ctx.beginPath();
            ctx.arc(cx, cy, 14, 0, Math.PI * 2);
            ctx.fill();
            clearGlow(ctx);
            ctx.strokeStyle = skin.turtleShell;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx - 5, cy - 4, 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx + 5, cy + 4, 4, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
  }
}

function drawFrog(
  ctx: CanvasRenderingContext2D,
  frog: Frog,
  skin: Skin,
): void {
  const t = frog.animating ? Math.min(1, frog.animT / JUMP_MS) : 1;
  const col = frog.animating ? lerp(frog.col, frog.targetCol, t) : frog.col;
  const row = frog.animating ? lerp(frog.row, frog.targetRow, t) : frog.row;
  const hop = frog.animating ? Math.sin(t * Math.PI) * 6 : 0;

  const cx = col * CELL + CELL / 2;
  const cy = row * CELL + CELL / 2 - hop;

  if (frog.animating) {
    applyGlow(ctx, skin, skin.frogBody);
    ctx.strokeStyle = skin.frogBody;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 6);
    ctx.lineTo(cx - 18, cy + 14);
    ctx.moveTo(cx + 12, cy + 6);
    ctx.lineTo(cx + 18, cy + 14);
    ctx.stroke();
    clearGlow(ctx);
  }

  applyGlow(ctx, skin, skin.frogBody);
  ctx.fillStyle = skin.frogBody;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (skin.glow) {
    ctx.strokeStyle = skin.frogBody;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  clearGlow(ctx);

  ctx.fillStyle = skin.frogEyeWhite;
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 8, 4, 0, Math.PI * 2);
  ctx.arc(cx + 6, cy - 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.frogEyePupil;
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 8, 2, 0, Math.PI * 2);
  ctx.arc(cx + 6, cy - 8, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  s: FroggerState,
  skin: Skin,
): void {
  ctx.font = 'bold 16px monospace';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = skin.hudText;
  ctx.textAlign = 'left';
  ctx.fillText(String(s.score).padStart(6, '0'), 8, CELL / 2);

  ctx.fillStyle = skin.hudText;
  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${s.level}`, CANVAS_W / 2, CELL / 2);

  ctx.textAlign = 'right';
  for (let i = 0; i < s.lives; i++) {
    ctx.fillStyle = skin.frogBody;
    ctx.beginPath();
    ctx.arc(CANVAS_W - 12 - i * 18, CELL / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = 'left';

  const pct = Math.max(0, s.timeLeft / roundTimeMs(s.level));
  ctx.fillStyle =
    pct > 0.5 ? skin.hudTimerHigh : pct > 0.25 ? skin.hudTimerMid : skin.hudTimerLow;
  ctx.fillRect(0, 0, CANVAS_W * pct, 4);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FroggerGame({
  paused,
  skinKey = 'classic',
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const stateRef = useRef<FroggerState>(createInitialState());
  const skinRef = useRef<Skin>(SKINS[skinKey] ?? SKINS.classic);
  const updateRef = useRef<(dt: number) => void>(() => {});
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    skinRef.current = SKINS[skinKey] ?? SKINS.classic;
  }, [skinKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── Round / life management (steps 6 & 7) ────────────────────────────────

    function resetFrogPosition() {
      const s = stateRef.current;
      s.frog = {
        col: FROG_START_COL,
        row: ROW_START,
        animating: false,
        animT: 0,
        targetCol: FROG_START_COL,
        targetRow: ROW_START,
      };
      s.maxRowReached = ROW_START;
    }

    function killFrog() {
      const s = stateRef.current;
      s.lives -= 1;

      if (s.lives <= 0) {
        s.lives = 0;
        onLivesChange(0);
        s.gameOver = true;
        onGameOver(s.score);
        return;
      }

      onLivesChange(s.lives);
      resetFrogPosition();
      s.timeLeft = roundTimeMs(s.level);
    }

    function completeRound() {
      const s = stateRef.current;
      resetFrogPosition();
      s.goals = new Array(GOAL_COUNT).fill(false);
      s.level += 1;
      onLevelChange(s.level);
      s.lanes = buildLanes(s.level);
      s.timeLeft = roundTimeMs(s.level);
    }

    // ── Landing resolution (step 5 wiring) ───────────────────────────────────

    function resolveLanding() {
      const s = stateRef.current;
      const frog = s.frog;

      // +10 pts the first time this round the frog reaches a new row upward.
      if (frog.row < s.maxRowReached) {
        s.maxRowReached = frog.row;
        s.score += 10;
        onScoreChange(s.score);
      }

      if (frog.row === ROW_GOALS) {
        const outcome = checkGoal(frog, s.goals);
        if (outcome === 'died') {
          killFrog();
          return;
        }
        const timeBonus = Math.round((s.timeLeft / 1000) * 10);
        s.score += 50 + timeBonus;
        onScoreChange(s.score);
        if (s.goals.every(Boolean)) {
          s.score += 200;
          onScoreChange(s.score);
          completeRound();
        }
        return;
      }

      if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
        if (checkRoadCollision(frog, s.lanes)) killFrog();
        return;
      }

      if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
        if (!getSupport(frog, s.lanes)) killFrog();
      }
      // Safe zones (ROW_SAFE_MID, ROW_START): nothing to resolve.
    }

    function tryStartJump() {
      const s = stateRef.current;
      const frog = s.frog;
      if (!s.pendingDir) return;
      const dir = s.pendingDir;
      s.pendingDir = null;

      const delta = DIR_DELTA[dir];
      const baseCol = Math.round(frog.col);
      const targetCol = baseCol + delta.dx;
      const targetRow = frog.row + delta.dy;

      // Can't jump past the side edges or before/after the map.
      if (targetCol < 0 || targetCol >= COLS) return;
      if (targetRow < ROW_GOALS || targetRow > ROW_START) return;

      frog.col = baseCol;
      frog.animating = true;
      frog.animT = 0;
      frog.targetCol = targetCol;
      frog.targetRow = targetRow;
    }

    function driftOnSupport(dt: number) {
      const s = stateRef.current;
      const frog = s.frog;
      if (frog.row < ROW_RIVER_TOP || frog.row > ROW_RIVER_BOT) return;
      const lane = s.lanes.find((l) => l.row === frog.row);
      if (!lane) return;

      const support = getSupport(frog, s.lanes);
      if (!support) {
        killFrog();
        return;
      }

      frog.col += (lane.speed * lane.dir * dt) / 16;
      if (frog.col < 0 || frog.col > COLS - 1) {
        killFrog();
      }
    }

    // ── Update / draw (step 4) ────────────────────────────────────────────────

    function update(dt: number) {
      const s = stateRef.current;
      if (s.gameOver) return;

      moveLaneEntities(s.lanes, dt);
      s.riverTime += dt;
      updateTurtleSubmersion(s.lanes, s.riverTime);

      const frog = s.frog;
      if (frog.animating) {
        frog.animT += dt;
        if (frog.animT >= JUMP_MS) {
          frog.col = frog.targetCol;
          frog.row = frog.targetRow;
          frog.animating = false;
          resolveLanding();
          if (s.gameOver) return;
        }
      } else {
        tryStartJump();
      }

      if (!frog.animating) {
        driftOnSupport(dt);
        if (s.gameOver) return;
      }

      s.timeLeft -= dt;
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        killFrog();
      }
    }

    function draw() {
      const s = stateRef.current;
      const skin = skinRef.current;
      drawBackground(ctx, skin);
      drawGoals(ctx, s.goals, skin);
      drawRiverEntities(ctx, s.lanes, skin);
      drawRoadEntities(ctx, s.lanes, skin);
      drawFrog(ctx, s.frog, skin);
      drawHud(ctx, s, skin);
    }

    // The RAF loop itself lives in useGameLoop (called below, at the
    // component's top level); wire it to the latest update/draw closures.
    updateRef.current = update;
    drawRef.current = draw;

    // ── Keyboard ──────────────────────────────────────────────────────────────

    function handleKey(e: KeyboardEvent) {
      const map: Record<string, Direction> = {
        arrowup: 'up',
        w: 'up',
        arrowdown: 'down',
        s: 'down',
        arrowleft: 'left',
        a: 'left',
        arrowright: 'right',
        d: 'right',
      };
      const dir = map[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      stateRef.current.pendingDir = dir;
    }

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGameLoop({
    update: (dt) => updateRef.current(dt),
    draw: () => drawRef.current(),
    isPaused: () => pausedRef.current,
    shouldContinue: () => !stateRef.current.gameOver,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}
