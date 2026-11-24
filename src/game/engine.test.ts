import test from 'node:test';
import assert from 'node:assert/strict';
import { SubwayGameEngine } from './engine';
import { LANE_X, TRAIN_HEIGHT } from './constants';

test('opening corridor survives at least 3.5 seconds with zero input', () => {
  const engine = new SubwayGameEngine(42);
  engine.startRun(42);

  // Simulate 3.5 seconds at 60 FPS with no user input
  for (let i = 0; i < 210; i++) {
    engine.step(1 / 60);
  }

  assert.equal(engine.phase, 'playing');
  assert.ok(engine.distance > 75, `expected distance > 75, got ${engine.distance}`);
  assert.ok(engine.score > 100, `expected score > 100, got ${engine.score}`);
  assert.ok(engine.coinsCollected >= 4, 'should auto-collect inviting center opening coins');
});

test('lane switching clamps to [-1, 0, 1] and smoothly springs to target X', () => {
  const engine = new SubwayGameEngine(101);
  engine.startRun(101);

  assert.equal(engine.moveLane(1), true);
  assert.equal(engine.player.lane, 1);
  assert.equal(engine.moveLane(1), false); // Already at right edge

  for (let i = 0; i < 45; i++) {
    engine.step(1 / 60);
  }
  assert.ok(
    Math.abs(engine.player.x - LANE_X[1]) < 0.08,
    `expected x near ${LANE_X[1]}, got ${engine.player.x}`,
  );
});

test('jump, gravity, and fast-fall slam into parkour roll work cleanly', () => {
  const engine = new SubwayGameEngine(102);
  engine.startRun(102);

  engine.requestJump();
  engine.step(1 / 60);
  assert.equal(engine.player.grounded, false);
  assert.ok(engine.player.vy > 10);

  // Ascend briefly
  for (let i = 0; i < 10; i++) {
    engine.step(1 / 60);
  }
  assert.ok(engine.player.y > 1.5);

  // Trigger fast-fall slam roll
  engine.requestRoll();
  assert.ok(engine.player.vy < -20);

  let landedWithRoll = false;
  for (let i = 0; i < 30; i++) {
    engine.step(1 / 60);
    if (engine.player.grounded && engine.player.rolling) {
      landedWithRoll = true;
      break;
    }
  }
  assert.equal(landedWithRoll, true, 'fast-fall should transition into roll on landing');
});

test('ramp train lifts runner smoothly onto rooftop and maintains roof elevation', () => {
  const engine = new SubwayGameEngine(103);
  engine.startRun(103);

  // Place a ramp train directly ahead in lane 0
  engine.obstacles = [
    {
      id: 999,
      kind: 'train_ramp',
      lane: 0,
      z: -20,
      length: 20,
      height: TRAIN_HEIGHT,
      rampLength: 6,
      speed: 0,
      variant: 0,
    },
  ];
  engine.coins = [];
  engine.powerups = [];

  let reachedRoof = false;
  for (let i = 0; i < 90; i++) {
    engine.step(1 / 60);
    if (engine.player.y >= TRAIN_HEIGHT - 0.1) {
      reachedRoof = true;
    }
  }
  assert.equal(engine.phase, 'playing');
  assert.equal(reachedRoof, true, 'runner should climb ramp onto train roof');
});

test('hoverboard shield absorbs fatal head-on collision and keeps run alive', () => {
  const engine = new SubwayGameEngine(104);
  engine.startRun(104);

  const activated = engine.activateHoverboard();
  assert.equal(activated, true);
  assert.ok(engine.player.hoverboardTimer > 0);

  // Put a solid parked train directly ahead
  engine.obstacles = [
    {
      id: 888,
      kind: 'train_parked',
      lane: 0,
      z: -14,
      length: 16,
      height: TRAIN_HEIGHT,
      rampLength: 0,
      speed: 0,
      variant: 0,
    },
  ];

  let shieldBroken = false;
  for (let i = 0; i < 40; i++) {
    const events = engine.step(1 / 60);
    if (events.some((e) => e.type === 'shield_break')) {
      shieldBroken = true;
    }
  }

  assert.equal(shieldBroken, true, 'hoverboard should emit shield_break on collision');
  assert.equal(engine.phase, 'playing', 'player should survive collision with hoverboard');
  assert.equal(engine.player.hoverboardTimer, 0);
});

test('head-on collision without shield triggers gameover with frozen run summary', () => {
  const engine = new SubwayGameEngine(105);
  engine.startRun(105);

  engine.obstacles = [
    {
      id: 777,
      kind: 'barrier_full',
      lane: 0,
      z: -10,
      length: 1.5,
      height: 2.7,
      rampLength: 0,
      speed: 0,
      variant: 0,
    },
  ];

  for (let i = 0; i < 45; i++) {
    engine.step(1 / 60);
    if (engine.phase === 'gameover') break;
  }

  assert.equal(engine.phase, 'gameover');
  assert.ok(engine.runSummary !== null);
  assert.ok(engine.runSummary!.distance > 0);
});
