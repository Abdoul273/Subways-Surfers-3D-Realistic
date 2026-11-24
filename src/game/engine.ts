import {
  BARRIER_HIGH_CLEARANCE,
  BASE_SPEED,
  COYOTE_TIME,
  DESPAWN_BEHIND_DISTANCE,
  FAST_FALL_VELOCITY,
  GRAVITY,
  INPUT_BUFFER_TIME,
  JETPACK_CRUISE_Y,
  JETPACK_SPEED_BOOST,
  JUMP_VELOCITY,
  LANE_X,
  MAX_SPEED,
  PLAYER_HEIGHT_ROLL,
  PLAYER_HEIGHT_STAND,
  PLAYER_RADIUS,
  POWERUP_DURATION,
  ROLL_DURATION,
  SPAWN_AHEAD_DISTANCE,
  SPEED_RAMP_PER_SECOND,
  STUMBLE_RESET_TIME,
  SUPER_JUMP_VELOCITY,
  TRAIN_HALF_WIDTH,
} from './constants';
import { TrackSpawner } from './spawner';
import type {
  CoinEntity,
  GameEvent,
  GamePhase,
  HudSnapshot,
  LaneIndex,
  ObstacleEntity,
  PlayerState,
  PowerupEntity,
  RunSummary,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export class SubwayGameEngine {
  public phase: GamePhase = 'title';
  public player: PlayerState;
  public obstacles: ObstacleEntity[] = [];
  public coins: CoinEntity[] = [];
  public powerups: PowerupEntity[] = [];
  public speed = BASE_SPEED;
  public distance = 0;
  public score = 0;
  public bestScore = 0;
  public coinsCollected = 0;
  public multiplier = 1;
  public maxSpeedKmh = 0;
  public elapsedPlayTime = 0;
  public hitstopTimer = 0;
  public trauma = 0;
  public runSummary: RunSummary | null = null;
  public events: GameEvent[] = [];

  private spawner: TrackSpawner;
  private nextSpawnZ = -140;
  private jetpackCoinZ = -60;
  private coinStreak = 0;
  private coinStreakTimer = 0;
  private seed: number;

  constructor(seed = 20261123, bestScore = 0) {
    this.seed = seed;
    this.bestScore = bestScore;
    this.spawner = new TrackSpawner(seed);
    this.player = this.createInitialPlayer();
    this.resetWorld();
  }

  private createInitialPlayer(): PlayerState {
    return {
      lane: 0,
      prevLane: 0,
      x: 0,
      vx: 0,
      y: 0,
      vy: 0,
      z: 0,
      groundY: 0,
      grounded: true,
      coyoteTimer: COYOTE_TIME,
      jumpBufferTimer: 0,
      rollBufferTimer: 0,
      rolling: false,
      rollTimer: 0,
      squashX: 1,
      squashY: 1,
      tiltZ: 0,
      runCycle: 0,
      stumbleTimer: 0,
      stumbleCount: 0,
      invulnerableTimer: 0,
      magnetTimer: 0,
      jetpackTimer: 0,
      sneakersTimer: 0,
      hoverboardTimer: 0,
      hoverboardCharges: 2,
      pursuerProximity: 0.25,
    };
  }

  public resetWorld(newSeed?: number): void {
    if (typeof newSeed === 'number') {
      this.seed = newSeed;
    }
    this.spawner.reset(this.seed);
    this.player = this.createInitialPlayer();
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.score = 0;
    this.coinsCollected = 0;
    this.multiplier = 1;
    this.maxSpeedKmh = Math.round(BASE_SPEED * 3.6);
    this.elapsedPlayTime = 0;
    this.hitstopTimer = 0;
    this.trauma = 0;
    this.runSummary = null;
    this.coinStreak = 0;
    this.coinStreakTimer = 0;
    this.events.length = 0;

    const opening = this.spawner.spawnOpeningCorridor();
    this.obstacles.push(...opening.obstacles);
    this.coins.push(...opening.coins);
    this.powerups.push(...opening.powerups);
    this.nextSpawnZ = opening.nextZ;
    this.fillTrackAhead();
  }

  public startRun(newSeed?: number): void {
    this.resetWorld(newSeed);
    this.phase = 'playing';
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
    }
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
  }

  public moveLane(delta: -1 | 1): boolean {
    if (this.phase !== 'playing') return false;
    const nextLane = clamp(this.player.lane + delta, -1, 1) as LaneIndex;
    if (nextLane === this.player.lane) {
      // Trying to slam against track boundary causes subtle feedback only
      return false;
    }
    this.player.prevLane = this.player.lane;
    this.player.lane = nextLane;
    this.player.tiltZ = -delta * 0.26;
    this.events.push({
      type: 'lane_switch',
      x: this.player.x,
      y: this.player.y,
      z: this.player.z,
    });
    return true;
  }

  public requestJump(): void {
    if (this.phase !== 'playing') return;
    if (this.player.jetpackTimer > 0) return;
    this.player.jumpBufferTimer = INPUT_BUFFER_TIME;
  }

  public requestRoll(): void {
    if (this.phase !== 'playing') return;
    if (this.player.jetpackTimer > 0) return;
    if (!this.player.grounded) {
      // Fast-fall slam directly into a parkour roll!
      this.player.vy = Math.min(this.player.vy, FAST_FALL_VELOCITY);
      this.player.rollBufferTimer = 0.35;
    } else {
      this.triggerRoll();
    }
  }

  public activateHoverboard(): boolean {
    if (this.phase !== 'playing') return false;
    if (this.player.hoverboardTimer > 0 || this.player.hoverboardCharges <= 0) {
      return false;
    }
    this.player.hoverboardCharges -= 1;
    this.player.hoverboardTimer = POWERUP_DURATION.hoverboard;
    this.player.stumbleCount = 0;
    this.player.stumbleTimer = 0;
    this.trauma = Math.min(1, this.trauma + 0.28);
    this.events.push({
      type: 'hoverboard_on',
      x: this.player.x,
      y: this.player.y,
      z: this.player.z,
    });
    return true;
  }

  private triggerJump(): void {
    const p = this.player;
    const boost = p.sneakersTimer > 0 ? SUPER_JUMP_VELOCITY : JUMP_VELOCITY;
    p.vy = boost;
    p.grounded = false;
    p.coyoteTimer = 0;
    p.jumpBufferTimer = 0;
    p.rolling = false;
    p.rollTimer = 0;
    p.squashX = 0.84;
    p.squashY = 1.2;
    this.events.push({ type: 'jump', x: p.x, y: p.y, z: p.z });
  }

  private triggerRoll(): void {
    const p = this.player;
    p.rolling = true;
    p.rollTimer = ROLL_DURATION;
    p.rollBufferTimer = 0;
    p.squashX = 1.24;
    p.squashY = 0.62;
    this.events.push({ type: 'roll', x: p.x, y: p.y, z: p.z });
  }

  private fillTrackAhead(): void {
    const difficulty = clamp(this.distance / 1800, 0, 1);
    while (this.nextSpawnZ > this.player.z - SPAWN_AHEAD_DISTANCE) {
      const wave = this.spawner.spawnWave(this.nextSpawnZ, difficulty);
      this.obstacles.push(...wave.obstacles);
      this.coins.push(...wave.coins);
      this.powerups.push(...wave.powerups);
      this.nextSpawnZ = wave.nextZ;
    }
  }

  /**
   * Computes the walkable ground surface height beneath (x, z) based on
   * trains and climbable front ramps.
   */
  public getSupportSurfaceY(x: number, z: number, currentY: number): number {
    let supportY = 0;
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.cleared) continue;
      if (
        obs.kind !== 'train_parked' &&
        obs.kind !== 'train_ramp' &&
        obs.kind !== 'train_oncoming'
      ) {
        continue;
      }
      const obsX = LANE_X[obs.lane];
      if (Math.abs(x - obsX) > TRAIN_HALF_WIDTH + PLAYER_RADIUS * 0.35) continue;

      const frontZ = obs.z + obs.length * 0.5;
      const backZ = obs.z - obs.length * 0.5;
      if (z > frontZ + 0.35 || z < backZ - 0.35) continue;

      if (obs.kind === 'train_ramp' && obs.rampLength > 0) {
        const rampEndZ = frontZ - obs.rampLength;
        if (z >= rampEndZ) {
          const t = clamp((frontZ - z) / obs.rampLength, 0, 1);
          const rampY = t * obs.height;
          if (currentY >= rampY - 0.75) {
            supportY = Math.max(supportY, rampY);
          }
          continue;
        }
      }

      // Flat train roof if player is already high enough
      if (currentY >= obs.height - 0.85) {
        supportY = Math.max(supportY, obs.height);
      }
    }
    return supportY;
  }

  public step(rawDt: number): GameEvent[] {
    this.events.length = 0;
    const dt = Math.min(Math.max(rawDt, 0), 0.05);

    // Trauma decays even during hitstop / gameover
    this.trauma = Math.max(0, this.trauma - dt * 2.4);

    if (this.phase !== 'playing') {
      return this.events;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return this.events;
    }

    const p = this.player;
    this.elapsedPlayTime += dt;

    // Power-up countdowns
    if (p.magnetTimer > 0) p.magnetTimer = Math.max(0, p.magnetTimer - dt);
    if (p.sneakersTimer > 0) p.sneakersTimer = Math.max(0, p.sneakersTimer - dt);
    if (p.hoverboardTimer > 0) p.hoverboardTimer = Math.max(0, p.hoverboardTimer - dt);
    if (p.invulnerableTimer > 0) p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dt);
    if (p.jetpackTimer > 0) {
      p.jetpackTimer = Math.max(0, p.jetpackTimer - dt);
      if (p.jetpackTimer === 0) {
        p.invulnerableTimer = Math.max(p.invulnerableTimer, 1.2);
      }
    }

    if (p.stumbleTimer > 0) {
      p.stumbleTimer = Math.max(0, p.stumbleTimer - dt);
      if (p.stumbleTimer === 0) {
        p.stumbleCount = 0;
      }
    }

    if (this.coinStreakTimer > 0) {
      this.coinStreakTimer = Math.max(0, this.coinStreakTimer - dt);
      if (this.coinStreakTimer === 0) {
        this.coinStreak = 0;
      }
    }

    // Speed progression & multiplier
    const baseTargetSpeed = clamp(
      BASE_SPEED + this.elapsedPlayTime * SPEED_RAMP_PER_SECOND,
      BASE_SPEED,
      MAX_SPEED,
    );
    const targetSpeed =
      p.jetpackTimer > 0 ? baseTargetSpeed + JETPACK_SPEED_BOOST : baseTargetSpeed;
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-5.0 * dt));

    const speedKmh = Math.round(this.speed * 3.6);
    if (speedKmh > this.maxSpeedKmh) this.maxSpeedKmh = speedKmh;

    // Advance forward along -Z
    const forwardStep = this.speed * dt;
    p.z -= forwardStep;
    this.distance += forwardStep;
    this.multiplier = Math.min(
      10,
      1 + Math.floor(this.distance / 220) + (p.hoverboardTimer > 0 ? 1 : 0),
    );
    this.score += forwardStep * 1.45 * this.multiplier;

    // Spring-damped lateral lane movement
    const targetX = LANE_X[p.lane];
    const stiffness = 210;
    const damping = 24;
    const ax = (targetX - p.x) * stiffness - p.vx * damping;
    p.vx += ax * dt;
    p.x += p.vx * dt;
    if (Math.abs(targetX - p.x) < 0.015 && Math.abs(p.vx) < 0.05) {
      p.x = targetX;
      p.vx = 0;
    }

    // Visual banking & squash recovery
    const targetTilt = clamp(-p.vx * 0.025, -0.32, 0.32);
    p.tiltZ += (targetTilt - p.tiltZ) * (1 - Math.exp(-14 * dt));
    p.squashX += (1 - p.squashX) * (1 - Math.exp(-13 * dt));
    p.squashY += (1 - p.squashY) * (1 - Math.exp(-13 * dt));

    // Advance oncoming trains
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.speed > 0 && obs.z > p.z - 165) {
        obs.z += obs.speed * dt;
      }
    }

    // Vertical physics: Jetpack vs standard runner physics
    if (p.jetpackTimer > 0) {
      p.grounded = false;
      p.rolling = false;
      p.rollTimer = 0;
      p.vy = 0;
      p.y += (JETPACK_CRUISE_Y - p.y) * (1 - Math.exp(-7 * dt));
      if (this.jetpackCoinZ > p.z - 95) {
        this.jetpackCoinZ = Math.min(this.jetpackCoinZ, p.z - 22);
        const jetCoins = this.spawner.spawnJetpackCoins(this.jetpackCoinZ);
        this.coins.push(...jetCoins);
        this.jetpackCoinZ -= 28;
      }
    } else {
      const supportY = this.getSupportSurfaceY(p.x, p.z, p.y);
      p.groundY = supportY;

      if (p.grounded) {
        p.coyoteTimer = COYOTE_TIME;
      } else {
        p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
      }

      if (p.jumpBufferTimer > 0) {
        p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
        if (p.coyoteTimer > 0) {
          this.triggerJump();
        }
      }

      if (p.rollBufferTimer > 0) {
        p.rollBufferTimer = Math.max(0, p.rollBufferTimer - dt);
      }

      // Gravity integration
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;

      if (p.y <= supportY) {
        const wasAirborne = !p.grounded && p.vy < -6;
        p.y = supportY;
        p.vy = 0;
        p.grounded = true;
        if (wasAirborne) {
          p.squashX = 1.22;
          p.squashY = 0.78;
          this.events.push({ type: 'land', x: p.x, y: p.y, z: p.z });
          if (p.rollBufferTimer > 0) {
            this.triggerRoll();
          }
        }
      } else if (p.y > supportY + 0.12) {
        p.grounded = false;
      }

      // Roll timer
      if (p.rolling) {
        p.rollTimer -= dt;
        if (p.rollTimer <= 0) {
          p.rolling = false;
          p.rollTimer = 0;
        }
      }

      // Gait cycle strictly tied to distance traveled (never skates!)
      if (p.grounded && !p.rolling) {
        p.runCycle += forwardStep * 0.92;
      }
    }

    // Pursuer proximity smoothly follows stumble tension
    const targetPursuer = p.stumbleCount > 0 ? 0.92 : 0.18;
    p.pursuerProximity += (targetPursuer - p.pursuerProximity) * (1 - Math.exp(-3.5 * dt));

    // Check collisions, coins, and powerups
    this.resolveCollisions();
    this.resolveCoins(dt);
    this.resolvePowerups();

    // Recycle old entities & spawn new track ahead
    this.prunePassedEntities();
    this.fillTrackAhead();

    return this.events;
  }

  private resolveCollisions(): void {
    const p = this.player;
    if (p.jetpackTimer > 0 || p.invulnerableTimer > 0) return;

    const playerTop = p.y + (p.rolling ? PLAYER_HEIGHT_ROLL : PLAYER_HEIGHT_STAND);
    const playerBottom = p.y;

    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.cleared) continue;

      const obsX = LANE_X[obs.lane];
      const halfWidth =
        obs.kind.startsWith('train') ? TRAIN_HALF_WIDTH : 1.15;
      const dx = Math.abs(p.x - obsX);
      if (dx > halfWidth + PLAYER_RADIUS * 0.72) continue;

      const frontZ = obs.z + obs.length * 0.5;
      const backZ = obs.z - obs.length * 0.5;
      if (p.z - PLAYER_RADIUS > frontZ || p.z + PLAYER_RADIUS < backZ) continue;

      if (obs.kind === 'barrier_low') {
        if (playerBottom < obs.height - 0.18) {
          this.handleHazardImpact(obs, false);
          return;
        }
      } else if (obs.kind === 'barrier_high') {
        if (playerTop > BARRIER_HIGH_CLEARANCE + 0.08 && playerBottom < obs.height - 0.15) {
          this.handleHazardImpact(obs, false);
          return;
        }
      } else if (obs.kind === 'barrier_full') {
        if (playerBottom < obs.height - 0.2) {
          this.handleHazardImpact(obs, false);
          return;
        }
      } else {
        // Train collision (parked, ramp, oncoming)
        if (obs.kind === 'train_ramp' && obs.rampLength > 0) {
          const rampEndZ = frontZ - obs.rampLength;
          if (p.z >= rampEndZ - 0.4) {
            const t = clamp((frontZ - p.z) / obs.rampLength, 0, 1);
            const rampY = t * obs.height;
            if (p.y >= rampY - 0.95) {
              continue; // Cleanly running up the ramp!
            }
          }
        }

        // Already cleanly on top of the train roof
        if (playerBottom >= obs.height - 0.65) {
          continue;
        }

        // Determine side-graze vs head-on impact:
        // If player is laterally switching into the side of the train well past its front nose
        const isPastFrontNose = p.z < frontZ - 1.1;
        const isSwitchingSideways = Math.abs(p.vx) > 2.2 && p.lane !== p.prevLane;
        const isSideGraze = isPastFrontNose && isSwitchingSideways && dx > halfWidth * 0.48;

        this.handleHazardImpact(obs, isSideGraze);
        return;
      }
    }
  }

  private handleHazardImpact(obs: ObstacleEntity, isSideGraze: boolean): void {
    const p = this.player;

    if (p.hoverboardTimer > 0) {
      // Hoverboard shield absorbs the impact and vaporizes nearby obstacle!
      p.hoverboardTimer = 0;
      p.invulnerableTimer = 1.4;
      obs.cleared = true;
      this.hitstopTimer = 0.055;
      this.trauma = Math.min(1, this.trauma + 0.65);
      this.events.push({
        type: 'shield_break',
        x: p.x,
        y: p.y + 0.9,
        z: p.z,
      });
      return;
    }

    if (isSideGraze && p.stumbleCount === 0) {
      // Bounce back into previous lane with stumble + sparks!
      p.lane = p.prevLane;
      p.vx = (LANE_X[p.lane] - p.x) * 9;
      p.stumbleCount = 1;
      p.stumbleTimer = STUMBLE_RESET_TIME;
      p.invulnerableTimer = 0.45;
      this.hitstopTimer = 0.04;
      this.trauma = Math.min(1, this.trauma + 0.52);
      this.events.push({
        type: 'stumble',
        x: p.x,
        y: p.y + 0.9,
        z: p.z,
      });
      return;
    }

    // Fatal head-on crash or double stumble
    this.hitstopTimer = 0.065;
    this.trauma = 1.0;
    const finalScore = Math.round(this.score);
    const isNewBest = finalScore > this.bestScore;
    if (isNewBest) {
      this.bestScore = finalScore;
    }
    this.runSummary = {
      score: finalScore,
      bestScore: this.bestScore,
      coins: this.coinsCollected,
      distance: Math.round(this.distance),
      maxSpeedKmh: this.maxSpeedKmh,
      isNewBest,
    };
    this.phase = 'gameover';
    this.events.push({
      type: 'crash',
      x: p.x,
      y: p.y + 1.0,
      z: p.z,
    });
  }

  private resolveCoins(dt: number): void {
    const p = this.player;
    const magnetActive = p.magnetTimer > 0;
    const playerCenterY = p.y + (p.rolling ? 0.55 : 0.95);

    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (c.collected) continue;

      const dx = p.x - c.x;
      const dy = playerCenterY - c.y;
      const dz = p.z - c.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (magnetActive && distSq < 12 * 12) {
        c.magnetized = true;
      }

      if (c.magnetized) {
        const pull = 1 - Math.exp(-16 * dt);
        c.x += dx * pull;
        c.y += dy * pull;
        c.z += dz * pull;
      }

      const ndx = p.x - c.x;
      const ndy = playerCenterY - c.y;
      const ndz = p.z - c.z;
      if (ndx * ndx + ndy * ndy + ndz * ndz < 1.35 * 1.35) {
        c.collected = true;
        this.coinsCollected += 1;
        this.coinStreak = Math.min(24, this.coinStreak + 1);
        this.coinStreakTimer = 1.1;
        this.score += 15 * this.multiplier;
        this.events.push({
          type: 'coin',
          x: c.x,
          y: c.y,
          z: c.z,
          combo: this.coinStreak,
        });
      }
    }
  }

  private resolvePowerups(): void {
    const p = this.player;
    const playerCenterY = p.y + 1.0;

    for (let i = 0; i < this.powerups.length; i++) {
      const pu = this.powerups[i];
      if (pu.collected) continue;

      const puX = LANE_X[pu.lane];
      const dx = p.x - puX;
      const dy = playerCenterY - pu.y;
      const dz = p.z - pu.z;

      if (dx * dx + dy * dy + dz * dz < 1.55 * 1.55) {
        pu.collected = true;
        if (pu.kind === 'magnet') {
          p.magnetTimer = POWERUP_DURATION.magnet;
        } else if (pu.kind === 'sneakers') {
          p.sneakersTimer = POWERUP_DURATION.sneakers;
        } else if (pu.kind === 'hoverboard') {
          p.hoverboardCharges = Math.min(5, p.hoverboardCharges + 1);
        } else if (pu.kind === 'jetpack') {
          p.jetpackTimer = POWERUP_DURATION.jetpack;
          this.jetpackCoinZ = p.z - 22;
          this.events.push({
            type: 'jetpack_start',
            x: p.x,
            y: p.y,
            z: p.z,
            powerup: 'jetpack',
          });
        }

        this.events.push({
          type: 'powerup',
          x: puX,
          y: pu.y,
          z: pu.z,
          powerup: pu.kind,
        });
      }
    }
  }

  private prunePassedEntities(): void {
    const cutoffZ = this.player.z + DESPAWN_BEHIND_DISTANCE;
    if (this.obstacles.length > 0) {
      this.obstacles = this.obstacles.filter((o) => o.z - o.length * 0.5 < cutoffZ && !o.cleared);
    }
    if (this.coins.length > 0) {
      this.coins = this.coins.filter((c) => !c.collected && c.z < cutoffZ);
    }
    if (this.powerups.length > 0) {
      this.powerups = this.powerups.filter((pu) => !pu.collected && pu.z < cutoffZ);
    }
  }

  public getHudSnapshot(): HudSnapshot {
    const p = this.player;
    return {
      phase: this.phase,
      score: Math.round(this.score),
      bestScore: Math.max(this.bestScore, Math.round(this.score)),
      coins: this.coinsCollected,
      distance: Math.round(this.distance),
      speedKmh: Math.round(this.speed * 3.6),
      multiplier: this.multiplier,
      hoverboardCharges: p.hoverboardCharges,
      hoverboardActive: p.hoverboardTimer > 0,
      magnetRatio: p.magnetTimer / POWERUP_DURATION.magnet,
      jetpackRatio: p.jetpackTimer / POWERUP_DURATION.jetpack,
      sneakersRatio: p.sneakersTimer / POWERUP_DURATION.sneakers,
      hoverboardRatio: p.hoverboardTimer / POWERUP_DURATION.hoverboard,
      stumbleWarning: p.stumbleCount > 0 && p.stumbleTimer > 0,
      runSummary: this.runSummary,
    };
  }
}
