import {
  BARRIER_FULL_HEIGHT,
  BARRIER_HIGH_TOP,
  BARRIER_LOW_HEIGHT,
  LANE_X,
  TRAIN_HEIGHT,
  TRAIN_ONCOMING_LENGTH,
  TRAIN_ONCOMING_SPEED,
  TRAIN_PARKED_LENGTH,
  TRAIN_RAMP_LENGTH,
  TRAIN_RAMP_SLOPE_LEN,
} from './constants';
import type {
  CoinEntity,
  LaneIndex,
  ObstacleEntity,
  PowerupEntity,
  PowerupKind,
} from './types';

export interface SpawnResult {
  obstacles: ObstacleEntity[];
  coins: CoinEntity[];
  powerups: PowerupEntity[];
  nextZ: number;
}

const LANES: LaneIndex[] = [-1, 0, 1];
const POWERUP_POOL: PowerupKind[] = ['magnet', 'jetpack', 'sneakers', 'hoverboard'];

/** Simple deterministic Mulberry32 PRNG so tests and replays stay repeatable */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TrackSpawner {
  private nextId = 1;
  private rng: () => number;
  private wavesSpawned = 0;

  constructor(seed = 20261123) {
    this.rng = createRng(seed);
  }

  public reset(seed = 20261123): void {
    this.nextId = 1;
    this.rng = createRng(seed);
    this.wavesSpawned = 0;
  }

  private allocId(): number {
    return this.nextId++;
  }

  private pickLane(): LaneIndex {
    return LANES[Math.floor(this.rng() * 3)];
  }

  private addCoinLine(
    coins: CoinEntity[],
    lane: LaneIndex,
    startZ: number,
    count: number,
    spacing: number,
    baseY: number,
    arcHeight = 0,
  ): void {
    const x = LANE_X[lane];
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const y = baseY + Math.sin(t * Math.PI) * arcHeight;
      coins.push({
        id: this.allocId(),
        lane,
        x,
        y,
        z: startZ - i * spacing,
        collected: false,
        magnetized: false,
      });
    }
  }

  /**
   * Generates a welcoming, obstacle-free opening corridor with guiding coin trails
   * so the player always survives the initial seconds without input and immediately
   * sees rich track geometry and pickups.
   */
  public spawnOpeningCorridor(): SpawnResult {
    const obstacles: ObstacleEntity[] = [];
    const coins: CoinEntity[] = [];
    const powerups: PowerupEntity[] = [];

    // Inviting center coin trail straight ahead
    this.addCoinLine(coins, 0, -22, 7, 3.0, 0.95);
    // Flanking parked express metro trains close enough to showcase metallic PBR detail
    // on the Title screen and opening sprint, while keeping center lane 100% clear!
    obstacles.push({
      id: this.allocId(),
      kind: 'train_parked',
      lane: 1,
      z: -36,
      length: TRAIN_PARKED_LENGTH,
      height: TRAIN_HEIGHT,
      rampLength: 0,
      speed: 0,
      variant: 0,
    });
    obstacles.push({
      id: this.allocId(),
      kind: 'train_parked',
      lane: -1,
      z: -62,
      length: TRAIN_PARKED_LENGTH,
      height: TRAIN_HEIGHT,
      rampLength: 0,
      speed: 0,
      variant: 1,
    });

    // Extra side coin strip on the left before the left train
    this.addCoinLine(coins, -1, -34, 4, 3.0, 0.95);
    // Easy jumpable barrier on right lane beyond the first train
    obstacles.push({
      id: this.allocId(),
      kind: 'barrier_low',
      lane: 1,
      z: -66,
      length: 1.1,
      height: BARRIER_LOW_HEIGHT,
      rampLength: 0,
      speed: 0,
      variant: 0,
    });
    this.addCoinLine(coins, 1, -60, 5, 2.8, 1.0, 2.1);

    // First ramp train in center lane further out to invite rooftop parkour
    obstacles.push({
      id: this.allocId(),
      kind: 'train_ramp',
      lane: 0,
      z: -124,
      length: TRAIN_RAMP_LENGTH,
      height: TRAIN_HEIGHT,
      rampLength: TRAIN_RAMP_SLOPE_LEN,
      speed: 0,
      variant: 2,
    });
    this.addCoinLine(coins, 0, -116, 6, 2.7, TRAIN_HEIGHT + 0.95);

    return {
      obstacles,
      coins,
      powerups,
      nextZ: -148,
    };
  }

  /**
   * Spawns the next procedural track segment at `startZ` (negative Z).
   * Always guarantees at least one navigable route (open lane, ramp, jumpable, or rollable).
   */
  public spawnWave(startZ: number, difficulty: number): SpawnResult {
    this.wavesSpawned++;
    const obstacles: ObstacleEntity[] = [];
    const coins: CoinEntity[] = [];
    const powerups: PowerupEntity[] = [];

    const roll = this.rng();
    const gap = Math.max(15, 25 - difficulty * 6.5);

    if (roll < 0.24) {
      // Pattern 1: Dual trains with 1 open or ramp lane + rooftop parkour chain
      const openLane = this.pickLane();
      const useRamp = this.rng() < 0.65;
      for (const lane of LANES) {
        if (lane === openLane) {
          if (useRamp) {
            obstacles.push({
              id: this.allocId(),
              kind: 'train_ramp',
              lane,
              z: startZ - TRAIN_RAMP_LENGTH * 0.5,
              length: TRAIN_RAMP_LENGTH,
              height: TRAIN_HEIGHT,
              rampLength: TRAIN_RAMP_SLOPE_LEN,
              speed: 0,
              variant: Math.floor(this.rng() * 3),
            });
            this.addCoinLine(coins, lane, startZ - 5, 6, 2.7, TRAIN_HEIGHT + 0.95);
          } else {
            this.addCoinLine(coins, lane, startZ - 3, 6, 3.0, 0.95);
          }
        } else {
          const isOncoming = difficulty > 0.2 && this.rng() < 0.35 + difficulty * 0.25;
          obstacles.push({
            id: this.allocId(),
            kind: isOncoming ? 'train_oncoming' : 'train_parked',
            lane,
            z: startZ - (isOncoming ? 26 : TRAIN_PARKED_LENGTH * 0.5),
            length: isOncoming ? TRAIN_ONCOMING_LENGTH : TRAIN_PARKED_LENGTH,
            height: TRAIN_HEIGHT,
            rampLength: 0,
            speed: isOncoming ? TRAIN_ONCOMING_SPEED * (0.85 + difficulty * 0.4) : 0,
            variant: Math.floor(this.rng() * 3),
          });
        }
      }
      if (this.wavesSpawned % 4 === 0) {
        powerups.push({
          id: this.allocId(),
          kind: POWERUP_POOL[Math.floor(this.rng() * POWERUP_POOL.length)],
          lane: openLane,
          y: useRamp ? TRAIN_HEIGHT + 1.15 : 1.15,
          z: startZ - 14,
          collected: false,
        });
      }
      return { obstacles, coins, powerups, nextZ: startZ - TRAIN_RAMP_LENGTH - gap };
    }

    if (roll < 0.5) {
      // Pattern 2: Rhythmic Barrier Slalom (Low Jump + High Roll + Open/Full)
      const perm = [...LANES];
      for (let i = perm.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }

      obstacles.push({
        id: this.allocId(),
        kind: 'barrier_low',
        lane: perm[0],
        z: startZ - 4,
        length: 1.1,
        height: BARRIER_LOW_HEIGHT,
        rampLength: 0,
        speed: 0,
        variant: 0,
      });
      this.addCoinLine(coins, perm[0], startZ + 2, 5, 2.8, 1.0, 2.2);

      obstacles.push({
        id: this.allocId(),
        kind: 'barrier_high',
        lane: perm[1],
        z: startZ - 8,
        length: 1.2,
        height: BARRIER_HIGH_TOP,
        rampLength: 0,
        speed: 0,
        variant: 1,
      });
      this.addCoinLine(coins, perm[1], startZ - 2, 5, 2.6, 0.7);

      if (difficulty > 0.25) {
        obstacles.push({
          id: this.allocId(),
          kind: 'barrier_full',
          lane: perm[2],
          z: startZ - 11,
          length: 1.5,
          height: BARRIER_FULL_HEIGHT,
          rampLength: 0,
          speed: 0,
          variant: 0,
        });
      } else {
        this.addCoinLine(coins, perm[2], startZ - 2, 5, 2.8, 0.95);
      }

      return { obstacles, coins, powerups, nextZ: startZ - 16 - gap };
    }

    if (roll < 0.76) {
      // Pattern 3: Elevated Express Train Roof Chain (Ramp -> Parked Train -> Parked Train)
      const mainLane = this.pickLane();
      const sideLane: LaneIndex = mainLane === 0 ? (this.rng() < 0.5 ? -1 : 1) : 0;

      obstacles.push({
        id: this.allocId(),
        kind: 'train_ramp',
        lane: mainLane,
        z: startZ - TRAIN_RAMP_LENGTH * 0.5,
        length: TRAIN_RAMP_LENGTH,
        height: TRAIN_HEIGHT,
        rampLength: TRAIN_RAMP_SLOPE_LEN,
        speed: 0,
        variant: 0,
      });
      obstacles.push({
        id: this.allocId(),
        kind: 'train_parked',
        lane: mainLane,
        z: startZ - TRAIN_RAMP_LENGTH - 3.5 - TRAIN_PARKED_LENGTH * 0.5,
        length: TRAIN_PARKED_LENGTH,
        height: TRAIN_HEIGHT,
        rampLength: 0,
        speed: 0,
        variant: 2,
      });
      // Adjacent train offset so player can leap sideways from roof to roof!
      obstacles.push({
        id: this.allocId(),
        kind: 'train_parked',
        lane: sideLane,
        z: startZ - TRAIN_RAMP_LENGTH * 0.85 - TRAIN_PARKED_LENGTH * 0.5,
        length: TRAIN_PARKED_LENGTH,
        height: TRAIN_HEIGHT,
        rampLength: 0,
        speed: 0,
        variant: 1,
      });

      this.addCoinLine(coins, mainLane, startZ - 6, 5, 2.7, TRAIN_HEIGHT + 0.95);
      this.addCoinLine(coins, sideLane, startZ - 19, 5, 2.7, TRAIN_HEIGHT + 0.95);

      if (this.wavesSpawned % 3 === 0) {
        powerups.push({
          id: this.allocId(),
          kind: POWERUP_POOL[Math.floor(this.rng() * POWERUP_POOL.length)],
          lane: mainLane,
          y: TRAIN_HEIGHT + 1.2,
          z: startZ - TRAIN_RAMP_LENGTH - 12,
          collected: false,
        });
      }

      return {
        obstacles,
        coins,
        powerups,
        nextZ: startZ - TRAIN_RAMP_LENGTH - TRAIN_PARKED_LENGTH - gap,
      };
    }

    // Pattern 4: High-Speed Oncoming Express + Escape Lane
    const safeLane = this.pickLane();
    for (const lane of LANES) {
      if (lane === safeLane) {
        obstacles.push({
          id: this.allocId(),
          kind: this.rng() < 0.5 ? 'barrier_low' : 'barrier_high',
          lane,
          z: startZ - 10,
          length: 1.1,
          height: BARRIER_LOW_HEIGHT,
          rampLength: 0,
          speed: 0,
          variant: 0,
        });
        this.addCoinLine(coins, lane, startZ - 4, 5, 2.8, 0.95, 1.4);
      } else {
        obstacles.push({
          id: this.allocId(),
          kind: 'train_oncoming',
          lane,
          z: startZ - 32 - (lane === 0 ? 12 : 0),
          length: TRAIN_ONCOMING_LENGTH,
          height: TRAIN_HEIGHT,
          rampLength: 0,
          speed: TRAIN_ONCOMING_SPEED * (0.9 + difficulty * 0.45),
          variant: Math.floor(this.rng() * 3),
        });
      }
    }

    if (this.wavesSpawned % 5 === 0) {
      powerups.push({
        id: this.allocId(),
        kind: POWERUP_POOL[Math.floor(this.rng() * POWERUP_POOL.length)],
        lane: safeLane,
        y: 1.15,
        z: startZ - 18,
        collected: false,
      });
    }

    return { obstacles, coins, powerups, nextZ: startZ - 26 - gap };
  }

  /** Spawns aerial coin rivers while Jetpack is active */
  public spawnJetpackCoins(startZ: number): CoinEntity[] {
    const coins: CoinEntity[] = [];
    const lane = this.pickLane();
    this.addCoinLine(coins, lane, startZ, 8, 3.0, 7.6);
    return coins;
  }
}
